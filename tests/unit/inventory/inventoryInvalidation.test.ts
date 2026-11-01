import { expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { createStore } from "zustand/vanilla";
import { observeInventoryPosts } from "../../../src/features/inventory/inventoryInvalidation";
const scope = { actorKey: "a", actorGeneration: 1 };
const saved = { warehouseId: "10", lines: [{ productId: "20" }] };
function deferred<T>() {
 let resolve!: (value: T) => void;
 const promise = new Promise<T>(done => { resolve = done; });
 return { promise, resolve };
}
it.each([
 ["balances", "ack"], ["stock-card", "ack"],
 ["balances", "recovered"], ["stock-card", "recovered"],
])("%s initial read is replaced after %s Post confirmation", async (kind, confirmation) => {
 const f = fixture();
 const key = ["inventory", "a", 1, kind, { warehouseId: "10", productId: "20" }];
 f.client.removeQueries({ queryKey: key, exact: true });
 const old = deferred<string>(), fresh = deferred<string>();
 const reads = vi.fn().mockImplementationOnce(() => old.promise).mockImplementationOnce(() => fresh.promise);
 const observer = new QueryObserver(f.client, { queryKey: key, queryFn: reads, retry: false });
 const unsubscribe = observer.subscribe(() => {});
 try {
  expect(reads).toHaveBeenCalledTimes(1);
  const posted = confirmation === "ack" ? { ...f.session, postAcknowledgement: {} } : { ...f.session, baseline: { status: "Posted", saved } };
  f.store.setState({ sessions: { s: posted } } as never);
  await vi.waitFor(() => expect(reads).toHaveBeenCalledTimes(2));
  old.resolve("pre-Post");
  await Promise.resolve();
  expect(f.client.getQueryData(key)).toBeUndefined();
  fresh.resolve("post-Post");
  await vi.waitFor(() => expect(f.client.getQueryData(key)).toBe("post-Post"));
  f.store.setState({ sessions: { ...f.store.getState().sessions } });
  await Promise.resolve();
  expect(reads).toHaveBeenCalledTimes(2);
 } finally { unsubscribe(); f.dispose(); f.client.clear(); }
});
it("Post leaves unrelated stock and actor reads running", async () => {
 const f = fixture();
 const keys = [f.keys[3], f.keys[4], f.keys[5], f.keys[6]];
 const pending = keys.map(() => deferred<string>());
 const observers = keys.map((key, i) => {
  f.client.removeQueries({ queryKey: key, exact: true });
  const reads = vi.fn(() => pending[i].promise);
  const observer = new QueryObserver(f.client, { queryKey: key, queryFn: reads });
  return { unsubscribe: observer.subscribe(() => {}), reads };
 });
 try {
  f.store.setState({ sessions: { s: { ...f.session, postAcknowledgement: {} } } } as never);
  pending.forEach(p => p.resolve("unrelated"));
  await vi.waitFor(() => keys.forEach(key => expect(f.client.getQueryData(key)).toBe("unrelated")));
  observers.forEach(o => expect(o.reads).toHaveBeenCalledTimes(1));
 } finally { observers.forEach(o => o.unsubscribe()); f.dispose(); f.client.clear(); }
});
it.each(["actor-change", "dispose"])("does not refetch after cancellation when %s occurs", async change => {
 const f = fixture();
 f.dispose();
 let current = true;
 const dispose = observeInventoryPosts(f.client, f.store, () => current);
 const key = f.keys[0];
 f.client.removeQueries({ queryKey: key, exact: true });
 const pending = deferred<string>(), reads = vi.fn(() => pending.promise);
 const observer = new QueryObserver(f.client, { queryKey: key, queryFn: reads });
 const unsubscribe = observer.subscribe(() => {});
 try {
  f.store.setState({ sessions: { s: { ...f.session, postAcknowledgement: {} } } } as never);
  if (change === "actor-change") current = false;
  else dispose();
  pending.resolve("old actor");
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(reads).toHaveBeenCalledTimes(1);
  expect(f.client.getQueryData(key)).toBeUndefined();
  expect(f.client.getQueryState(key)?.isInvalidated).toBe(true);
 } finally { unsubscribe(); dispose(); f.client.clear(); }
});
function fixture() {
 const client = new QueryClient();
 const session = { ...scope, generation: 1, baseline: { status: "Draft", saved }, dirty: true, rawBuffers: { note: { raw: "uncommitted" } }, mutation: "pending" };
 const store = createStore(() => ({ sessions: { s: session } }));
 const key = (kind: string, query: object, actor = "a", generation = 1) => ["inventory", actor, generation, kind, query];
 const keys = [key("balances", {}), key("balances", { warehouseId: "10", productId: "20", search: "x" }), key("stock-card", { warehouseId: "10", productId: "20" }), key("balances", { warehouseId: "11" }), key("stock-card", { warehouseId: "10", productId: "21" }), key("balances", {}, "b"), key("balances", {}, "a", 2), ["receipt", "a"]];
 keys.forEach(k => client.setQueryData(k, {}));
 const dispose = observeInventoryPosts(client, store, captured => captured.actorKey === scope.actorKey && captured.actorGeneration === scope.actorGeneration);
 return { client, store, keys, dispose, session };
}
it("ack before failed Get invalidates scoped intersection and retains dirty buffers", () => {
 const f = fixture();
 f.store.setState({ sessions: { s: { ...f.session, postAcknowledgement: {}, status: "failed" } } } as never);
 expect(f.keys.map(k => f.client.getQueryState(k)?.isInvalidated)).toEqual([true,true,true,false,false,false,false,false]);
 expect(f.store.getState().sessions.s.rawBuffers).toEqual(f.session.rawBuffers);
 expect(f.store.getState().sessions.s.dirty).toBe(true);
 f.dispose();
});
it("unknown outcomes, stale actors and disposed subscriptions stay quiet", () => {
 const f = fixture();
 f.store.setState({ sessions: { s: { ...f.session, mutation: "outcome-unknown" } } });
 expect(f.client.getQueryState(f.keys[0])?.isInvalidated).toBe(false);
 f.store.setState({ sessions: { s: { ...f.session, actorGeneration: 2, postAcknowledgement: {} } } } as never);
 expect(f.client.getQueryState(f.keys[0])?.isInvalidated).toBe(false);
 f.dispose();
 f.store.setState({ sessions: { s: { ...f.session, postAcknowledgement: {} } } } as never);
 expect(f.client.getQueryState(f.keys[0])?.isInvalidated).toBe(false);
});
it("recovered Posted baseline invalidates once", () => {
 const f = fixture();
 f.store.setState({ sessions: { s: { ...f.session, baseline: { status: "Posted", saved } } } });
 expect(f.client.getQueryState(f.keys[0])?.isInvalidated).toBe(true);
 f.client.setQueryData(f.keys[0], {});
 f.store.setState({ sessions: { ...f.store.getState().sessions } });
 expect(f.client.getQueryState(f.keys[0])?.isInvalidated).toBe(false);
 f.dispose();
});

import { setup as receiptSetup } from "../goodsReceipt/fixtures";
import { createGoodsReceiptCommands } from "../../../src/features/goodsReceipt/goodsReceiptCommands";
import { createSalesPortCommands } from "../../../src/features/sales/salesCommands";
import { createLabWorkspaceRuntime } from "../../../src/lab/runtime/createLabWorkspaceRuntime";
it("real Receipt command acknowledgement invalidates before forbidden Get and keeps another dirty session", async () => {
 const f = receiptSetup(), client = new QueryClient();
 const key = ["inventory", f.session.actorKey, f.session.actorGeneration, "balances", { warehouseId: "1", productId: "3" }];
 client.setQueryData(key, {});
 const other = { ...f.session, sessionId: "other", dirty: true, rawBuffers: { quantity: { raw: "invalid", composing: false } } };
 f.store.setState(state => ({ sessions: { ...state.sessions, other } }));
 f.port.get = async () => ({ kind: "failed", error: { kind: "forbidden", code: "403", message: "denied" } });
 const dispose = observeInventoryPosts(client, f.store, () => true);
 expect((await createGoodsReceiptCommands(f.store, f.port).requestPost("session")).kind).toBe("posted");
 expect(client.getQueryState(key)?.isInvalidated).toBe(true);
 expect(f.store.getState().sessions.other).toBe(other);
 dispose();
});
it("real Sales command invalidates on ack independently of unavailable Get", async () => {
 const w = createLabWorkspaceRuntime(), client = new QueryClient();
 const id = await w.openSalesDocument("1001");
 const session = w.store.getState().sessions[id];
 const key = ["inventory", session.actorKey, session.actorGeneration, "stock-card", { warehouseId: session.baseline!.saved.warehouseId, productId: session.baseline!.saved.lines[0].productId }];
 client.setQueryData(key, {});
 const dispose = observeInventoryPosts(client, w.store, w.isCurrentScope);
 const commands = createSalesPortCommands(w.store, { ...w.port,
 post: async () => ({ kind: "success", value: { saleId: "1001", status: "Posted", postedAtUtc: "2026-11-01T00:00:00Z", version: "v2" } }),
 get: async () => ({ kind: "failed", error: { kind: "unavailable", code: "503", message: "unavailable" } }),
 });
 expect((await commands.requestPost(id)).kind).toBe("posted");
 expect(client.getQueryState(key)?.isInvalidated).toBe(true);
 dispose(); w.dispose();
});
it.each(["outcome-unknown", "failed"] as const)("Receipt %s Post leaves inventory fresh", async kind => {
 const f = receiptSetup(), client = new QueryClient();
 const key = ["inventory", f.session.actorKey, f.session.actorGeneration, "balances", {}];
 client.setQueryData(key, {});
 f.port.post = async () => kind === "outcome-unknown" ? { kind } : { kind, error: { kind: "forbidden", code: "403", message: "denied" } };
 const dispose = observeInventoryPosts(client, f.store, () => true);
 expect((await createGoodsReceiptCommands(f.store, f.port).requestPost("session")).kind).toBe(kind);
 expect(client.getQueryState(key)?.isInvalidated).toBe(false);
 dispose();
});
