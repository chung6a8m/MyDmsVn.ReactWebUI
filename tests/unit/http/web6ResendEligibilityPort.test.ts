import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { createHttpTransport } from "../../../src/infrastructure/http/httpTransport";
import { freezeWeb4Operation } from "../../../src/infrastructure/http/web4OperationCodec";
import { createWeb6ResendEligibilityPort, decodeWeb6Eligibility, decodeWeb6Receipt, decodeWeb6ResendContext } from "../../../src/infrastructure/http/web6ResendEligibilityPort";
import type { AuthSession, AuthSnapshot } from "../../../src/infrastructure/http/authSession";
import type { HttpTransport } from "../../../src/infrastructure/http/readBoundary";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/web4-v1/corpus/${name}.json`, import.meta.url), "utf8"));
const stems = ["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"];
const identity = { operationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", deploymentEpoch: "11111111-2222-4333-8444-555555555555", actorKey: "42" };
const contextWire = { contractVersion: "web6-resend-eligibility-v1", candidateId: "candidate-1", deploymentEpoch: identity.deploymentEpoch,
  actorUserId: 42, serverUtc: "2026-11-09T00:00:00.0000000Z", maximumEligibilitySeconds: 604800, eligibilityEnabled: true };
const receiptWire = (operation: Awaited<ReturnType<typeof freezeWeb4Operation>>) => ({ contractVersion: "web6-resend-eligibility-v1", candidateId: "candidate-1",
  deploymentEpoch: operation.deploymentEpoch, actorUserId: 42, operationId: operation.operationId, operationKind: operation.request.operationKind,
  method: operation.request.method, routeScope: operation.request.routeScope, requestTargetId: operation.request.requestTargetId,
  requestFingerprint: operation.requestFingerprint, issuedAtUtc: "2026-11-09T00:00:00.0000000Z", eligibleUntilUtc: "2026-11-16T00:00:00.0000000Z",
  receipt: "header.payload.signature" });
const eligibilityWire = (operation: Awaited<ReturnType<typeof freezeWeb4Operation>>, decision = "ALLOW", reason = "ORIGINAL_NOT_OBSERVED_RECEIPT_VALID") => ({
  ...receiptWire(operation), receipt: undefined, issuedAtUtc: undefined, decision, reason, serverUtc: "2026-11-09T00:01:00.0000000Z",
});
function withoutUndefined(value: Record<string, unknown>) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)); }
function setup(stem = "sales-create") {
  const grants = { read: false, write: !stem.endsWith("post"), post: stem.endsWith("post") };
  let snapshot = { status: "authenticated", actorKey: "42", actorGeneration: 1, deploymentEpoch: identity.deploymentEpoch,
    capabilities: grants, features: { sales: grants, "goods-receipt": grants } } as AuthSnapshot;
  const auth = { getSnapshot: () => snapshot, access: async () => "token", refresh: vi.fn(), expire: vi.fn() } as unknown as AuthSession;
  const request = vi.fn<HttpTransport["request"]>();
  const context = { actorKey: "42", actorGeneration: 1, deploymentEpoch: identity.deploymentEpoch, signal: new AbortController().signal };
  return { auth, request, context, port: createWeb6ResendEligibilityPort({ request }, auth, "candidate-1"),
    revoke() { snapshot = { ...snapshot, features: { ...snapshot.features, [stem.startsWith("sales") ? "sales" : "goods-receipt"]: { read: true, write: false, post: false } } } as AuthSnapshot; } };
}

it("strictly decodes the candidate context", () => {
  expect(decodeWeb6ResendContext(contextWire, { candidateId: "candidate-1", actorKey: "42", deploymentEpoch: identity.deploymentEpoch })).toEqual(contextWire);
  for (const change of [(v: any) => v.candidateId = "other", (v: any) => v.actorUserId = "42", (v: any) => v.serverUtc = "2026-11-09T00:00:00.000Z",
    (v: any) => v.maximumEligibilitySeconds = 604799, (v: any) => v.private = true]) {
    const value = structuredClone(contextWire); change(value); expect(() => decodeWeb6ResendContext(value, { candidateId: "candidate-1", actorKey: "42", deploymentEpoch: identity.deploymentEpoch })).toThrow();
  }
});

it.each(stems)("strictly binds %s receipt and all eligibility decisions", async stem => {
  const operation = await freezeWeb4Operation(fixture(`${stem}-intent`), identity);
  expect(decodeWeb6Receipt(receiptWire(operation), operation, "candidate-1").receipt).toBe("header.payload.signature");
  for (const [decision, reason] of [["ALLOW", "ORIGINAL_NOT_OBSERVED_RECEIPT_VALID"], ["DENY", "COMMITTED_RESULT_AVAILABLE"],
    ["DENY", "COMMITTED_RESULT_UNAVAILABLE"], ["DENY", "RESULT_EXPIRED"], ["DENY", "NOT_EXECUTED"], ["DENY", "RECEIPT_EXPIRED"],
    ["INDETERMINATE", "TERMINAL_AUDIT_INCOMPLETE"]]) {
    expect(decodeWeb6Eligibility(withoutUndefined(eligibilityWire(operation, decision, reason)), operation, "candidate-1")).toMatchObject({ decision, reason });
  }
});

it.each(["candidateId", "deploymentEpoch", "actorUserId", "operationId", "operationKind", "method", "routeScope", "requestTargetId", "requestFingerprint", "eligibleUntilUtc"])("rejects receipt identity mismatch %s", async field => {
  const operation = await freezeWeb4Operation(fixture("sales-update-intent"), identity), value: any = receiptWire(operation);
  value[field] = field === "actorUserId" ? 43 : field === "requestTargetId" ? "9007199254740994" : field === "eligibleUntilUtc" ? "2026-11-16T00:00:00.000Z" : "wrong";
  expect(() => decodeWeb6Receipt(value, operation, "candidate-1")).toThrow();
});

it("calls exact context, receipt and eligibility GETs with target omitted for Create", async () => {
  const s = setup(), operation = await freezeWeb4Operation(fixture("sales-create-intent"), identity);
  s.request.mockResolvedValueOnce(contextWire).mockResolvedValueOnce(receiptWire(operation)).mockResolvedValueOnce(withoutUndefined(eligibilityWire(operation)));
  await s.port.readContext(s.context); const receipt = await s.port.issueReceipt(operation, s.context); await s.port.readEligibility(operation, receipt.receipt, s.context);
  expect(s.request.mock.calls.map(([path]) => path)).toEqual(["/api/v3/operations/resend-context", `/api/v3/operations/${operation.operationId}/resend-receipt`, `/api/v3/operations/${operation.operationId}/resend-eligibility`]);
  const receiptHeaders = new Headers(s.request.mock.calls[1][1]?.headers), eligibilityHeaders = new Headers(s.request.mock.calls[2][1]?.headers);
  expect(receiptHeaders.has("X-MyDmsVn-Operation-Target-Id")).toBe(false);
  expect(eligibilityHeaders.get("X-MyDmsVn-Resend-Receipt")).toBe("header.payload.signature");
});

it("rechecks the original grant after each await", async () => {
  const s = setup(), operation = await freezeWeb4Operation(fixture("sales-create-intent"), identity);
  s.request.mockImplementation(async () => { s.revoke(); return receiptWire(operation); });
  await expect(s.port.issueReceipt(operation, s.context)).rejects.toThrow();
});

it.each(["/api/v3/operations/resend-context/extra", "/api/v3/operations/not-a-guid/resend-receipt", "/api/v3/arbitrary", "/api/v3/operations/resend-context?x=1"])("transport rejects non-allowlisted v3 path %s", async path => {
  const auth = { getSnapshot: () => ({ status: "authenticated", actorKey: "42", actorGeneration: 1, deploymentEpoch: identity.deploymentEpoch }), access: async () => "token", refresh: vi.fn(), expire: vi.fn() } as unknown as AuthSession;
  const fetcher = vi.fn<typeof fetch>(); await expect(createHttpTransport(auth, fetcher).request(path)).rejects.toThrow("Same-origin"); expect(fetcher).not.toHaveBeenCalled();
});

it("transport allows only the exact three read-only v3 shapes", async () => {
  const auth = { getSnapshot: () => ({ status: "authenticated", actorKey: "42", actorGeneration: 1, deploymentEpoch: identity.deploymentEpoch }), access: async () => "token", refresh: vi.fn(), expire: vi.fn() } as unknown as AuthSession;
  const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ data: {} })));
  const transport = createHttpTransport(auth, fetcher);
  for (const path of ["/api/v3/operations/resend-context", `/api/v3/operations/${identity.operationId}/resend-receipt`, `/api/v3/operations/${identity.operationId}/resend-eligibility`]) await transport.request(path);
  expect(fetcher).toHaveBeenCalledTimes(3); expect(fetcher.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
});
