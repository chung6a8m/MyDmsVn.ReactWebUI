import type { PortContext } from "../../ports/portContracts";
import type { AuthSession } from "./authSession";
import type { HttpTransport } from "./readBoundary";
import { z } from "./cspZod";
import { HttpError, ProtocolError } from "./authApi";
import { deploymentEpochSchema } from "./operationsContext";
import { decodeFrozenWeb4Operation, web4FingerprintSchema, web4OperationIdSchema, type FrozenWeb4Operation } from "./web4OperationCodec";
import { decodeWeb4OperationOutcome, type Web4CommittedResult, type OperationStatusUnknownReason } from "./operationStatusPort";
import { web3ErrorEnvelopeSchema, web3LongId, web3Utc } from "./web3WireSchemas";
import { hasModuleCapability } from "../../app/runtime/moduleCapabilities";

const contractVersion = z.literal("web5-resolution-v1");
const actorUserId = z.number().int().positive().max(2147483647);
const epoch = deploymentEpochSchema.refine(value => value.length === 36);
const operationId = web4OperationIdSchema.refine(value => value.length === 36);
const contextSchema = z.object({ contractVersion, actorUserId, deploymentEpoch: epoch, sameKeyResendEnabled: z.literal(false) }).strict();
const terminalSchema = z.object({ decisionId: operationId,
  caseId: z.string().min(1).max(128).refine(value => !/[^A-Za-z0-9_-]/.test(value)),
  // SQL datetime2(7): preserve every fractional digit; never round-trip a Date.
  decidedAtUtc: web3Utc.refine(value => value.length === 28 && /\.[0-9]{7}Z$/.test(value)),
}).strict();
const identityShape = { contractVersion, actorUserId, deploymentEpoch: epoch, operationId,
  operationKind: z.enum(["Sales.Create", "Sales.Update", "Sales.Post", "Receipt.Create", "Receipt.Update", "Receipt.Post"]),
  method: z.enum(["POST", "PUT"]), routeScope: z.string(), requestTargetId: web3LongId.nullable(),
  requestFingerprint: web4FingerprintSchema.refine(value => value.length === 64),
};
const negativeSchema = z.object({ ...identityShape, state: z.literal("NOT_EXECUTED"), outcome: z.null(), terminal: terminalSchema }).strict();
const resolutionSchema = z.discriminatedUnion("state", [negativeSchema,
  z.object({ ...identityShape, state: z.literal("COMMITTED"), outcome: z.unknown(), terminal: z.null() }).strict(),
  z.object({ ...identityShape, state: z.enum(["RESULT_EXPIRED", "RESULT_UNAVAILABLE", "INDETERMINATE"]), outcome: z.null(), terminal: z.null() }).strict(),
]);
export type Web5NotExecutedCertificate = z.infer<typeof negativeSchema>;
export type OperationResolutionUnknownReason = OperationStatusUnknownReason | "unsupported-host" | "indeterminate";
export type OperationResolutionResult = Web4CommittedResult | { kind: "not-executed"; certificate: Web5NotExecutedCertificate } |
  { kind: "unknown"; reason: OperationResolutionUnknownReason; correlationId?: string };
export interface OperationResolutionPort {
  read(operation: unknown, context: PortContext & { deploymentEpoch: string }, isCurrent?: () => boolean): Promise<OperationResolutionResult>;
}
function requireMatch(value: boolean) { if (!value) throw new ProtocolError(); }
function bounded(value: unknown, maximum: number) {
  const json = JSON.stringify(value);
  requireMatch(typeof json === "string" && new TextEncoder().encode(json).byteLength <= maximum);
}
// Shape/content validation only. Stored certificates are not fresh authority:
// runtime restore/transition must obtain this result from a currently admitted read.
export function decodeOperationResolution(value: unknown, operation: FrozenWeb4Operation): OperationResolutionResult {
  try {
    // The original outcome is limited to 1 MiB; the fixed identity/terminal
    // envelope fits well inside the additional 4 KiB budget.
    bounded(value, 1_048_576 + 4096);
    const parsed = resolutionSchema.parse(value), request = operation.request;
    requireMatch(String(parsed.actorUserId) === operation.actorKey && parsed.deploymentEpoch === operation.deploymentEpoch &&
      parsed.operationId === operation.operationId && parsed.requestFingerprint === operation.requestFingerprint &&
      parsed.operationKind === request.operationKind && parsed.method === request.method && parsed.routeScope === request.routeScope && parsed.requestTargetId === request.requestTargetId);
    if (parsed.state === "NOT_EXECUTED") return { kind: "not-executed", certificate: parsed };
    if (parsed.state === "COMMITTED") return decodeWeb4OperationOutcome(request, z.object({ data: z.unknown() }).strict().parse(parsed.outcome).data);
    return { kind: "unknown", reason: parsed.state === "RESULT_EXPIRED" ? "result-expired" : parsed.state === "RESULT_UNAVAILABLE" ? "result-unavailable" : "indeterminate" };
  } catch { throw new ProtocolError(); }
}
export function createOperationResolutionPort(transport: HttpTransport, auth: AuthSession): OperationResolutionPort {
  let discovered: { actorKey: string; actorGeneration: number; deploymentEpoch: string } | undefined;
  return { async read(value, context, isCurrent = () => true) {
    const { actorKey, actorGeneration, deploymentEpoch, signal } = context;
    let operation: FrozenWeb4Operation | undefined;
    const blocked = (): OperationResolutionResult | undefined => {
      const current = auth.getSnapshot();
      if (current.status !== "authenticated" || current.actorKey !== actorKey || current.actorGeneration !== actorGeneration ||
        current.deploymentEpoch !== deploymentEpoch || signal.aborted || !isCurrent()) return { kind: "unknown", reason: "stale-scope" };
      if (operation && !hasModuleCapability(current, context, operation.request.operationKind.startsWith("Sales.") ? "sales" : "goods-receipt",
        operation.request.operationKind.endsWith(".Post") ? "post" : "write")) return { kind: "unknown", reason: "forbidden" };
    };
    let denial = blocked(); if (denial) return denial;
    try { operation = await decodeFrozenWeb4Operation(value); }
    catch { return blocked() ?? { kind: "unknown", reason: "invalid-intent" }; }
    denial = blocked(); if (denial) return denial;
    if (operation.actorKey !== actorKey || operation.deploymentEpoch !== deploymentEpoch) return { kind: "unknown", reason: "stale-scope" };
    let readingContext = false;
    try {
      if (!discovered || discovered.actorKey !== actorKey || discovered.actorGeneration !== actorGeneration || discovered.deploymentEpoch !== deploymentEpoch) {
        readingContext = true;
        const data = await transport.request("/api/v2/operations/context", { method: "GET", signal, strictResponse: true, expectedStatus: 200 });
        denial = blocked(); if (denial) return denial;
        bounded(data, 4096); const parsed = contextSchema.parse(data);
        requireMatch(String(parsed.actorUserId) === actorKey && parsed.deploymentEpoch === deploymentEpoch);
        discovered = { actorKey, actorGeneration, deploymentEpoch };
      }
      readingContext = false;
      denial = blocked(); if (denial) return denial;
      const data = await transport.request(`/api/v2/operations/${operation.operationId}/resolution`, { method: "GET", signal, strictResponse: true, expectedStatus: 200,
        headers: { "X-MyDmsVn-Deployment-Epoch": deploymentEpoch, "X-MyDmsVn-Operation-Fingerprint": operation.requestFingerprint } });
      denial = blocked(); if (denial) return denial;
      const result = decodeOperationResolution(data, operation);
      return blocked() ?? result;
    } catch (error) {
      denial = blocked(); if (denial) return denial;
      if (error instanceof HttpError) {
        const parsed = web3ErrorEnvelopeSchema.safeParse(error.body), candidate = parsed.success ? parsed.data.error.correlationId : undefined;
        const correlationId = candidate && candidate.length <= 128 && !/[^A-Za-z0-9._-]/.test(candidate) ? candidate : undefined;
        return { kind: "unknown", reason: error.status === 404 ? readingContext ? "unsupported-host" : "not-observed" : error.status === 403 ? "forbidden" : "unavailable", ...(correlationId ? { correlationId } : {}) };
      }
      return { kind: "unknown", reason: error instanceof ProtocolError || error instanceof z.ZodError ? "invalid-response" : "unavailable" };
    }
  } };
}
