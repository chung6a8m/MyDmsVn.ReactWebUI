import { expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createStore } from "zustand/vanilla";
import { observeInventoryPosts } from "../../../src/features/inventory/inventoryInvalidation";
const scope = { actorKey: "a", actorGeneration: 1 };
const saved = { warehouseId: "10", lines: [{ productId: "20" }] };
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
