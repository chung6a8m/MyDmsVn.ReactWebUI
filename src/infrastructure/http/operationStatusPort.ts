import type { PortContext } from "../../ports/portContracts";
import type { PostAcknowledgement } from "../../features/sales/contracts";
import type { GoodsReceiptPostAcknowledgement } from "../../features/goodsReceipt/contracts";
import type { AuthSession } from "./authSession";
import type { HttpTransport } from "./readBoundary";
import type { SalesWireDetail } from "./salesWireSchemas";
import { receiptDetailSchema, type ReceiptWireDetail } from "./goodsReceiptWireSchemas";
import { HttpError, ProtocolError } from "./authApi";
import { z } from "./cspZod";
import { deploymentEpochSchema } from "./operationsContext";
import { decodeFrozenWeb4Operation, parseWeb4WireIntent, web4FingerprintSchema, web4OperationIdSchema, type FrozenWeb4Operation } from "./web4OperationCodec";
import { scaledDecimal, web3Amount, web3Date, web3ErrorEnvelopeSchema, web3IntId, web3LongId, web3Quantity, web3Text, web3UnitCost, web3Utc, web3Version } from "./web3WireSchemas";

export type Web4CommittedResult =
  | { kind: "committed"; operationKind: "Sales.Create" | "Sales.Update"; value: SalesWireDetail }
  | { kind: "committed"; operationKind: "Receipt.Create" | "Receipt.Update"; value: ReceiptWireDetail }
  | { kind: "committed"; operationKind: "Sales.Post"; value: PostAcknowledgement }
  | { kind: "committed"; operationKind: "Receipt.Post"; value: GoodsReceiptPostAcknowledgement };
export type OperationStatusUnknownReason = "not-observed" | "forbidden" | "result-expired" | "result-unavailable" | "invalid-intent" | "invalid-response" | "stale-scope" | "unavailable";
export type OperationStatusResult = Web4CommittedResult | { kind: "unknown"; reason: OperationStatusUnknownReason; correlationId?: string };
export interface OperationStatusPort {
  read(operation: unknown, context: PortContext & { deploymentEpoch: string }, isCurrent?: () => boolean): Promise<OperationStatusResult>;
}
const statusSchema = z.object({
  deploymentEpoch: deploymentEpochSchema, operationId: web4OperationIdSchema,
  operationKind: z.enum(["Sales.Create", "Sales.Update", "Sales.Post", "Receipt.Create", "Receipt.Update", "Receipt.Post"]),
  method: z.enum(["POST", "PUT"]), routeScope: z.string(), requestTargetId: web3LongId.nullable(),
  requestFingerprint: web4FingerprintSchema, state: z.enum(["COMMITTED", "RESULT_EXPIRED", "RESULT_UNAVAILABLE"]), outcome: z.unknown(),
}).strict();
const boundedText = (maximum: number) => web3Text.refine(value => value.length <= maximum);
const salesOriginalLine = z.object({
  saleLineId: web3LongId, lineNo: web3IntId.max(200), productId: web3IntId,
  qty: web3Quantity, unitPrice: web3UnitCost, isGift: z.boolean(), lineAmount: web3Amount,
  productIsActive: z.literal(true), unit: boundedText(32).refine(value => value.trim().length > 0), productDisplayName: boundedText(291),
}).strict();
// B04 WebOperationResultCodec is narrower than a later read: these are the
// original Write projection, exact active-reference defaults and Draft status.
const salesOriginal = z.object({
  saleId: web3LongId, saleNumber: z.string().regex(/^SA[0-9]{10}$/).refine(value => value !== "SA0000000000"), saleDate: web3Date,
  customerId: web3IntId, warehouseId: web3IntId, employeeId: web3IntId, status: z.literal("Draft"), version: web3Version,
  note: boundedText(1000).optional(), totalAmount: web3Amount,
  customerIsActive: z.literal(true), warehouseIsActive: z.literal(true), employeeIsActive: z.literal(true),
  customerDisplayName: boundedText(291), warehouseDisplayName: boundedText(291), employeeDisplayName: boundedText(291),
  lines: z.array(salesOriginalLine).min(1).max(200),
}).strict().refine(value => {
  if (new Set(value.lines.map(line => line.saleLineId)).size !== value.lines.length) return false;
  let total = 0n;
  for (let index = 0; index < value.lines.length; index++) {
    const line = value.lines[index];
    const product = scaledDecimal(line.qty, 4) * scaledDecimal(line.unitPrice, 4);
    const amount = line.isGift ? 0n : (product + 5_000n) / 10_000n;
    if (line.lineNo !== index + 1 || scaledDecimal(line.lineAmount, 4) !== amount) return false;
    total += amount;
  }
  return scaledDecimal(value.totalAmount, 4) === total;
});
const receiptOriginal = receiptDetailSchema.refine(value => value.status === "Draft" && value.postedAtUtc === null &&
  value.warehouseDisplayName === null && value.employeeDisplayName === null && value.warehouseIsActive && value.employeeIsActive &&
  (value.note === null || value.note.length <= 1000) && value.lines.every(line => line.productDisplayName === null && line.productIsActive));
const salesPost = z.object({ saleId: web3LongId, status: z.literal("Posted"), postedAtUtc: web3Utc, version: web3Version }).strict();
const receiptPost = z.object({ receiptId: web3LongId, status: z.literal("Posted"), postedAtUtc: web3Utc }).strict();
class OperationStatusProtocolError extends Error {
  constructor() { super("Invalid protected operation status."); }
}
function requireMatch(condition: boolean): void { if (!condition) throw new OperationStatusProtocolError(); }
function outcome<T extends z.ZodType>(value: unknown, schema: T): z.infer<T> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  requireMatch(bytes.byteLength > 0 && bytes.byteLength <= 1_048_576);
  const envelope = z.object({ data: z.unknown() }).strict().parse(value);
  return schema.parse(envelope.data);
}

// The port below always rehashes persisted input before this pure status decoder.
export function decodeWeb4OperationStatus(value: unknown, operation: FrozenWeb4Operation): OperationStatusResult {
  const status = statusSchema.parse(value);
  const request = operation.request;
  requireMatch(status.deploymentEpoch === operation.deploymentEpoch && status.operationId === operation.operationId && status.requestFingerprint === operation.requestFingerprint);
  requireMatch(status.operationKind === request.operationKind && status.method === request.method && status.routeScope === request.routeScope && status.requestTargetId === request.requestTargetId);
  if (status.state !== "COMMITTED") {
    requireMatch(status.outcome === null);
    return { kind: "unknown", reason: status.state === "RESULT_EXPIRED" ? "result-expired" : "result-unavailable" };
  }
  const envelope = z.object({ data: z.unknown() }).strict().parse(status.outcome);
  return decodeWeb4OperationOutcome(request, envelope.data);
}

// Shape/content proof only: the caller must also establish the authenticated
// direct-write response or the protected status identity before settlement.
export function decodeWeb4OperationOutcome(requestValue: unknown, value: unknown): Web4CommittedResult {
  const request = parseWeb4WireIntent(requestValue);
  const envelope = { data: value };
  switch (request.operationKind) {
    case "Sales.Post": {
      const result = outcome(envelope, salesPost);
      requireMatch(result.saleId === request.requestTargetId);
      return { kind: "committed", operationKind: request.operationKind, value: result };
    }
    case "Receipt.Post": {
      const result = outcome(envelope, receiptPost);
      requireMatch(result.receiptId === request.requestTargetId);
      return { kind: "committed", operationKind: request.operationKind, value: result };
    }
    case "Sales.Create": case "Sales.Update": {
      const result = outcome(envelope, salesOriginal);
      const sent = request.body;
      requireMatch(request.requestTargetId === null || result.saleId === request.requestTargetId);
      requireMatch(result.saleDate === sent.saleDate && result.customerId === sent.customerId && result.warehouseId === sent.warehouseId && result.employeeId === sent.employeeId && (result.note ?? null) === (sent.note ?? null));
      requireMatch(result.lines.length === sent.lines.length);
      result.lines.forEach((line, index) => {
        const original = sent.lines[index];
        requireMatch(line.productId === original.productId && line.isGift === original.isGift && (original.saleLineId === "0" || line.saleLineId === original.saleLineId) &&
          scaledDecimal(line.qty, 4) === scaledDecimal(original.qty, 4) && scaledDecimal(line.unitPrice, 4) === scaledDecimal(original.unitPrice, 4));
      });
      return { kind: "committed", operationKind: request.operationKind, value: result };
    }
    case "Receipt.Create": case "Receipt.Update": {
      const result = outcome(envelope, receiptOriginal);
      const sent = request.body;
      requireMatch(request.requestTargetId === null || result.receiptId === request.requestTargetId);
      requireMatch(result.receiptDate === sent.receiptDate && result.warehouseId === sent.warehouseId && result.employeeId === sent.employeeId && (result.note ?? null) === (sent.note ?? null));
      requireMatch(result.lines.length === sent.lines.length);
      result.lines.forEach((line, index) => {
        const original = sent.lines[index];
        requireMatch(line.productId === original.productId && scaledDecimal(line.quantity, 4) === scaledDecimal(original.quantity, 4) && scaledDecimal(line.unitCost, 4) === scaledDecimal(original.unitCost, 4));
      });
      return { kind: "committed", operationKind: request.operationKind, value: result };
    }
  }
}

export function createOperationStatusPort(transport: HttpTransport, auth: AuthSession): OperationStatusPort {
  return {
    async read(value, inputContext, isCurrent = () => true) {
      const { actorKey, actorGeneration, deploymentEpoch, signal } = inputContext;
      const same = () => {
        const current = auth.getSnapshot();
        return current.status === "authenticated" && current.actorKey === actorKey && current.actorGeneration === actorGeneration &&
          current.deploymentEpoch === deploymentEpoch && !signal.aborted && isCurrent();
      };
      const stale = (): OperationStatusResult => ({ kind: "unknown", reason: "stale-scope" });
      if (!same()) return stale();
      let operation: FrozenWeb4Operation;
      try { operation = await decodeFrozenWeb4Operation(value); }
      catch { return same() ? { kind: "unknown", reason: "invalid-intent" } : stale(); }
      if (!same() || operation.actorKey !== actorKey || operation.deploymentEpoch !== deploymentEpoch) return stale();
      try {
        const data = await transport.request(`/api/v1/operations/${operation.operationId}`, {
          method: "GET", signal, strictResponse: true, expectedStatus: 200,
          headers: { "X-MyDmsVn-Deployment-Epoch": deploymentEpoch, "X-MyDmsVn-Operation-Fingerprint": operation.requestFingerprint },
        });
        if (!same()) return stale();
        const result = decodeWeb4OperationStatus(data, operation);
        return same() ? result : stale();
      } catch (error) {
        if (!same()) return stale();
        if (error instanceof HttpError) {
          const parsed = web3ErrorEnvelopeSchema.safeParse(error.body);
          const correlationId = parsed.success ? parsed.data.error.correlationId : undefined;
          const reason: OperationStatusUnknownReason = error.status === 404 ? "not-observed" : error.status === 403 ? "forbidden" : error.status === 410 ? "result-expired" :
            parsed.success && parsed.data.error.code === "Operation.ResultUnavailable" ? "result-unavailable" : "unavailable";
          return { kind: "unknown", reason, ...(correlationId ? { correlationId } : {}) };
        }
        return { kind: "unknown", reason: error instanceof ProtocolError || error instanceof z.ZodError || error instanceof OperationStatusProtocolError ? "invalid-response" : "unavailable" };
      }
    },
  };
}
