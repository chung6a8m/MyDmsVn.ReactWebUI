import { expect, it, vi } from "vitest";
import { setup, document, deferred } from "./fixtures";
import { createGoodsReceiptWorkspaceAdapter } from "../../../src/features/goodsReceipt/goodsReceiptWorkspaceAdapter";
import { createWorkspaceController } from "../../../src/app/workspace/workspaceController";
import { injectedRuntimeFixture } from "../workspace/injectedRuntimeFixture";
import { createSalesWorkspaceAdapter } from "../../../src/features/sales/salesWorkspaceAdapter";
import { canEdit } from "../../../src/features/goodsReceipt/goodsReceiptSessionStore";
import type { GoodsReceiptDocument } from "../../../src/features/goodsReceipt/contracts";
import type { ReadResult } from "../../../src/ports/portContracts";
function workspace() {
  const injected = injectedRuntimeFixture(); const { port } = setup();
  injected.publish({ ...injected.auth.getSnapshot(), features: { "goods-receipt": { read: true, write: true, post: true } } });
  const scope = () => { const { actorKey, actorGeneration } = injected.auth.getSnapshot(); return { actorKey, actorGeneration }; };
  const isCurrentScope = (candidate: ReturnType<typeof scope>) => candidate.actorKey === scope().actorKey && candidate.actorGeneration === scope().actorGeneration;
  const host = { scope, isCurrentScope, blocked: () => false, show: vi.fn(), remove: vi.fn() };
  const adapter = createGoodsReceiptWorkspaceAdapter({ port, catalog: injected.catalog, auth: injected.auth, today: () => "2026-11-01" }, host);
  const close = createWorkspaceController({ ...adapter.feature, scope, isCurrentScope });
  return { ...injected, adapter, port, host, close };
}
it("opens literal-date new receipt with no invented server identity and stable UUID line", async () => {
  const { adapter } = workspace(); const id = await adapter.feature.open(null); const session = adapter.store.getState().sessions[id];
  expect(session.draft).toMatchObject({ receiptId: null, expectedVersion: null, receiptDate: "2026-11-01", lines: [{ receiptLineId: null, productId: null, quantity: "1.0000", unitCost: "0.0000" }] });
  expect(session.draft!.lines[0].clientLineId).toMatch(/^[0-9a-f-]{36}$/); expect(session.baseline).toBeNull();
  expect(adapter.feature.panel(id)).toMatchObject({ module: "goods-receipt", componentId: "goods-receipt-document", serverId: null });
});
it("caches same record per actor, remaps server client identity and keeps view/raw across detach", async () => {
  const { adapter, host } = workspace(); const id = await adapter.feature.open("1001");
  expect(await adapter.feature.open("1001")).toBe(id); const line = adapter.store.getState().sessions[id].draft!.lines[0];
  expect(line.clientLineId).not.toBe("local-row"); adapter.writeBuffer(id, `quantity:${line.clientLineId}`, "bad"); adapter.setGridState(id, { focusedCell: { rowIndex: 0, rowPinned: null, colId: "quantity" } });
  expect(adapter.feature.documents(host.scope())).toHaveLength(1); expect(adapter.store.getState().sessions[id].view.grid?.focusedCell?.colId).toBe("quantity");
});
it("binds Create result to existing session and prevents duplicate candidate binding", async () => {
  const { adapter, port } = workspace(); const id = await adapter.feature.open(null);
  const draft = { ...document().saved, receiptId: null, expectedVersion: null };
  adapter.store.setState(s => ({ sessions: { ...s.sessions, [id]: { ...s.sessions[id], draft } } }));
  expect((await adapter.commands.requestSave(id)).kind).toBe("saved"); expect(await adapter.feature.open("1001")).toBe(id);
  const second = await adapter.feature.open(null); adapter.store.setState(s => ({ sessions: { ...s.sessions, [second]: { ...s.sessions[second], draft } } }));
  port.save = async () => ({ kind: "outcome-unknown" }); await adapter.commands.requestSave(second); await adapter.commands.inspectRecovery(second, "1001");
  expect(adapter.commands.confirmRecovery(second)).toBe(false); expect(adapter.store.getState().sessions[second].mutation).toBe("outcome-unknown");
});
it.each(["cancel", "discard", "save"] as const)("shared close controller handles invalid dirty %s", async choice => {
  const { adapter, close, host } = workspace(); const id = await adapter.feature.open("1001"); const line = adapter.store.getState().sessions[id].draft!.lines[0];
  adapter.writeBuffer(id, `quantity:${line.clientLineId}`, "bad"); const closing = close.requestClose(id, "tab"); await close.respond(id, choice);
  expect(await closing).toBe(choice === "cancel" ? "cancelled" : choice === "discard" ? "closed" : "blocked");
  expect(!!adapter.store.getState().sessions[id]).toBe(choice !== "discard"); expect(host.remove).toHaveBeenCalledTimes(choice === "discard" ? 1 : 0);
});
it.each(["pending", "outcome-unknown"] as const)("close and discard stay blocked for %s", async mutation => {
  const { adapter, close } = workspace(); const id = await adapter.feature.open("1001");
  adapter.store.setState(s => ({ sessions: { ...s.sessions, [id]: { ...s.sessions[id], mutation } } }));
  expect(await close.requestClose(id, "tab")).toBe("blocked"); expect(adapter.store.getState().sessions[id]).toBeDefined();
});
it("fresh capabilities deny old actors and never inherit Sales grants", async () => {
  const { adapter, auth, publish, host } = workspace(); const disconnect = adapter.connectAuth(); const first = await adapter.feature.open("1001");
  publish({ ...auth.getSnapshot(), actorKey: "another", actorGeneration: 9, features: undefined });
  expect(adapter.store.getState().sessions[first].capabilities).toEqual({ read: false, write: false, post: false });
  expect(await adapter.feature.open("1001")).toBe("");
  publish({ ...auth.getSnapshot(), features: { "goods-receipt": { read: true, write: true, post: false } } });
  const second = await adapter.feature.open("1001"); expect(second).not.toBe(first); expect(adapter.feature.documents(host.scope())).toHaveLength(1);
  adapter.writeBuffer(first, "note", "cross actor"); expect(adapter.store.getState().sessions[first].rawBuffers.note).toBeUndefined(); disconnect(); expect(adapter.store.getState().sessions[first]).toBeDefined();
});
it("late initial reads cannot overwrite changed revision or replacement session", async () => {
  const { adapter, port, host } = workspace(); const read = deferred<ReadResult<GoodsReceiptDocument>>(); port.get = () => read.promise;
  const opening = adapter.feature.open("1001"); const id = host.show.mock.calls[0][0] as string;
  adapter.store.setState(s => ({ sessions: { ...s.sessions, [id]: { ...s.sessions[id], editRevision: 1, rawBuffers: { note: { raw: "new", composing: false } } } } }));
  read.resolve({ kind: "success", value: document() }); await opening;
  expect(adapter.store.getState().sessions[id].baseline).toBeNull(); expect(adapter.store.getState().sessions[id].rawBuffers.note.raw).toBe("new");
});
it("successful close-save releases record map and later open gets a fresh session", async () => {
  const { adapter, close } = workspace(); const id = await adapter.feature.open("1001"); adapter.writeBuffer(id, "note", "saved");
  const closing = close.requestClose(id, "tab"); await close.respond(id, "save"); expect(await closing).toBe("closed");
  expect(await adapter.feature.open("1001")).not.toBe(id);
});
it("late read failure cannot overwrite newer draft revision", async () => {
  const { adapter, port, host } = workspace(); let reject!: (reason: Error) => void;
  port.get = () => new Promise((_resolve, r) => { reject = r; }); const opening = adapter.feature.open("1001"); const id = host.show.mock.calls[0][0] as string;
  adapter.store.setState(s => ({ sessions: { ...s.sessions, [id]: { ...s.sessions[id], editRevision: 1, rawBuffers: { note: { raw: "new", composing: false } } } } }));
  reject(Error("old failure")); await opening; expect(adapter.store.getState().sessions[id].status).toBe("loading"); expect(adapter.store.getState().sessions[id].error).toBeUndefined();
});
it("closed then restored same session ID fences the original in-flight read", async () => {
  const { adapter, port, close } = workspace(); const read = deferred<ReadResult<GoodsReceiptDocument>>(); port.get = () => read.promise;
  const first = adapter.feature.open("1001", "restored"); const firstGeneration = adapter.store.getState().sessions.restored.generation;
  expect(await close.requestClose("restored", "tab")).toBe("closed");
  port.get = async () => ({ kind: "success", value: document(undefined, "new") }); await adapter.feature.open("1001", "restored");
  read.resolve({ kind: "success", value: document(undefined, "old") }); await first;
  expect(adapter.store.getState().sessions.restored.baseline?.version).toBe("new"); expect(adapter.store.getState().sessions.restored.generation).toBeGreaterThan(firstGeneration);
});
it("disposing aborts reads and prevents ignored-abort results applying", async () => {
  const { adapter, port, host } = workspace(); const read = deferred<ReadResult<GoodsReceiptDocument>>(); let signal!: AbortSignal;
  port.get = (_id, context) => { signal = context.signal; return read.promise; }; const opening = adapter.feature.open("1001"); const id = host.show.mock.calls[0][0] as string;
  adapter.dispose(); expect(signal.aborted).toBe(true); read.resolve({ kind: "success", value: document() }); await opening;
  expect(adapter.store.getState().sessions[id].baseline).toBeNull();
});
it("actual Sales and Receipt adapters independently own the same server ID", async () => {
  const { adapter, dependencies, auth, publish, host } = workspace();
  publish({ ...auth.getSnapshot(), features: { ...auth.getSnapshot().features, sales: { read: true, write: true, post: false } } });
  const sales = createSalesWorkspaceAdapter(dependencies, { ...host, title: () => {} });
  const receiptId = await adapter.feature.open("1001"); const saleId = await sales.feature.open("1001");
  expect(receiptId).not.toBe(saleId); expect(adapter.feature.panel(receiptId)?.module).toBe("goods-receipt"); expect(sales.feature.panel(saleId)?.module).toBe("sales");
  expect(adapter.store.getState().sessions[receiptId].receiptId).toBe("1001"); expect(sales.store.getState().sessions[saleId].saleId).toBe("1001");
});
it("initially loaded Posted cannot reload stale Draft or re-enable editing and Post", async () => {
  const { adapter, port } = workspace();
  port.get = async () => ({ kind: "success", value: { ...document(undefined, "posted-version"), status: "Posted", postedAtUtc: "2026-11-01T00:00:00Z" } });
  const id = await adapter.feature.open("1001"); const live = () => adapter.store.getState().sessions[id];
  expect(live().postAcknowledgement).toBeUndefined(); expect(live().baseline?.status).toBe("Posted");
  port.get = async () => ({ kind: "success", value: document() }); port.post = vi.fn(port.post);
  await adapter.commands.inspectReload(id);
  expect(live().recovery?.eligible).toBe(false); expect(adapter.commands.confirmReload(id)).toBe(false);
  expect(live().baseline?.status).toBe("Posted"); expect(live().baseline?.version).toBe("posted-version"); expect(canEdit(live())).toBe(false);
  expect((await adapter.commands.requestPost(id)).kind).toBe("blocked"); expect(port.post).not.toHaveBeenCalled();
});
