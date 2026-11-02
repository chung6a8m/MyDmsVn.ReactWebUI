import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { createOperationResolutionPort } from "../../../src/infrastructure/http/operationResolutionPort";
import { freezeWeb4Operation } from "../../../src/infrastructure/http/web4OperationCodec";
import { createHttpTransport } from "../../../src/infrastructure/http/httpTransport";
import { HttpError } from "../../../src/infrastructure/http/authApi";
import type { AuthSession, AuthSnapshot } from "../../../src/infrastructure/http/authSession";
import type { HttpTransport } from "../../../src/infrastructure/http/readBoundary";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/web4-v1/corpus/${name}.json`, import.meta.url), "utf8"));
const resolutionFixture = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/web5-resolution-v1/${name}.json`, import.meta.url), "utf8"));
const identity = { operationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", deploymentEpoch: "11111111-2222-4333-8444-555555555555", actorKey: "42" };
const stems = ["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"];
const terminal = { decisionId: "77777777-7777-4777-8777-777777777777", caseId: "WEB5-CASE-0042", decidedAtUtc: "2026-11-02T09:10:11.1234567Z" };
// Canonical responses pinned to backend 2d727002; mutations below are generated
// adversarial tests, never additional claimed canonical fixtures.
const contextValue = () => resolutionFixture("context-response").data;
function resolution(stem = "sales-create", state = "NOT_EXECUTED") {
  const suffix = ({ NOT_EXECUTED: "not-executed", COMMITTED: "committed", RESULT_EXPIRED: "result-expired", RESULT_UNAVAILABLE: "result-unavailable", INDETERMINATE: "indeterminate" } as Record<string, string>)[state];
  return resolutionFixture(`${stem}-${suffix}`).data;
}
function setup(stem = "sales-create") {
  const grants = { read: false, write: !stem.endsWith("post"), post: stem.endsWith("post") };
  let snapshot = { status: "authenticated", actorKey: "42", actorGeneration: 1, deploymentEpoch: identity.deploymentEpoch,
    capabilities: grants, features: { sales: grants, "goods-receipt": grants } } as AuthSnapshot;
  const auth = { getSnapshot: () => snapshot, access: async () => "fixture-token", refresh: vi.fn(), expire: vi.fn() } as unknown as AuthSession;
  const context = { actorKey: "42", actorGeneration: 1, deploymentEpoch: identity.deploymentEpoch, signal: new AbortController().signal };
  const request = vi.fn<HttpTransport["request"]>(async path => path.endsWith("/context") ? contextValue() : resolution(stem));
  return { auth, context, request, port: createOperationResolutionPort({ request }, auth), snapshot: () => snapshot,
    change(value: Partial<AuthSnapshot>) { snapshot = { ...snapshot, ...value } as AuthSnapshot; },
    revoke() { const denied = { read: true, write: stem.endsWith("post"), post: !stem.endsWith("post") }; snapshot = { ...snapshot, capabilities: denied, features: { ...snapshot.features, [stem.startsWith("sales") ? "sales" : "goods-receipt"]: denied } }; } };
}
it.each(stems)("reads %s negative proof using only its original grant and preserves SQL timestamp precision", async stem => {
  const s = setup(stem), frozen = await freezeWeb4Operation(fixture(`${stem}-intent`), identity);
  expect(s.request).not.toHaveBeenCalled();
  const result = await s.port.read(frozen, s.context);
  expect(result).toEqual({ kind: "not-executed", certificate: resolution(stem) });
  expect(s.request.mock.calls.map(([path]) => path)).toEqual(["/api/v2/operations/context", `/api/v2/operations/${identity.operationId}/resolution`]);
  const init = s.request.mock.calls[1][1];
  expect(init).toMatchObject({ method: "GET", strictResponse: true, expectedStatus: 200, signal: s.context.signal });
  const headers = new Headers(init?.headers);
  expect(headers.get("X-MyDmsVn-Operation-Fingerprint")).toBe(frozen.requestFingerprint);
  expect(headers.get("X-MyDmsVn-Deployment-Epoch")).toBe(identity.deploymentEpoch);
  expect(headers.has("Idempotency-Key")).toBe(false); expect(init?.body).toBeUndefined();
});
it.each(stems)("decodes only the exact original %s committed outcome", async stem => {
  const s = setup(stem); s.request.mockImplementation(async path => path.endsWith("/context") ? contextValue() : resolution(stem, "COMMITTED"));
  expect(await s.port.read(await freezeWeb4Operation(fixture(`${stem}-intent`), identity), s.context)).toEqual({ kind: "committed", operationKind: fixture(`${stem}-intent`).operationKind, value: fixture(`${stem}-response`).data });
});
for (const stem of stems) it.each(["RESULT_EXPIRED", "RESULT_UNAVAILABLE", "INDETERMINATE"])(`never turns ${stem} %s into terminal authority`, async state => {
  const s = setup(stem); s.request.mockImplementation(async path => path.endsWith("/context") ? contextValue() : resolution(stem, state));
  expect(await s.port.read(await freezeWeb4Operation(fixture(`${stem}-intent`), identity), s.context)).toMatchObject({ kind: "unknown" });
});
it("reuses lazy context only inside the same current actor generation and epoch", async () => {
  const s = setup(), frozen = await freezeWeb4Operation(fixture("sales-create-intent"), identity);
  await s.port.read(frozen, s.context); await s.port.read(frozen, s.context);
  expect(s.request.mock.calls.map(([path]) => path)).toEqual(["/api/v2/operations/context", `/api/v2/operations/${identity.operationId}/resolution`, `/api/v2/operations/${identity.operationId}/resolution`]);
});
it.each(stems)("refuses %s after original grant revocation even when Read and the other mutation grant remain", async stem => {
  const s = setup(stem); s.revoke();
  expect(await s.port.read(await freezeWeb4Operation(fixture(`${stem}-intent`), identity), s.context)).toMatchObject({ kind: "unknown", reason: "forbidden" });
  expect(s.request).not.toHaveBeenCalled();
});
it("rehashes frozen bytes before even discovering the v2 context", async () => {
  const s = setup(), frozen = await freezeWeb4Operation(fixture("sales-create-intent"), identity);
  expect(await s.port.read({ ...frozen, requestFingerprint: "0".repeat(64) }, s.context)).toMatchObject({ kind: "unknown", reason: "invalid-intent" });
  expect(s.request).not.toHaveBeenCalled();
});
it.each(["actor", "epoch", "generation", "document", "original-grant"])("discards a late negative after %s changes", async change => {
  const s = setup(), frozen = await freezeWeb4Operation(fixture("sales-create-intent"), identity);
  let finish!: (value: unknown) => void, entered!: () => void; const reached = new Promise<void>(done => { entered = done; });
  s.request.mockImplementation(async path => {
    if (path.endsWith("/context")) return contextValue();
    entered(); return new Promise(done => { finish = done; });
  });
  let current = true; const pending = s.port.read(frozen, s.context, () => current); await reached;
  if (change === "actor") s.change({ actorKey: "43" });
  if (change === "epoch") s.change({ deploymentEpoch: "22222222-2222-4333-8444-555555555555" });
  if (change === "generation") s.change({ actorGeneration: 2 });
  if (change === "document") current = false;
  if (change === "original-grant") s.revoke();
  finish(resolution()); expect(await pending).toMatchObject({ kind: "unknown", reason: change === "original-grant" ? "forbidden" : "stale-scope" });
});
it("keeps an old host's context 404 unavailable and retries discovery only on another explicit call", async () => {
  const s = setup(), frozen = await freezeWeb4Operation(fixture("sales-create-intent"), identity);
  s.request.mockRejectedValue(new HttpError(404, { error: { code: "NotFound", message: "missing", details: [] } }));
  expect(await s.port.read(frozen, s.context)).toMatchObject({ kind: "unknown", reason: "unsupported-host" });
  expect(s.request).toHaveBeenCalledOnce(); await s.port.read(frozen, s.context); expect(s.request).toHaveBeenCalledTimes(2);
});
it.each(["contractVersion", "actorUserId", "deploymentEpoch", "operationId", "operationKind", "method", "routeScope", "requestTargetId", "requestFingerprint", "state", "outcome", "terminal"])("rejects missing resolution member %s", async field => {
  const s = setup(), data = resolution(); delete data[field];
  s.request.mockImplementation(async path => path.endsWith("/context") ? contextValue() : data);
  expect(await s.port.read(await freezeWeb4Operation(fixture("sales-create-intent"), identity), s.context)).toMatchObject({ kind: "unknown", reason: "invalid-response" });
});
it.each([
  ["actor", (r: any) => { r.actorUserId = 43; }], ["actor type", (r: any) => { r.actorUserId = "42"; }],
  ["epoch", (r: any) => { r.deploymentEpoch = "22222222-2222-4333-8444-555555555555"; }],
  ["UUID casing", (r: any) => { r.operationId = r.operationId.toUpperCase(); }],
  ["UUID newline", (r: any) => { r.operationId += "\n"; }],
  ["operation ID", (r: any) => { r.operationId = "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee"; }],
  ["original kind", (r: any) => { r.operationKind = "Receipt.Create"; }],
  ["method", (r: any) => { r.method = "PUT"; }], ["route", (r: any) => { r.routeScope = "/api/v1/goods-receipts"; }],
  ["Create target", (r: any) => { r.requestTargetId = "1"; }], ["fingerprint", (r: any) => { r.requestFingerprint = "0".repeat(64); }],
  ["contract", (r: any) => { r.contractVersion = "web4-v1"; }], ["state", (r: any) => { r.state = "CANCELLED"; }],
  ["extra field", (r: any) => { r.private = "not allowed"; }],
  ["negative result", (r: any) => { r.outcome = fixture("sales-create-response"); }], ["missing certificate", (r: any) => { r.terminal = null; }],
  ["terminal extra field", (r: any) => { r.terminal.operator = "not allowed"; }],
  ["non-v4 decision", (r: any) => { r.terminal.decisionId = "77777777-7777-1777-8777-777777777777"; }],
  ["case empty", (r: any) => { r.terminal.caseId = ""; }], ["case too long", (r: any) => { r.terminal.caseId = "x".repeat(129); }],
  ["case newline", (r: any) => { r.terminal.caseId = "case\n"; }], ["case content", (r: any) => { r.terminal.caseId = "secret=payload"; }],
  ["timestamp precision", (r: any) => { r.terminal.decidedAtUtc = "2026-11-02T09:10:11.123Z"; }],
  ["timestamp calendar", (r: any) => { r.terminal.decidedAtUtc = "2026-02-30T09:10:11.1234567Z"; }],
  ["timestamp offset", (r: any) => { r.terminal.decidedAtUtc = "2026-11-02T09:10:11.1234567+00:00"; }],
  ["timestamp newline", (r: any) => { r.terminal.decidedAtUtc += "\n"; }],
] as const)("rejects malformed or foreign negative %s", async (_name, change) => {
  const s = setup(), data = resolution(); change(data);
  s.request.mockImplementation(async path => path.endsWith("/context") ? contextValue() : data);
  expect(await s.port.read(await freezeWeb4Operation(fixture("sales-create-intent"), identity), s.context)).toMatchObject({ kind: "unknown", reason: "invalid-response" });
});
it.each([
  ["wrong version", (v: any) => { v.contractVersion = "web4-v1"; }], ["wrong actor", (v: any) => { v.actorUserId = 43; }],
  ["wrong epoch", (v: any) => { v.deploymentEpoch = "22222222-2222-4333-8444-555555555555"; }],
  ["epoch alias", (v: any) => { v.deploymentEpoch += "\n"; }],
  ["resend enabled", (v: any) => { v.sameKeyResendEnabled = true; }], ["resend missing", (v: any) => { delete v.sameKeyResendEnabled; }],
  ["extra field", (v: any) => { v.capability = true; }],
] as const)("refuses invalid discovery %s before resolution HTTP", async (_name, change) => {
  const s = setup(), data = contextValue(); change(data); s.request.mockResolvedValue(data);
  expect(await s.port.read(await freezeWeb4Operation(fixture("sales-create-intent"), identity), s.context)).toMatchObject({ kind: "unknown", reason: "invalid-response" });
  expect(s.request).toHaveBeenCalledOnce();
});
it("preserves a valid maximum-length operator lookup ID without broadening authority", async () => {
  const s = setup(), data = resolution(); data.terminal.caseId = "x".repeat(128);
  s.request.mockImplementation(async path => path.endsWith("/context") ? contextValue() : data);
  const result = await s.port.read(await freezeWeb4Operation(fixture("sales-create-intent"), identity), s.context);
  expect(result).toEqual({ kind: "not-executed", certificate: data });
});
it.each(["COMMITTED", "RESULT_EXPIRED", "RESULT_UNAVAILABLE", "INDETERMINATE"])("does not accept a terminal certificate in %s", async state => {
  const s = setup(), data = resolution("sales-create", state); data.terminal = terminal;
  s.request.mockImplementation(async path => path.endsWith("/context") ? contextValue() : data);
  expect(await s.port.read(await freezeWeb4Operation(fixture("sales-create-intent"), identity), s.context)).toMatchObject({ kind: "unknown", reason: "invalid-response" });
});
it.each(["sales-post", "receipt-post"])("preserves original version semantics for %s", async stem => {
  const s = setup(stem), data = resolution(stem, "COMMITTED");
  if (stem === "sales-post") delete data.outcome.data.version; else data.outcome.data.version = "AAAAAAAAAAE=";
  s.request.mockImplementation(async path => path.endsWith("/context") ? contextValue() : data);
  expect(await s.port.read(await freezeWeb4Operation(fixture(`${stem}-intent`), identity), s.context)).toMatchObject({ kind: "unknown", reason: "invalid-response" });
});
it("bounds response bytes rather than allowing an oversized UTF-8 outcome", async () => {
  const s = setup(), data = resolution("sales-create", "COMMITTED"); data.outcome.data.note = "ệ".repeat(400000);
  s.request.mockImplementation(async path => path.endsWith("/context") ? contextValue() : data);
  expect(await s.port.read(await freezeWeb4Operation(fixture("sales-create-intent"), identity), s.context)).toMatchObject({ kind: "unknown", reason: "invalid-response" });
});
it.each([[400, "unavailable"], [401, "unavailable"], [403, "forbidden"], [404, "not-observed"], [409, "unavailable"], [503, "unavailable"]] as const)("HTTP %i cannot mint a negative or cause operation replay", async (status, reason) => {
  const s = setup(); s.request.mockImplementation(async path => {
    if (path.endsWith("/context")) return contextValue();
    throw new HttpError(status, { error: { code: "Operation.NotObserved", message: "Controlled error", details: [], correlationId: "case-42" } });
  });
  expect(await s.port.read(await freezeWeb4Operation(fixture("sales-create-intent"), identity), s.context)).toEqual({ kind: "unknown", reason, correlationId: "case-42" });
  expect(s.request).toHaveBeenCalledTimes(2);
});
it("rediscovers context for a new actor generation rather than reusing the old admission", async () => {
  const s = setup(), frozen = await freezeWeb4Operation(fixture("sales-create-intent"), identity); await s.port.read(frozen, s.context);
  s.change({ actorGeneration: 2 }); await s.port.read(frozen, { ...s.context, actorGeneration: 2 });
  expect(s.request.mock.calls.filter(([path]) => path.endsWith("/context"))).toHaveLength(2);
});
it("does not continue from discovery after original authorization is revoked", async () => {
  const s = setup(), frozen = await freezeWeb4Operation(fixture("sales-create-intent"), identity);
  let finish!: (value: unknown) => void; s.request.mockImplementation(() => new Promise(done => { finish = done; }));
  const pending = s.port.read(frozen, s.context); await vi.waitFor(() => expect(s.request).toHaveBeenCalledOnce());
  s.revoke(); finish(contextValue()); expect(await pending).toMatchObject({ kind: "unknown", reason: "forbidden" }); expect(s.request).toHaveBeenCalledOnce();
});
it("uses strict transport parsing to reject duplicate resolution JSON members", async () => {
  const s = setup(), data = JSON.stringify({ data: resolution() }).replace('"state":"NOT_EXECUTED"', '"state":"NOT_EXECUTED","state":"NOT_EXECUTED"');
  const fetcher = vi.fn<typeof fetch>(async path => new Response(String(path).endsWith("/context") ? JSON.stringify(resolutionFixture("context-response")) : data));
  const port = createOperationResolutionPort(createHttpTransport(s.auth, fetcher), s.auth);
  expect(await port.read(await freezeWeb4Operation(fixture("sales-create-intent"), identity), s.context)).toMatchObject({ kind: "unknown", reason: "invalid-response" });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each([201, 202, 206])("requires canonical 200 from resolution rather than HTTP %i", async status => {
  const s = setup(), fetcher = vi.fn<typeof fetch>(async path => new Response(JSON.stringify(String(path).endsWith("/context") ? resolutionFixture("context-response") : { data: resolution() }), { status: String(path).endsWith("/context") ? 200 : status }));
  expect(await createOperationResolutionPort(createHttpTransport(s.auth, fetcher), s.auth).read(await freezeWeb4Operation(fixture("sales-create-intent"), identity), s.context)).toMatchObject({ kind: "unknown", reason: "invalid-response" });
});
