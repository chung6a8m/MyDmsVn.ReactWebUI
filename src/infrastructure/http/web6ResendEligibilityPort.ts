import type { PortContext } from "../../ports/portContracts";
import { hasModuleCapability } from "../../app/runtime/moduleCapabilities";
import type { AuthSession } from "./authSession";
import { ProtocolError } from "./authApi";
import { z } from "./cspZod";
import type { HttpTransport } from "./readBoundary";
import { sameActor } from "./readBoundary";
import { deploymentEpochSchema } from "./operationsContext";
import { decodeFrozenWeb4Operation, web4FingerprintSchema, web4OperationIdSchema, type FrozenWeb4Operation } from "./web4OperationCodec";
import { web3LongId } from "./web3WireSchemas";

const contractVersion = z.literal("web6-resend-eligibility-v1");
const candidateId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);
const actorUserId = z.number().int().positive().max(2147483647);
const utc7 = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/).refine(value => {
  const parsed = Date.parse(`${value.slice(0, 23)}Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 19) === value.slice(0, 19);
});
const identityShape = { contractVersion, candidateId, deploymentEpoch: deploymentEpochSchema, actorUserId, operationId: web4OperationIdSchema,
  operationKind: z.enum(["Sales.Create", "Sales.Update", "Sales.Post", "Receipt.Create", "Receipt.Update", "Receipt.Post"]),
  method: z.enum(["POST", "PUT"]), routeScope: z.enum(["/api/v1/sales-receipts", "/api/v1/sales-receipts/{saleId}/draft", "/api/v1/sales-receipts/{saleId}/post",
    "/api/v1/goods-receipts", "/api/v1/goods-receipts/{receiptId}/draft", "/api/v1/goods-receipts/{receiptId}/post"]),
  requestTargetId: web3LongId.nullable(), requestFingerprint: web4FingerprintSchema };
const contextSchema = z.object({ contractVersion, candidateId, deploymentEpoch: deploymentEpochSchema, actorUserId, serverUtc: utc7,
  maximumEligibilitySeconds: z.literal(604800), eligibilityEnabled: z.literal(true) }).strict();
const receiptSchema = z.object({ ...identityShape, issuedAtUtc: utc7, eligibleUntilUtc: utc7,
  receipt: z.string().min(5).max(4096).regex(/^[\x21-\x7e]+$/) }).strict();
const decisionSchema = z.discriminatedUnion("decision", [
  z.object({ ...identityShape, decision: z.literal("ALLOW"), reason: z.literal("ORIGINAL_NOT_OBSERVED_RECEIPT_VALID"), serverUtc: utc7, eligibleUntilUtc: utc7 }).strict(),
  z.object({ ...identityShape, decision: z.literal("DENY"), reason: z.enum(["COMMITTED_RESULT_AVAILABLE", "COMMITTED_RESULT_UNAVAILABLE", "RESULT_EXPIRED", "NOT_EXECUTED", "RECEIPT_EXPIRED"]), serverUtc: utc7, eligibleUntilUtc: utc7 }).strict(),
  z.object({ ...identityShape, decision: z.literal("INDETERMINATE"), reason: z.literal("TERMINAL_AUDIT_INCOMPLETE"), serverUtc: utc7, eligibleUntilUtc: utc7 }).strict(),
]);
export type Web6ResendContext = z.infer<typeof contextSchema>;
export type Web6ResendReceipt = z.infer<typeof receiptSchema>;
export type Web6ResendEligibility = z.infer<typeof decisionSchema>;
interface ExpectedContext { candidateId: string; actorKey: string; deploymentEpoch: string }

function requireValue(value: boolean): asserts value { if (!value) throw new ProtocolError(); }
function bounded(value: unknown, maximum = 8192) { const raw = JSON.stringify(value); requireValue(typeof raw === "string" && new TextEncoder().encode(raw).byteLength <= maximum); }
function matchIdentity(value: z.infer<typeof receiptSchema> | Web6ResendEligibility, operation: FrozenWeb4Operation, expectedCandidate: string) {
  const request = operation.request;
  requireValue(value.candidateId === expectedCandidate && String(value.actorUserId) === operation.actorKey && value.deploymentEpoch === operation.deploymentEpoch &&
    value.operationId === operation.operationId && value.operationKind === request.operationKind && value.method === request.method && value.routeScope === request.routeScope &&
    value.requestTargetId === request.requestTargetId && value.requestFingerprint === operation.requestFingerprint);
}
export function decodeWeb6ResendContext(value: unknown, expected: ExpectedContext): Web6ResendContext {
  try { bounded(value); const parsed = contextSchema.parse(value); requireValue(parsed.candidateId === expected.candidateId && String(parsed.actorUserId) === expected.actorKey && parsed.deploymentEpoch === expected.deploymentEpoch); return parsed; }
  catch { throw new ProtocolError(); }
}
export function decodeWeb6Receipt(value: unknown, operation: FrozenWeb4Operation, expectedCandidate: string): Web6ResendReceipt {
  try { bounded(value); const parsed = receiptSchema.parse(value); matchIdentity(parsed, operation, expectedCandidate); requireValue(parsed.eligibleUntilUtc > parsed.issuedAtUtc); return parsed; }
  catch { throw new ProtocolError(); }
}
export function decodeWeb6Eligibility(value: unknown, operation: FrozenWeb4Operation, expectedCandidate: string): Web6ResendEligibility {
  try { bounded(value); const parsed = decisionSchema.parse(value); matchIdentity(parsed, operation, expectedCandidate); requireValue(parsed.serverUtc <= parsed.eligibleUntilUtc || parsed.decision === "DENY" && parsed.reason === "RECEIPT_EXPIRED"); return parsed; }
  catch { throw new ProtocolError(); }
}
function headers(operation: FrozenWeb4Operation, receipt?: string): HeadersInit {
  const value: Record<string, string> = { "X-MyDmsVn-Deployment-Epoch": operation.deploymentEpoch,
    "X-MyDmsVn-Operation-Fingerprint": operation.requestFingerprint, "X-MyDmsVn-Operation-Kind": operation.request.operationKind };
  if (operation.request.requestTargetId !== null) value["X-MyDmsVn-Operation-Target-Id"] = operation.request.requestTargetId;
  if (receipt !== undefined) value["X-MyDmsVn-Resend-Receipt"] = receipt;
  return value;
}
export function createWeb6ResendEligibilityPort(transport: HttpTransport, auth: AuthSession, expectedCandidateId: string) {
  type ResendContext = PortContext & { deploymentEpoch: string };
  const current = (context: PortContext, operation?: FrozenWeb4Operation) => {
    if (!sameActor(auth, context)) return false;
    if (!operation) return true;
    const feature = operation.request.operationKind.startsWith("Sales.") ? "sales" : "goods-receipt";
    return operation.actorKey === context.actorKey && operation.deploymentEpoch === context.deploymentEpoch &&
      hasModuleCapability(auth.getSnapshot(), context, feature, operation.request.operationKind.endsWith(".Post") ? "post" : "write");
  };
  return {
    async readContext(context: ResendContext) {
      if (!current(context)) throw new ProtocolError();
      const value = await transport.request("/api/v3/operations/resend-context", { method: "GET", signal: context.signal, strictResponse: true, expectedStatus: 200 });
      if (!current(context)) throw new ProtocolError();
      return decodeWeb6ResendContext(value, { candidateId: expectedCandidateId, actorKey: context.actorKey, deploymentEpoch: context.deploymentEpoch });
    },
    async issueReceipt(input: unknown, context: ResendContext) {
      const operation = await decodeFrozenWeb4Operation(input); if (!current(context, operation)) throw new ProtocolError();
      const value = await transport.request(`/api/v3/operations/${operation.operationId}/resend-receipt`, { method: "GET", signal: context.signal, strictResponse: true, expectedStatus: 200, headers: headers(operation) });
      if (!current(context, operation)) throw new ProtocolError();
      return decodeWeb6Receipt(value, operation, expectedCandidateId);
    },
    async readEligibility(input: unknown, receipt: string, context: ResendContext) {
      const operation = await decodeFrozenWeb4Operation(input); if (!current(context, operation)) throw new ProtocolError();
      const value = await transport.request(`/api/v3/operations/${operation.operationId}/resend-eligibility`, { method: "GET", signal: context.signal, strictResponse: true, expectedStatus: 200, headers: headers(operation, receipt) });
      if (!current(context, operation)) throw new ProtocolError();
      return decodeWeb6Eligibility(value, operation, expectedCandidateId);
    },
  };
}
