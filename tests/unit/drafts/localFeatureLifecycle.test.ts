import { describe, expect, it, vi } from "vitest";
import { createSalesWorkspaceAdapter } from "../../../src/features/sales/salesWorkspaceAdapter";
import { createGoodsReceiptWorkspaceAdapter } from "../../../src/features/goodsReceipt/goodsReceiptWorkspaceAdapter";
import { createWorkspaceController } from "../../../src/app/workspace/workspaceController";
import { sameActorScope, type ActorScope } from "../../../src/app/workspace/documentContracts";
import type { RuntimeAuthSnapshot } from "../../../src/app/runtime/runtimeDependencies";
import type { DraftRecord } from "../../../src/infrastructure/drafts/draftRecord";
import { captureSalesDraft, captureGoodsReceiptDraft } from "../../../src/infrastructure/drafts/featureDraftSnapshot";
import { mapSalesDetail } from "../../../src/infrastructure/http/salesWireMapper";
import { mapGoodsReceiptDetail } from "../../../src/infrastructure/http/goodsReceiptWireMapper";
import { salesDetailSchema } from "../../../src/infrastructure/http/salesWireSchemas";
import { receiptDetailSchema } from "../../../src/infrastructure/http/goodsReceiptWireSchemas";
import { canEdit as canEditSales, identityMatches as sameSales } from "../../../src/features/sales/salesSessionStore";
import { canEdit as canEditReceipt, identityMatches as sameReceipt } from "../../../src/features/goodsReceipt/goodsReceiptSessionStore";
import salesResponse from "../../fixtures/web4-v1/corpus/sales-create-response.json";
import receiptResponse from "../../fixtures/web4-v1/corpus/receipt-create-response.json";

const epoch = "11111111-2222-3333-4444-555555555555";
const otherEpoch = "21111111-2222-3333-4444-555555555555";
const grants = { read: true, write: true, post: true };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function setup(feature: "sales" | "goods-receipt") {
  let scope: ActorScope = { deploymentEpoch: epoch, actorKey: "13", actorGeneration: 4 };
  let auth: RuntimeAuthSnapshot = { ...scope, capabilities: grants, features: { sales: grants, "goods-receipt": grants } };
  const authReader = { getSnapshot: () => auth, subscribe: () => () => {} };
  const catalog = { search: vi.fn(async () => ({ kind: "success" as const, value: [] })) };
  const sales = { get: vi.fn(async () => ({ kind: "success" as const, value: mapSalesDetail(salesDetailSchema.parse(salesResponse.data)) })),
    save: vi.fn(async () => ({ kind: "outcome-unknown" as const })), post: vi.fn(async () => ({ kind: "outcome-unknown" as const })),
    list: vi.fn(async () => ({ kind: "success" as const, value: { items: [], nextCursor: null, previousCursor: null } })) };
  const receipt = { get: vi.fn(async () => ({ kind: "success" as const, value: mapGoodsReceiptDetail(receiptDetailSchema.parse(receiptResponse.data)) })),
    save: vi.fn(async () => ({ kind: "outcome-unknown" as const })), post: vi.fn(async () => ({ kind: "outcome-unknown" as const })),
    list: vi.fn(async () => ({ kind: "success" as const, value: { items: [], pageNumber: 1, pageSize: 20, totalCount: "0" } })) };
  const host = { scope: () => ({ ...scope }), isCurrentScope: (candidate: ActorScope) => sameActorScope(scope, candidate),
    blocked: () => false, show: vi.fn(), remove: vi.fn(), title: vi.fn() };
  const runtime = feature === "sales"
    ? createSalesWorkspaceAdapter({ sales, catalog, auth: authReader, today: () => "2026-11-02", storage: null }, host)
    : createGoodsReceiptWorkspaceAdapter({ port: receipt, catalog, auth: authReader, today: () => "2026-11-02" }, host);
  const controller = createWorkspaceController({ ...runtime.feature, scope: host.scope, isCurrentScope: host.isCurrentScope });
  function mutate(id: string, change: { editRevision?: number; generation?: number; deploymentEpoch?: string; mutation?: "idle" | "outcome-unknown" }) {
    if ("sales" in runtime) runtime.store.setState(state => ({ sessions: { ...state.sessions, [id]: { ...state.sessions[id], ...change } } }));
    else runtime.store.setState(state => ({ sessions: { ...state.sessions, [id]: { ...state.sessions[id], ...change } } }));
  }
  async function record(existing = false): Promise<DraftRecord> {
    const id = await runtime.feature.open(existing ? (feature === "sales" ? salesResponse.data.saleId : receiptResponse.data.receiptId) : null);
    const session = runtime.store.getState().sessions[id];
    const snapshot = "saleId" in session ? captureSalesDraft(session)! : captureGoodsReceiptDraft(session)!;
    await controller.requestClose(id, "tab");
    return { schemaVersion: 1, deploymentEpoch: epoch, actorKey: "13", feature, localDocumentId: id, snapshot,
      editRevision: 12, localPersistSequence: 1, savedAt: "2026-11-02T00:00:00.000Z", unresolvedOperation: false, operationId: null };
  }
  return { runtime, controller, host, sales, receipt, record, mutate,
    switchEpoch() { scope = { ...scope, deploymentEpoch: otherEpoch }; auth = { ...auth, ...scope }; },
    permissions(value: typeof grants) { auth = { ...auth, capabilities: value, features: { sales: value, "goods-receipt": value } }; },
    currentScope: () => scope,
  };
}

describe.each(["sales", "goods-receipt"] as const)("%s local close lifecycle", feature => {
  it("awaits local completion and joins repeated clean close requests", async () => {
    const test = setup(feature);
    const id = await test.runtime.feature.open(null);
    const pending = deferred<boolean>();
    const beforeClose = vi.fn(() => pending.promise);
    test.runtime.setLocalDraftHooks({ beforeClose });
    const closing = test.controller.requestClose(id, "tab");
    expect(test.controller.requestClose(id, "middle-click")).toBe(closing);
    expect(test.runtime.store.getState().sessions[id]).toBeDefined();
    expect(test.host.remove).not.toHaveBeenCalled();
    pending.resolve(true);
    expect(await closing).toBe("closed");
    expect(beforeClose).toHaveBeenCalledTimes(1);
    expect(test.host.remove).toHaveBeenCalledTimes(1);
  });

  it.each(["false", "throw"])("retains RAM and reports local discard %s failure", async mode => {
    const test = setup(feature);
    const id = await test.runtime.feature.open(null);
    test.runtime.writeBuffer(id, "note", "chưa được xóa");
    test.runtime.setLocalDraftHooks({ beforeClose: async () => { if (mode === "throw") throw new Error("CAS conflict"); return false; } });
    const closing = test.controller.requestClose(id, "tab");
    await test.controller.respond(id, "discard");
    expect(await closing).toBe("blocked");
    expect(test.runtime.store.getState().sessions[id].rawBuffers.note.raw).toBe("chưa được xóa");
    expect(test.controller.state.getState().feedback[id]).toContain("thiết bị");
    expect(test.host.remove).not.toHaveBeenCalled();
  });

  it.each(["revision", "generation", "epoch"])("does not dispose a newer %s after awaited local discard", async changed => {
    const test = setup(feature);
    const id = await test.runtime.feature.open(null);
    const pending = deferred<boolean>();
    let stillAdmitted!: () => boolean;
    test.runtime.setLocalDraftHooks({ beforeClose: (_identity, check) => { stillAdmitted = check; return pending.promise; } });
    const closing = test.controller.requestClose(id, "tab");
    if (changed === "revision") test.mutate(id, { editRevision: 1 });
    if (changed === "generation") test.mutate(id, { generation: 2 });
    if (changed === "epoch") test.switchEpoch();
    expect(stillAdmitted()).toBe(false);
    pending.resolve(true);
    expect(await closing).toBe("blocked");
    expect(test.runtime.store.getState().sessions[id]).toBeDefined();
    expect(test.host.remove).not.toHaveBeenCalled();
  });

  it("serializes close-all through a deferred discard and does not run duplicate discard decisions", async () => {
    const test = setup(feature);
    const first = await test.runtime.feature.open(null);
    const second = await test.runtime.feature.open(null);
    test.runtime.writeBuffer(first, "note", "discard");
    const pending = deferred<boolean>();
    const beforeClose = vi.fn(() => pending.promise);
    test.runtime.setLocalDraftHooks({ beforeClose });
    const all = test.controller.closeAll("layout-reset");
    const responding = test.controller.respond(first, "discard");
    await test.controller.respond(first, "discard");
    expect(beforeClose).toHaveBeenCalledTimes(1);
    expect(test.runtime.store.getState().sessions[second]).toBeDefined();
    pending.resolve(false);
    await responding;
    expect(await all).toBe("blocked");
    expect(Object.keys(test.runtime.store.getState().sessions)).toHaveLength(2);
  });
});

describe.each(["sales", "goods-receipt"] as const)("%s local restore", feature => {
  it("restores exact raw/lookup/baseline IDs with fresh generation and current denied-write capabilities, without Get", async () => {
    const test = setup(feature);
    const record = await test.record(true);
    const line = record.snapshot.draft.lines[0].clientLineId;
    record.snapshot.rawBuffers = { [feature === "sales" ? `qty:${line}` : `quantity:${line}`]: { raw: " 1,2,3 ", composing: true } };
    record.snapshot.lookupBuffers = { [`product:${line}`]: { selectedId: null, displayText: "", query: "  sản phẩm mới  ", composing: true, confirmed: false } };
    record.snapshot.dirty = false;
    test.permissions({ read: true, write: false, post: false });
    test.sales.get.mockClear(); test.receipt.get.mockClear();
    expect(test.runtime.restoreLocal(record)).toBe(record.localDocumentId);
    const restored = test.runtime.store.getState().sessions[record.localDocumentId];
    expect(restored.generation).toBe(2);
    expect(restored.editRevision).toBe(12);
    expect(restored.deploymentEpoch).toBe(epoch);
    expect(restored.rawBuffers).toEqual(record.snapshot.rawBuffers);
    expect(restored.lookupBuffers).toEqual(record.snapshot.lookupBuffers);
    expect(restored.baseline).toEqual(record.snapshot.baseline);
    expect(restored.draft).toEqual(record.snapshot.draft);
    expect(restored.dirty).toBe(true);
    expect(restored.capabilities).toEqual({ read: true, write: false, post: false });
    expect(restored.commandCount).toBe(0);
    expect(restored.view).toEqual({});
    expect(test.sales.get).not.toHaveBeenCalled(); expect(test.receipt.get).not.toHaveBeenCalled();
  });

  it("recomputes dirty from unconfirmed lookup even when rawBuffers are empty", async () => {
    const test = setup(feature);
    const record = await test.record();
    record.snapshot.lookupBuffers = { warehouseId: { selectedId: null, query: "còn nhập", displayText: "", confirmed: false, composing: false } };
    expect(test.runtime.restoreLocal(record)).toBe(record.localDocumentId);
    expect(test.runtime.store.getState().sessions[record.localDocumentId].dirty).toBe(true);
  });

  it("restores unresolved obligations locked for operator reconciliation and never reconstructs a mutation snapshot", async () => {
    const test = setup(feature);
    const record = await test.record(true);
    record.unresolvedOperation = true;
    record.operationId = "11111111-2222-4333-8444-555555555555";
    expect(test.runtime.restoreLocal(record)).toBe(record.localDocumentId);
    const restored = test.runtime.store.getState().sessions[record.localDocumentId];
    expect(restored.mutation).toBe("outcome-unknown");
    expect(restored.localRecovery).toEqual({ operationId: record.operationId });
    expect(restored.mutationSnapshot).toBeUndefined();
    expect("saleId" in restored ? canEditSales(restored) : canEditReceipt(restored)).toBe(false);
    expect(await test.controller.requestClose(record.localDocumentId, "command")).toBe("blocked");
  });

  it.each(["epoch", "actor", "schema", "feature", "capabilities"])("rejects foreign or invalid %s without showing content", async mismatch => {
    const test = setup(feature);
    const record = await test.record();
    test.host.show.mockClear();
    if (mismatch === "epoch") record.deploymentEpoch = otherEpoch;
    if (mismatch === "actor") record.actorKey = "14";
    if (mismatch === "schema") Object.assign(record, { schemaVersion: 2 });
    if (mismatch === "feature") record.feature = feature === "sales" ? "goods-receipt" : "sales";
    if (mismatch === "capabilities") test.permissions({ read: false, write: false, post: false });
    expect(test.runtime.restoreLocal(record)).toBe("");
    expect(test.runtime.store.getState().sessions).toEqual({});
    expect(test.host.show).not.toHaveBeenCalled();
  });

  it("rejects duplicate local IDs and a second local copy of the same server document", async () => {
    const test = setup(feature);
    const record = await test.record(true);
    expect(test.runtime.restoreLocal(record)).toBe(record.localDocumentId);
    expect(test.runtime.restoreLocal(record)).toBe("");
    expect(test.runtime.restoreLocal({ ...record, localDocumentId: "other-local" })).toBe("");
    expect(Object.keys(test.runtime.store.getState().sessions)).toEqual([record.localDocumentId]);
  });

  it("rechecks current scope after publishing the restored session", async () => {
    const test = setup(feature);
    const record = await test.record();
    test.host.show.mockClear();
    const stop = test.runtime.store.subscribe(state => { if (state.sessions[record.localDocumentId]) test.switchEpoch(); });
    expect(test.runtime.restoreLocal(record)).toBe("");
    expect(test.host.show).not.toHaveBeenCalled();
    expect(test.runtime.store.getState().sessions).toEqual({});
    stop();
  });

  it("propagates epoch to reads and fences session identity from another epoch", async () => {
    const test = setup(feature);
    const id = await test.runtime.feature.open(feature === "sales" ? salesResponse.data.saleId : receiptResponse.data.receiptId);
    const session = test.runtime.store.getState().sessions[id];
    const get = feature === "sales" ? test.sales.get : test.receipt.get;
    expect(get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ deploymentEpoch: epoch }));
    expect(test.runtime.feature.panel(id)?.deploymentEpoch).toBe(epoch);
    expect(test.runtime.feature.getAdapter(id)?.captureIdentity().deploymentEpoch).toBe(epoch);
    expect("saleId" in session ? sameSales(session, { ...session, deploymentEpoch: otherEpoch }) : sameReceipt(session, { ...session, deploymentEpoch: otherEpoch })).toBe(false);
  });
});
