import { expect, it, vi } from "vitest";
import created from "../../fixtures/web2-v1/sales-create-response.json";
import posted from "../../fixtures/web2-v1/sales-post-response.json";
import { createAuthSession } from "../../../src/infrastructure/http/authSession";
import { createHttpTransport } from "../../../src/infrastructure/http/httpTransport";
import { createSalesHttpPort } from "../../../src/infrastructure/http/salesHttpPort";
import { mapSalesDetail } from "../../../src/infrastructure/http/salesWireMapper";
import { salesDetailSchema } from "../../../src/infrastructure/http/salesWireSchemas";
import { createWorkspaceRuntime } from "../../../src/app/workspace/panelRegistry";
import { createFakeCatalogPort } from "../../../src/infrastructure/fake/fakeCatalogPort";

async function setup() {
  const values = new Map<string, string>();
  const fetcher = vi.fn<typeof fetch>();
  const response = (data: unknown) => new Response(JSON.stringify({ data }));
  const user = { userId: 1, username: "a", displayName: "A" };
  const auth = createAuthSession({ fetch: fetcher, storage: { getItem: k => values.get(k) ?? null, setItem: (k,v) => { values.set(k,v); }, removeItem: k => { values.delete(k); } }, lock: async work => work(), notify: () => {} });
  fetcher.mockResolvedValueOnce(response({ accessToken: `e30.${btoa(JSON.stringify({ sid: "s1", exp: 9999999999 }))}.signature`, expiresAtUtc: "2286-11-20T17:46:39Z", user })).mockResolvedValueOnce(response(user)).mockResolvedValueOnce(response({ read: true, write: true, post: true }));
  await auth.login("a", "secret"); fetcher.mockClear();
  const transport = createHttpTransport(auth, fetcher);
  const context = { ...auth.getSnapshot(), signal: new AbortController().signal };
  const snapshot = mapSalesDetail(salesDetailSchema.parse(created.data)).saved;
  snapshot.lines = snapshot.lines.map((line,index) => ({ ...line, clientLineId: `client-${index}` }));
  return { auth, fetcher, context, snapshot, sales: createSalesHttpPort(transport, auth), response };
}

it("serializes only ordered business fields with zero new IDs and preserves duplicate products", async () => {
  const s = await setup(); s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(created)));
  const result = await s.sales.save({ ...s.snapshot, saleId: null, expectedVersion: null }, s.context);
  expect(result.kind).toBe("success");
  const [path, init] = s.fetcher.mock.calls[0];
  expect(path).toBe("/api/v1/sales-receipts"); expect(init?.method).toBe("POST");
  const body = JSON.parse(String(init?.body));
  expect(Object.keys(body).sort()).toEqual(["saleDate", "customerId", "warehouseId", "employeeId", "note", "lines"].sort());
  expect(body.lines.map((line: { saleLineId: string }) => line.saleLineId)).toEqual(s.snapshot.lines.map(() => "0"));
  expect(Object.keys(body.lines[0]).sort()).toEqual(["saleLineId", "productId", "qty", "unitPrice", "isGift"].sort());
  expect(body.lines.map((line: { productId: number }) => line.productId)).toEqual(s.snapshot.lines.map(line => Number(line.productId)));
  if (result.kind === "success") expect(result.value.lines.map(line => line.clientLineId)).toEqual(s.snapshot.lines.map(line => line.clientLineId));
});

it("update preserves independent retained IDs and version, Post returns ack", async () => {
  const s = await setup(); s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(created)));
  expect((await s.sales.save(s.snapshot, s.context)).kind).toBe("success");
  const [path, init] = s.fetcher.mock.calls[0];
  expect(path).toBe(`/api/v1/sales-receipts/${s.snapshot.saleId}/draft`); expect(init?.method).toBe("PUT");
  expect(JSON.parse(String(init?.body))).toMatchObject({ expectedVersion: s.snapshot.expectedVersion, lines: s.snapshot.lines.map(line => ({ saleLineId: line.saleLineId })) });
  s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(posted)));
  expect(await s.sales.post({ saleId: posted.data.saleId, expectedVersion: "opaque" }, s.context)).toEqual({ kind: "success", value: posted.data });
  expect(JSON.parse(String(s.fetcher.mock.calls[1][1]?.body))).toEqual({ expectedVersion: "opaque" });
});

it.each(["cardinality", "order", "duplicate", "retained", "receipt"])("dispatched save %s mismatch is unknown", async fault => {
  const s = await setup(); const data = structuredClone(created.data);
  if (fault === "cardinality") data.lines.pop();
  if (fault === "order") data.lines.reverse();
  if (fault === "duplicate") data.lines[1].saleLineId = data.lines[0].saleLineId;
  if (fault === "retained") data.lines[0].saleLineId = "99";
  if (fault === "receipt") data.saleId = "99";
  s.fetcher.mockResolvedValueOnce(s.response(data));
  expect(await s.sales.save(s.snapshot, s.context)).toEqual({ kind: "outcome-unknown" });
  expect(s.fetcher).toHaveBeenCalledTimes(1);
});

it.each([400,403,409])("known HTTP %i rejection keeps global and sent-row validation identity", async status => {
  const s = await setup();
  s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "Server.Rejected", message: "Rejected", details: [{ code: "Qty", field: "lines[1].qty", message: "Qty invalid" }, { code: "Global", message: "Global invalid" }] } }), { status }));
  const result = await s.sales.save(s.snapshot, s.context);
  expect(result).toMatchObject({ kind: "failed", error: { code: "Server.Rejected", issues: [{ field: "qty:client-1", clientLineId: "client-1" }, { field: "" }] } });
});

it.each(["network", "malformed", "401", "500", "abort", "actor"])("write %s after dispatch is unknown without replay", async fault => {
  const s = await setup();
  s.fetcher.mockImplementationOnce(async () => {
    if (fault === "network") throw Error("lost");
    if (fault === "abort") throw new DOMException("lost", "AbortError");
    if (fault === "actor") s.auth.expire();
    if (fault === "malformed") return new Response("{bad");
    if (fault === "401" || fault === "500") return new Response("{}", { status: Number(fault) });
    return new Response(JSON.stringify(created));
  });
  expect(await s.sales.save(s.snapshot, s.context)).toEqual({ kind: "outcome-unknown" });
  expect(s.fetcher).toHaveBeenCalledTimes(1);
});

it("wrong actor cannot dispatch and ack receipt mismatch stays unknown", async () => {
  const s = await setup();
  expect((await s.sales.save(s.snapshot, { ...s.context, actorKey: "other" })).kind).toBe("failed");
  expect(s.fetcher).not.toHaveBeenCalled();
  s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(posted)));
  expect(await s.sales.post({ saleId: "1", expectedVersion: "opaque" }, s.context)).toEqual({ kind: "outcome-unknown" });
});

it("200 ordered duplicate-product rows retain separate client/server identities and exact decimal strings", async () => {
  const s = await setup();
  const lines = Array.from({ length: 200 }, (_,index) => ({ ...created.data.lines[0], saleLineId: String(9007199254740993n + BigInt(index)), lineNo: index + 1, qty: "99999999999999.9999", unitPrice: "999999999999999.9999" }));
  const data = { ...created.data, lines };
  const snapshot = { ...s.snapshot, lines: lines.map((line,index) => ({ clientLineId: `row-${index}`, saleLineId: line.saleLineId, productId: String(line.productId), qty: line.qty, unitPrice: line.unitPrice, isGift: line.isGift })) };
  s.fetcher.mockResolvedValueOnce(s.response(data));
  const result = await s.sales.save(snapshot, s.context);
  expect(result.kind).toBe("success");
  const body = JSON.parse(String(s.fetcher.mock.calls[0][1]?.body));
  expect(body.lines).toHaveLength(200);
  expect(body.lines[199]).toMatchObject({ saleLineId: lines[199].saleLineId, qty: "99999999999999.9999", unitPrice: "999999999999999.9999" });
  if (result.kind === "success") expect(new Set(result.value.lines.map(line => line.clientLineId)).size).toBe(200);
});

it("validation follows immutable sent order when the caller reorders its original snapshot", async () => {
  const s = await setup();
  let reject!: (response: Response) => void;
  s.fetcher.mockImplementationOnce(() => new Promise(resolve => { reject = resolve; }));
  const saving = s.sales.save(s.snapshot, s.context);
  await vi.waitFor(() => expect(s.fetcher).toHaveBeenCalledTimes(1));
  s.snapshot.lines = [...s.snapshot.lines].reverse();
  reject(new Response(JSON.stringify({ error: { code: "Validation", message: "Bad", details: [{ field: "lines[0].qty", code: "Qty", message: "Bad qty" }] } }), { status: 400 }));
  expect(await saving).toMatchObject({ kind: "failed", error: { issues: [{ clientLineId: "client-0", field: "qty:client-0" }] } });
});

it.each(["headers", "body"])("hung Post %s reaches unknown after deadline without replay", async hang => {
  const s = await setup();
  vi.useFakeTimers();
  try {
    let signal: AbortSignal | null | undefined;
    s.fetcher.mockImplementationOnce(async (_path, init) => {
      signal = init?.signal;
      if (hang === "headers") return new Promise<Response>(() => {});
      return new Response(new ReadableStream({ start() {} }));
    });
    const pending = s.sales.post({ saleId: posted.data.saleId, expectedVersion: "opaque" }, s.context);
    await vi.advanceTimersByTimeAsync(30000);
    expect(await pending).toEqual({ kind: "outcome-unknown" });
    expect(signal?.aborted).toBe(true);
    expect(s.fetcher).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});

it("caller abort cancels a dispatched request and keeps the write unknown", async () => {
  const s = await setup();
  const caller = new AbortController();
  let dispatched!: () => void;
  const started = new Promise<void>(resolve => { dispatched = resolve; });
  let signal: AbortSignal | null | undefined;
  s.fetcher.mockImplementationOnce((_path, init) => {
    signal = init?.signal; dispatched();
    return new Promise<Response>(() => {});
  });
  const pending = s.sales.save(s.snapshot, { ...s.context, signal: caller.signal });
  await started;
  caller.abort();
  expect(await pending).toEqual({ kind: "outcome-unknown" });
  expect(signal?.aborted).toBe(true);
  expect(s.fetcher).toHaveBeenCalledTimes(1);
});

it("failed expired-token preflight is conclusively unsent and releases private command state", async () => {
  const s = await setup();
  const workspace = createWorkspaceRuntime({ sales: s.sales, catalog: createFakeCatalogPort(), auth: s.auth, today: () => "2026-10-31", storage: null });
  s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(created)));
  const id = await workspace.openSalesDocument(created.data.saleId);
  workspace.writeBuffer(id, "note", "private final key");
  s.fetcher.mockClear();
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date(9999999999 * 1000 - 10000));
    s.fetcher.mockRejectedValueOnce(Error("refresh offline"));
    const result = await workspace.sales.requestSave(id);
    expect(result.kind).toBe("failed");
    expect(s.fetcher.mock.calls.map(([path]) => path)).toEqual(["/api/v1/auth/refresh"]);
    expect(s.auth.getSnapshot().status).toBe("reauth-required");
    expect(workspace.store.getState().sessions[id]).toMatchObject({ mutation: "idle", preparing: false, mutationSnapshot: undefined, rawBuffers: { note: { raw: "private final key" } } });
    expect((await workspace.sales.requestSave(id)).kind).toBe("blocked");
  } finally { vi.useRealTimers(); workspace.dispose(); }
});

it.each(["abort", "scope"])("%s during token preflight is unsent with zero business fetches", async fault => {
  const s = await setup();
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date(9999999999 * 1000 - 10000));
    let finish!: (value: Response) => void;
    s.fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const caller = new AbortController();
    const saving = s.sales.save(s.snapshot, { ...s.context, signal: caller.signal });
    await vi.advanceTimersByTimeAsync(0);
    if (fault === "abort") caller.abort(); else s.auth.expire();
    const user = { userId: 1, username: "a", displayName: "A" };
    s.fetcher.mockResolvedValueOnce(s.response(user)).mockResolvedValueOnce(s.response({ read: true, write: true, post: true }));
    finish(s.response({ accessToken: `e30.${btoa(JSON.stringify({ sid: "s1", exp: 10000001000 }))}.signature`, expiresAtUtc: "2286-11-20T17:46:39Z", user }));
    expect(await saving).toMatchObject({ kind: "failed", dispatched: false });
    expect(s.fetcher.mock.calls.every(([path]) => String(path).startsWith("/api/v1/auth/"))).toBe(true);
    expect(s.fetcher.mock.calls.map(([path]) => path)).toContain("/api/v1/auth/refresh");
  } finally { vi.useRealTimers(); }
});
