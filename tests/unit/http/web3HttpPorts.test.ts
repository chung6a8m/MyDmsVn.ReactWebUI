import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import type { GoodsReceiptSaveSnapshot } from "../../../src/features/goodsReceipt/contracts";
import { createAuthSession } from "../../../src/infrastructure/http/authSession";
import { createHttpTransport } from "../../../src/infrastructure/http/httpTransport";
import { createGoodsReceiptHttpPort } from "../../../src/infrastructure/http/goodsReceiptHttpPort";
import { createInventoryHttpPort } from "../../../src/infrastructure/http/inventoryHttpPort";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/web3-v1/${name}`, import.meta.url), "utf8"));
const created = fixture("receipt-create-response.json");
const receiptId = "9007199254740993";
function snapshot(update = false): GoodsReceiptSaveSnapshot {
  const request = fixture(update ? "receipt-update-request.json" : "receipt-create-request.json");
  return { ...request, warehouseId: String(request.warehouseId), employeeId: String(request.employeeId), receiptId: update ? receiptId : null, expectedVersion: update ? request.expectedVersion : null, lines: request.lines.map((line: { productId: number }, index: number) => ({ ...line, productId: String(line.productId), clientLineId: `client-${index}`, receiptLineId: `old-${index}` })) };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function setup() {
  const values = new Map<string, string>();
  const fetcher = vi.fn<typeof fetch>();
  const response = (data: unknown) => new Response(JSON.stringify({ data }));
  const user = { userId: 1, username: "a", displayName: "A" };
  const auth = createAuthSession({ fetch: fetcher, storage: { getItem: k => values.get(k) ?? null, setItem: (k,v) => { values.set(k,v); }, removeItem: k => { values.delete(k); } }, lock: async work => work(), notify: () => {} });
  fetcher.mockResolvedValueOnce(response({ accessToken: `e30.${btoa(JSON.stringify({ sid: "s1", exp: 9999999999 }))}.signature`, expiresAtUtc: "2286-11-20T17:46:39Z", user })).mockResolvedValueOnce(response(user)).mockResolvedValueOnce(response({ read: true, write: true, post: true }));
  await auth.login("a", "secret"); fetcher.mockClear();
  const controller = new AbortController();
  const context = { ...auth.getSnapshot(), signal: controller.signal };
  const transport = createHttpTransport(auth, fetcher);
  return { auth, fetcher, controller, context, receipts: createGoodsReceiptHttpPort(transport, auth), inventory: createInventoryHttpPort(transport, auth) };
}

it("creates with authorized business fields only, preserving precise strings and local identities", async () => {
  const s = await setup(); s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(created)));
  const result = await s.receipts.save(snapshot(), s.context);
  expect(result.kind).toBe("success");
  const [url, init] = s.fetcher.mock.calls[0];
  expect(url).toBe("/api/v1/goods-receipts"); expect(init?.method).toBe("POST");
  expect(JSON.parse(init?.body as string)).toEqual(fixture("receipt-create-request.json"));
  expect(new Headers(init?.headers).get("Authorization")).toMatch(/^Bearer /);
  expect(init).not.toHaveProperty("strictResponse");
  if (result.kind === "success") {
    expect(result.value.saved.lines.map(line => line.clientLineId)).toEqual(["client-0", "client-1"]);
    expect(result.value.lines.map(line => line.receiptLineId)).toEqual(["9007199254740994", "9007199254740995"]);
    expect(result.value.references.warehouse).toEqual({ id: "1", displayName: null, isActive: true });
    expect(result.value.saved.note).toBeNull();
  }
});
it("updates as full replacement without old line IDs and keeps stable client IDs", async () => {
  const s = await setup(); s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(fixture("receipt-update-response.json"))));
  const result = await s.receipts.save(snapshot(true), s.context);
  expect(result.kind).toBe("success");
  const [url, init] = s.fetcher.mock.calls[0];
  expect(url).toBe(`/api/v1/goods-receipts/${receiptId}/draft`); expect(init?.method).toBe("PUT");
  expect(JSON.parse(init?.body as string)).toEqual(fixture("receipt-update-request.json"));
  if (result.kind === "success") expect(result.value.lines.map(line => line.clientLineId)).toEqual(["client-0", "client-1"]);
});
it.each(["identity", "posted", "cardinality", "reorder", "product", "lineNumber", "version", "extra"]) ("dispatched Save %s mismatch stays outcome unknown", async mismatch => {
  const s = await setup(), body = fixture("receipt-update-response.json");
  if (mismatch === "identity") body.data.receiptId = "1";
  if (mismatch === "posted") { body.data.status = "Posted"; body.data.postedAtUtc = "2026-11-01T00:00:00Z"; }
  if (mismatch === "cardinality") body.data.lines.pop();
  if (mismatch === "reorder") { body.data.lines.reverse(); body.data.lines.forEach((line: {lineNumber:number}, i: number) => { line.lineNumber = i + 1; }); }
  if (mismatch === "product") body.data.lines[0].productId = 10;
  if (mismatch === "lineNumber") body.data.lines[0].lineNumber = 2;
  if (mismatch === "version") body.data.version = "opaque";
  if (mismatch === "extra") body.data.totalAmount = "0";
  s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(body)));
  expect(await s.receipts.save(snapshot(true), s.context)).toEqual({ kind: "outcome-unknown" });
  expect(s.fetcher).toHaveBeenCalledTimes(1);
});
it("captures snapshot before the first await and maps server field indexes to captured row IDs", async () => {
  const s = await setup(), pending = deferred<Response>(), started = deferred<void>();
  s.fetcher.mockImplementationOnce(async () => { started.resolve(); return pending.promise; });
  const input = snapshot(); const result = s.receipts.save(input, s.context);
  input.receiptDate = "bad";
  input.lines = [{ ...input.lines[1], clientLineId: "new-current-id" }, input.lines[0]];
  await started.promise;
  expect(JSON.parse(s.fetcher.mock.calls[0][1]?.body as string)).toEqual(fixture("receipt-create-request.json"));
  pending.resolve(new Response(JSON.stringify(fixture("error-400-fields.json")), { status: 400 }));
  const outcome = await result;
  expect(outcome.kind).toBe("failed");
  if (outcome.kind === "failed") expect(outcome.error.issues).toEqual(expect.arrayContaining([expect.objectContaining({ clientLineId: "client-0", field: "quantity:client-0" })]));
});
it.each(["duplicate", "empty", "201", "product", "quantity", "catalog", "version"])("invalid %s Save is rejected before dispatch", async invalid => {
  const s = await setup(), input = snapshot();
  if (invalid === "duplicate") input.lines = [input.lines[0], { ...input.lines[1], productId: input.lines[0].productId }];
  if (invalid === "empty") input.lines = [];
  if (invalid === "201") input.lines = Array.from({ length: 201 }, (_, i) => ({ ...input.lines[0], productId: String(i + 1) }));
  if (invalid === "product") input.lines = [{ ...input.lines[0], productId: null }];
  if (invalid === "quantity") input.lines = [{ ...input.lines[0], quantity: "1.00001" }];
  if (invalid === "catalog") input.warehouseId = "2147483648";
  if (invalid === "version") { input.receiptId = receiptId; input.expectedVersion = null; }
  expect(await s.receipts.save(input, s.context)).toMatchObject({ kind: "failed", dispatched: false });
  expect(s.fetcher).not.toHaveBeenCalled();
});
it("Post returns only its acknowledgement; later denied Get cannot reverse Posted confirmation", async () => {
  const s = await setup(); s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(fixture("receipt-post-response.json"))));
  const result = await s.receipts.post({ receiptId, expectedVersion: "AAAAAAAAAAI=" }, s.context);
  expect(result).toEqual({ kind: "success", value: fixture("receipt-post-response.json").data });
  expect(JSON.parse(s.fetcher.mock.calls[0][1]?.body as string)).toEqual({ expectedVersion: "AAAAAAAAAAI=" });
  s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(fixture("error-403-forbidden.json")), { status: 403 }));
  expect(await s.receipts.get(receiptId, s.context)).toMatchObject({ kind: "failed", error: { kind: "forbidden" } });
  expect(result).toEqual({ kind: "success", value: fixture("receipt-post-response.json").data });
});
it.each(["version", "identity"])("Post %s mismatch is unknown", async mismatch => {
  const s = await setup(), body = fixture("receipt-post-response.json");
  if (mismatch === "version") body.data.version = "AAAAAAAAAAM="; else body.data.receiptId = "1";
  s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(body)));
  expect(await s.receipts.post({ receiptId, expectedVersion: "AAAAAAAAAAI=" }, s.context)).toEqual({ kind: "outcome-unknown" });
});
it.each([403, 409, 401, 500])("Save HTTP %i has scoped failure semantics and never replays", async status => {
  const s = await setup(); const file = status === 403 ? "error-403-forbidden.json" : status === 409 ? "error-409-stale-version.json" : status === 401 ? "error-401-unauthorized.json" : "error-500-internal.json";
  s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(fixture(file)), { status }));
  const result = await s.receipts.save(snapshot(), s.context);
  expect(result.kind).toBe(status === 403 || status === 409 ? "failed" : "outcome-unknown");
  expect(s.fetcher).toHaveBeenCalledTimes(1);
});
it.each(["network", "abort", "actor"])("dispatched Save %s remains unknown with one write", async action => {
  const s = await setup(), pending = deferred<Response>(), started = deferred<void>();
  s.fetcher.mockImplementationOnce(async () => { started.resolve(); return pending.promise; });
  const result = s.receipts.save(snapshot(), s.context); await started.promise;
  if (action === "abort") s.controller.abort();
  if (action === "actor") s.auth.expire();
  pending.reject(new Error("lost reply"));
  expect(await result).toEqual({ kind: "outcome-unknown" }); expect(s.fetcher).toHaveBeenCalledTimes(1);
});
it("preflight stale actor and cancellation prevent all feature requests", async () => {
  const s = await setup(); s.controller.abort();
  expect(await s.receipts.save(snapshot(), s.context)).toMatchObject({ kind: "failed", dispatched: false });
  expect(await s.inventory.balances({ pageNumber: 1, pageSize: 25 }, s.context)).toMatchObject({ kind: "failed" });
  expect(s.fetcher).not.toHaveBeenCalled();
});
it("late reads are fenced after actor change", async () => {
  const s = await setup(), pending = deferred<Response>(), started = deferred<void>();
  s.fetcher.mockImplementationOnce(async () => { started.resolve(); return pending.promise; });
  const result = s.receipts.get(receiptId, s.context); await started.promise; s.auth.expire(); pending.resolve(new Response(JSON.stringify(created)));
  expect(await result).toMatchObject({ kind: "failed", error: { kind: "unauthorized" } });
});
it("independent inventory projections preserve nulls, signed decimals, int64 identities and counts", async () => {
  const s = await setup();
  s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(fixture("balances-zero-response.json")))).mockResolvedValueOnce(new Response(JSON.stringify(fixture("stock-card-response.json"))));
  const balances = await s.inventory.balances({ pageNumber: 1, pageSize: 25, warehouseId: "1", productId: "7", search: "hàng" }, s.context);
  const card = await s.inventory.stockCard({ pageNumber: 1, pageSize: 25, warehouseId: "1", productId: "7", fromUtc: "2026-11-01T02:03:04Z" }, s.context);
  expect(balances.kind).toBe("success"); expect(card.kind).toBe("success");
  if (balances.kind === "success") { expect(balances.value.items[0].averageUnitCost).toBeNull(); expect(balances.value.totalCount).toBe("1"); expect(balances.value.items[0].warehouseId).toBe("1"); }
  if (card.kind === "success") { expect(card.value.items[1].quantityChange).toBe("-4.0000"); expect(card.value.items[0].ledgerId).toBe("9007199254740993"); }
  expect(s.fetcher.mock.calls[0][0]).toBe("/api/v1/inventory/balances?pageNumber=1&pageSize=25&warehouseId=1&productId=7&search=h%C3%A0ng");
  expect(s.fetcher.mock.calls[1][0]).toBe("/api/v1/inventory/stock-card?pageNumber=1&pageSize=25&warehouseId=1&productId=7&fromUtc=2026-11-01T02%3A03%3A04Z");
});
it("Receipt list is full detail with explicit paging and exact count", async () => {
  const s = await setup(); s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(fixture("receipt-list-response.json"))));
  const result = await s.receipts.list({ pageNumber: 1, pageSize: 25, status: "Draft" }, s.context);
  expect(result.kind).toBe("success");
  if (result.kind === "success") { expect(result.value.totalCount).toBe("1"); expect(result.value.items[0].receiptId).toBe(receiptId); }
  expect(s.fetcher.mock.calls[0][0]).toBe("/api/v1/goods-receipts?pageNumber=1&pageSize=25&status=Draft");
});
it.each([{}, { pageNumber: 0, pageSize: 25 }, { pageNumber: 1, pageSize: 201 }, { pageNumber: 2147483648, pageSize: 25 }, { pageNumber: 1, pageSize: 25, cursor: "x" }, { pageNumber: 1, pageSize: 25, warehouseId: "01" }])("invalid inventory query %j does not dispatch", async query => {
  const s = await setup(); expect(await s.inventory.balances(query as never, s.context)).toMatchObject({ kind: "failed" }); expect(s.fetcher).not.toHaveBeenCalled();
});
it("strict errors cannot prove a rejection with missing details", async () => {
  const s = await setup(); s.fetcher.mockResolvedValueOnce(new Response('{"error":{"code":"ValidationError","message":"invalid"}}', { status: 400 }));
  expect(await s.receipts.save(snapshot(), s.context)).toEqual({ kind: "outcome-unknown" });
});
it("strict response reading is applied at actual feature transport", async () => {
  const s = await setup(); s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(created).replace('"data":', '"data":{},"data":')));
  expect(await s.receipts.save(snapshot(), s.context)).toEqual({ kind: "outcome-unknown" });
});
it("Save deadline leaves dispatched mutation unknown without retry", async () => {
  const s = await setup(), started = deferred<void>(), pending = deferred<Response>();
  vi.useFakeTimers();
  try {
    s.fetcher.mockImplementationOnce(async () => { started.resolve(); return pending.promise; });
    const result = s.receipts.save(snapshot(), s.context); await started.promise;
    await vi.advanceTimersByTimeAsync(30000);
    expect(await result).toEqual({ kind: "outcome-unknown" });
    expect(s.fetcher).toHaveBeenCalledTimes(1);
    pending.resolve(new Response(JSON.stringify(created)));
  } finally { vi.useRealTimers(); }
});
it.each(["wrong identity", "bad number", "missing null", "malformed UTF8"])("Get %s fails protocol without fabricating detail", async invalid => {
  const s = await setup(), body = structuredClone(created);
  if (invalid === "wrong identity") body.data.receiptId = "1";
  if (invalid === "bad number") body.data.receiptNumber = "GRinvalid";
  if (invalid === "missing null") delete body.data.note;
  const response = invalid === "malformed UTF8" ? new Response(new Uint8Array([123,34,100,97,116,97,34,58,34,192,175,34,125])) : new Response(JSON.stringify(body));
  s.fetcher.mockResolvedValueOnce(response);
  expect(await s.receipts.get(receiptId, s.context)).toMatchObject({ kind: "failed", error: { kind: "protocol" } });
});
it("immutable captured input also owns successful Save row IDs", async () => {
  const s = await setup(), pending = deferred<Response>(), started = deferred<void>();
  s.fetcher.mockImplementationOnce(async () => { started.resolve(); return pending.promise; });
  const input = snapshot(), result = s.receipts.save(input, s.context);
  input.lines[0].clientLineId = "mutated";
  input.lines[0].productId = "999";
  await started.promise; pending.resolve(new Response(JSON.stringify(created)));
  const outcome = await result;
  expect(outcome.kind).toBe("success");
  if (outcome.kind === "success") expect(outcome.value.saved.lines[0]).toMatchObject({ clientLineId: "client-0", productId: "7" });
});
it("stock card required key and UTC range reject before dispatch", async () => {
  const s = await setup();
  for (const query of [
    { pageNumber: 1, pageSize: 25, warehouseId: "1" },
    { pageNumber: 1, pageSize: 25, warehouseId: "1", productId: "7", fromUtc: "2026-11-02T00:00:00Z", toUtc: "2026-11-01T00:00:00Z" },
  ]) expect(await s.inventory.stockCard(query as never, s.context)).toMatchObject({kind:"failed"});
  expect(s.fetcher).not.toHaveBeenCalled();
});
it("server duplicate-product field maps to stable product editor and fieldless errors stay visible", async () => {
  const s = await setup();
  s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(fixture("error-400-duplicate-product.json")), { status: 400 }));
  const duplicate = await s.receipts.save(snapshot(), s.context);
  expect(duplicate).toMatchObject({ kind: "failed", error: { issues: [expect.objectContaining({ clientLineId: "client-1", field: "product:client-1" })] } });
  s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(fixture("error-400-valuation-post.json")), { status: 400 }));
  const fieldless = await s.receipts.post({ receiptId, expectedVersion: "AAAAAAAAAAI=" }, s.context);
  expect(fieldless).toMatchObject({ kind: "failed", error: { issues: [expect.objectContaining({ field: "" })] } });
});
it("inventory calls can complete independently in reverse order", async () => {
  const s = await setup(), balanceReply = deferred<Response>(), cardReply = deferred<Response>(), bothStarted = deferred<void>();
  let count = 0;
  s.fetcher.mockImplementation(async url => {
    if (++count === 2) bothStarted.resolve();
    return String(url).startsWith("/api/v1/inventory/balances?") ? balanceReply.promise : cardReply.promise;
  });
  const balances = s.inventory.balances({ pageNumber: 1, pageSize: 25 }, s.context);
  const card = s.inventory.stockCard({ pageNumber: 1, pageSize: 25, warehouseId: "1", productId: "7" }, s.context);
  await bothStarted.promise;
  cardReply.resolve(new Response(JSON.stringify(fixture("stock-card-response.json"))));
  expect(await card).toMatchObject({ kind: "success", value: { items: [expect.objectContaining({ ledgerId: "9007199254740993" }), expect.anything()] } });
  balanceReply.resolve(new Response(JSON.stringify(fixture("balances-zero-response.json"))));
  expect(await balances).toMatchObject({ kind: "success", value: { items: [expect.objectContaining({ averageUnitCost: null })] } });
});
it.each([{ pageNumber: 1, pageSize: 25, status: "draft" }, { pageNumber: 1, pageSize: 25, fromDate: "2026-11-01" }])("unsupported Receipt list query %j never dispatches", async query => {
  const s = await setup(); expect(await s.receipts.list(query as never, s.context)).toMatchObject({kind:"failed"}); expect(s.fetcher).not.toHaveBeenCalled();
});
