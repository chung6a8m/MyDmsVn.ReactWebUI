import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createOperationStatusPort, decodeWeb4OperationOutcome, decodeWeb4OperationStatus } from "../../../src/infrastructure/http/operationStatusPort";
import { freezeWeb4Operation } from "../../../src/infrastructure/http/web4OperationCodec";
import { HttpError } from "../../../src/infrastructure/http/authApi";
import { createHttpTransport } from "../../../src/infrastructure/http/httpTransport";
import type { AuthSession } from "../../../src/infrastructure/http/authSession";
import type { HttpTransport } from "../../../src/infrastructure/http/readBoundary";
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/web4-v1/corpus/${name}.json`, import.meta.url), "utf8"));
const identity = { operationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", deploymentEpoch: "11111111-2222-4333-8444-555555555555", actorKey: "42" };
const stems = ["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"];
function setup() {
  const state = { status: "authenticated", actorKey: "42", actorGeneration: 1, deploymentEpoch: identity.deploymentEpoch };
  const auth = { getSnapshot: () => state, access: async () => "test-token", refresh: vi.fn(), expire: vi.fn() } as unknown as AuthSession;
  const context = { actorKey: "42", actorGeneration: 1, deploymentEpoch: identity.deploymentEpoch, signal: new AbortController().signal };
  const request = vi.fn<HttpTransport["request"]>(async () => fixture("sales-create-status").data);
  return { state, auth, context, request, port: createOperationStatusPort({ request }, auth) };
}

describe("protected WEB4 operation status", () => {
  it.each(stems)("recovers exact original authorized wire result without a document GET: %s", async stem => {
    const frozen = await freezeWeb4Operation(fixture(`${stem}-intent`), identity);
    const status = fixture(`${stem}-status`).data;
    const { port, request, context } = setup(); request.mockResolvedValue(status);
    const result = await port.read(frozen, context);
    expect(result).toEqual({ kind: "committed", operationKind: frozen.request.operationKind, value: fixture(`${stem}-response`).data });
    expect(request).toHaveBeenCalledOnce();
    const [path, init] = request.mock.calls[0];
    expect(path).toBe(`/api/v1/operations/${identity.operationId}`);
    expect(init).toMatchObject({ method: "GET", strictResponse: true, signal: context.signal });
    const headers = new Headers(init?.headers);
    expect(headers.get("X-MyDmsVn-Deployment-Epoch")).toBe(identity.deploymentEpoch);
    expect(headers.get("X-MyDmsVn-Operation-Fingerprint")).toBe(status.requestFingerprint);
    expect(headers.has("Idempotency-Key")).toBe(false);
    expect(init?.body).toBeUndefined();
  });

  it.each(stems)("validates a direct keyed write outcome against the same immutable request: %s", async stem => {
    const frozen = await freezeWeb4Operation(fixture(`${stem}-intent`), identity);
    const data = fixture(`${stem}-response`).data;
    expect(decodeWeb4OperationOutcome(frozen.request, data)).toEqual({ kind: "committed", operationKind: frozen.request.operationKind, value: data });
    expect(() => decodeWeb4OperationOutcome(frozen.request, { ...data, authorization: "private" })).toThrow();
  });

  it.each(["operationId", "deploymentEpoch", "operationKind", "method", "routeScope", "requestTargetId", "requestFingerprint", "state", "outcome"])("rejects missing protected metadata: %s", async field => {
    const frozen = await freezeWeb4Operation(fixture("sales-create-intent"), identity);
    const status = fixture("sales-create-status").data; delete status[field];
    const { port, request, context } = setup(); request.mockResolvedValue(status);
    expect(await port.read(frozen, context)).toMatchObject({ kind: "unknown", reason: "invalid-response" });
  });

  it.each([
    ["operationId", "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee"],
    ["deploymentEpoch", "22222222-2222-4333-8444-555555555555"],
    ["operationKind", "Receipt.Create"], ["method", "PUT"], ["routeScope", "/api/v1/goods-receipts"],
    ["requestTargetId", "9223372036854775807"], ["requestFingerprint", "0".repeat(64)], ["state", "ROLLED_BACK"], ["secret", "not-permitted"],
  ])("rejects mismatched or unexpected status field %s", async (field, value) => {
    const frozen = await freezeWeb4Operation(fixture("sales-create-intent"), identity);
    const status = fixture("sales-create-status").data; status[field] = value;
    expect(() => decodeWeb4OperationStatus(status, frozen)).toThrow();
  });

  it.each([
    ["different note", (value: any) => { value.note = "different"; }],
    ["different product", (value: any) => { value.lines[0].productId = 105; }],
    ["line reorder", (value: any) => { value.lines.reverse(); }],
    ["wrong totals", (value: any) => { value.totalAmount = "1.0000"; }],
    ["wrong rounding", (value: any) => { value.lines[1].lineAmount = "0.0000"; }],
    ["inactive original reference", (value: any) => { value.customerIsActive = false; }],
    ["future detail version", (value: any) => { value.version = "not-a-rowversion"; }],
    ["missing original field", (value: any) => { delete value.customerDisplayName; }],
    ["added cost", (value: any) => { value.totalCost = "1.0000"; }],
    ["changed status", (value: any) => { value.status = "Posted"; }],
  ])("rejects malformed original Sales outcome: %s", async (_name, change) => {
    const frozen = await freezeWeb4Operation(fixture("sales-create-intent"), identity);
    const status = fixture("sales-create-status").data; change(status.outcome.data);
    expect(() => decodeWeb4OperationStatus(status, frozen)).toThrow();
  });

  it("requires Update and Post outcomes to refer to the original target", async () => {
    for (const stem of ["sales-update", "sales-post", "receipt-update", "receipt-post"]) {
      const frozen = await freezeWeb4Operation(fixture(`${stem}-intent`), identity);
      const status = fixture(`${stem}-status`).data;
      status.outcome.data[stem.startsWith("sales") ? "saleId" : "receiptId"] = "1";
      expect(() => decodeWeb4OperationStatus(status, frozen), stem).toThrow();
    }
  });

  it("keeps Sales Post version mandatory and Receipt Post version absent", async () => {
    for (const stem of ["sales-post", "receipt-post"]) {
      const frozen = await freezeWeb4Operation(fixture(`${stem}-intent`), identity);
      const status = fixture(`${stem}-status`).data;
      if (stem === "sales-post") delete status.outcome.data.version;
      else status.outcome.data.version = "AAAAAAAAAAE=";
      expect(() => decodeWeb4OperationStatus(status, frozen)).toThrow();
    }
  });

  it.each(["expired", "unavailable"])("retains UNKNOWN for positive metadata with result %s", async suffix => {
    const frozen = await freezeWeb4Operation(fixture("sales-create-intent"), identity);
    const { port, request, context } = setup(); request.mockResolvedValue(fixture(`status-result-${suffix}`).data);
    expect(await port.read(frozen, context)).toEqual({ kind: "unknown", reason: `result-${suffix}` });
  });

  it.each([[404, "not-observed"], [403, "forbidden"], [410, "result-expired"], [503, "unavailable"]] as const)("HTTP %i never permits a new write or retries the operation", async (status, reason) => {
    const frozen = await freezeWeb4Operation(fixture("sales-create-intent"), identity);
    const { port, request, context } = setup(); request.mockRejectedValue(new HttpError(status, fixture("error-operation-notobserved")));
    expect(await port.read(frozen, context)).toMatchObject({ kind: "unknown", reason });
    expect(request).toHaveBeenCalledOnce();
  });

  it("refuses a corrupted stored hash before sending any request", async () => {
    const frozen = { ...await freezeWeb4Operation(fixture("sales-create-intent"), identity), requestFingerprint: "0".repeat(64) };
    const { port, request, context } = setup();
    expect(await port.read(frozen, context)).toEqual({ kind: "unknown", reason: "invalid-intent" });
    expect(request).not.toHaveBeenCalled();
  });

  it.each(["actor", "epoch", "generation", "document"])("rejects a late result after changed %s", async field => {
    const frozen = await freezeWeb4Operation(fixture("sales-create-intent"), identity);
    const { port, request, context, state } = setup();
    let resolve!: (value: unknown) => void;
    let dispatched!: () => void;
    const sent = new Promise<void>(done => { dispatched = done; });
    request.mockImplementation(() => { dispatched(); return new Promise(done => { resolve = done; }); });
    let current = true;
    const pending = port.read(frozen, context, () => current);
    await sent;
    if (field === "actor") state.actorKey = "43";
    if (field === "epoch") state.deploymentEpoch = "22222222-2222-4333-8444-555555555555";
    if (field === "generation") state.actorGeneration++;
    if (field === "document") current = false;
    resolve(fixture("sales-create-status").data);
    expect(await pending).toEqual({ kind: "unknown", reason: "stale-scope" });
  });

  it("rechecks epoch after asynchronous local fingerprint verification before dispatch", async () => {
    const frozen = await freezeWeb4Operation(fixture("sales-create-intent"), identity);
    const { port, request, context, state } = setup();
    const pending = port.read(frozen, context);
    state.deploymentEpoch = "22222222-2222-4333-8444-555555555555";
    expect(await pending).toEqual({ kind: "unknown", reason: "stale-scope" });
    expect(request).not.toHaveBeenCalled();
  });

  it("uses the strict transport parser to reject duplicate JSON members", async () => {
    const frozen = await freezeWeb4Operation(fixture("sales-create-intent"), identity);
    const { auth, context } = setup();
    const source = JSON.stringify(fixture("sales-create-status")).replace('"state":"COMMITTED"', '"state":"COMMITTED","state":"COMMITTED"');
    const fetcher = vi.fn<typeof fetch>(async () => new Response(source));
    const port = createOperationStatusPort(createHttpTransport(auth, fetcher), auth);
    expect(await port.read(frozen, context)).toEqual({ kind: "unknown", reason: "invalid-response" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([201, 202, 206])("rejects noncanonical successful HTTP status %i", async status => {
    const frozen = await freezeWeb4Operation(fixture("sales-create-intent"), identity);
    const { auth, context } = setup();
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(fixture("sales-create-status")), { status }));
    const port = createOperationStatusPort(createHttpTransport(auth, fetcher), auth);
    expect(await port.read(frozen, context)).toEqual({ kind: "unknown", reason: "invalid-response" });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
