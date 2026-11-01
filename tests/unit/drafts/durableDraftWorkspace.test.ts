import { expect, it, vi } from "vitest";
import { createDurableDraftWorkspace } from "../../../src/app/runtime/durableDraftWorkspace";
import { createLocalDraftPersistence } from "../../../src/infrastructure/drafts/localDraftPersistence";
import { DraftRepositoryError, type DraftRecord } from "../../../src/infrastructure/drafts/draftRecord";

const namespace = { deploymentEpoch: "11111111-2222-4333-8444-555555555555", actorKey: "1" };
function record(): DraftRecord {
  const draft = { saleId: null, expectedVersion: null, saleDate: "2026-11-02", customerId: "", warehouseId: "", employeeId: "", note: "", lines: [] };
  return { ...namespace, schemaVersion: 1, feature: "sales", localDocumentId: "saved-local", editRevision: 1, localPersistSequence: 3,
    savedAt: "2026-11-02T00:00:00.000Z", unresolvedOperation: false, operationId: null,
    snapshot: { feature: "sales", serverId: null, draft, initialDraft: draft, baseline: null, rawBuffers: { note: { raw: "chưa xong", composing: true } }, lookupBuffers: {}, dirty: true, postAcknowledgement: null } };
}
function setup() {
  let current = true, ready = false, allowed = true;
  const stored = record();
  const repository = { read: vi.fn(async () => ({ kind: "available" as const, record: stored })), list: vi.fn(async () => ({ records: [stored], quarantined: [], conflicts: [] })),
    write: vi.fn(async (r: DraftRecord) => r), delete: vi.fn(async () => {}), close: vi.fn(), retryConnection: vi.fn() };
  const persistence = createLocalDraftPersistence({ namespace, repository, isCurrent: () => current });
  const restore = vi.fn(() => "saved-local"), isLive = vi.fn(() => false);
  const validateRestore = vi.fn(async () => true), restored = vi.fn();
  const workspace = createDurableDraftWorkspace({ repository, persistence, isCurrent: () => current, ready: () => ready, allowed: () => allowed, isLive, restore, validateRestore, restored });
  return { workspace, stored, repository, restore, isLive, persistence, validateRestore, restored, authorize() { ready = true; }, leave() { current = false; }, deny() { allowed = false; } };
}
it("does not enumerate or render local bytes until authoritative capability bootstrap completes", async () => {
  const f = setup(); await f.workspace.review(); expect(f.repository.list).not.toHaveBeenCalled();
  f.authorize(); await f.workspace.review(); expect(f.workspace.state.getState().records).toHaveLength(1); expect(f.restore).not.toHaveBeenCalled();
});
it("requires explicit restore and adopts completed sequence before feature store publication", async () => {
  const f = setup(); f.authorize(); await f.workspace.review();
  f.restore.mockImplementation(() => { expect(Object.values(f.persistence.state.getState().documents)[0].localPersistSequence).toBe(3); return "saved-local"; });
  expect(await f.workspace.restore(f.stored, 3)).toBe("saved-local");
  expect(f.restore).toHaveBeenCalledWith(f.stored); expect(f.repository.write).not.toHaveBeenCalled();
});
it("refuses stale preview when another tab edits the same record", async () => {
  const f = setup(); f.authorize(); await f.workspace.review(); f.stored.localPersistSequence = 4;
  expect(await f.workspace.restore(f.stored, 3)).toBe(""); expect(f.restore).not.toHaveBeenCalled();
});
it("retains protected bytes and reports a failed CAS delete without false success", async () => {
  const f = setup(); f.authorize(); await f.workspace.review(); f.stored.unresolvedOperation = true;
  expect(await f.workspace.discard(f.stored, 3)).toBe(false); expect(f.repository.delete).not.toHaveBeenCalled();
  f.stored.unresolvedOperation = false; f.repository.delete.mockRejectedValueOnce(new DraftRepositoryError("conflict"));
  expect(await f.workspace.discard(f.stored, 3)).toBe(false); expect(f.workspace.state.getState().records).toHaveLength(1);
});
it("fences a late list response and clears preview after actor or epoch disposal", async () => {
  const f = setup(); f.authorize(); let finish!: (r: Awaited<ReturnType<typeof f.repository.list>>) => void;
  f.repository.list.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = f.workspace.review(); f.leave(); f.workspace.dispose(); finish({ records: [f.stored], quarantined: [], conflicts: [] }); await pending;
  expect(f.workspace.state.getState().records).toHaveLength(0); expect(await f.workspace.restore(f.stored, 3)).toBe("");
});
it("does not restore or delete an already open document or one whose capability was revoked", async () => {
  const f = setup(); f.authorize(); await f.workspace.review(); f.isLive.mockReturnValue(true);
  expect(await f.workspace.discard(f.stored, 3)).toBe(false); expect(await f.workspace.restore(f.stored, 3)).toBe("");
  f.isLive.mockReturnValue(false); f.deny(); expect(await f.workspace.restore(f.stored, 3)).toBe(""); expect(f.restore).not.toHaveBeenCalled();
});
it("hides revoked previews synchronously even when a fresh list never completes", async () => {
  const f = setup(); f.authorize(); await f.workspace.review(); expect(f.workspace.state.getState().records).toHaveLength(1);
  f.deny(); f.repository.list.mockImplementationOnce(() => new Promise(() => {}));
  void f.workspace.review(); expect(f.workspace.state.getState().records).toHaveLength(0);
  f.workspace.dispose();
});
it("resets a failed connection only on explicit review retry, including without an open document", async () => {
  const f = setup(); f.authorize();
  f.repository.list.mockRejectedValueOnce(new DraftRepositoryError("blocked"));
  await f.workspace.review(); expect(f.repository.retryConnection).not.toHaveBeenCalled();
  await f.workspace.retryReview(); expect(f.repository.retryConnection).toHaveBeenCalledOnce(); expect(f.workspace.state.getState().records).toHaveLength(1);
});
it("does not adopt or open a draft with an invalid protected operation reference", async () => {
  const f = setup(); f.authorize(); await f.workspace.review(); f.validateRestore.mockResolvedValueOnce(false);
  expect(await f.workspace.restore(f.stored, 3)).toBe(""); expect(f.restore).not.toHaveBeenCalled(); expect(f.persistence.state.getState().documents).toEqual({});
});
it("rechecks ownership after asynchronous operation verification and binds only a live restored owner", async () => {
  const f = setup(); f.authorize(); await f.workspace.review();
  f.validateRestore.mockImplementationOnce(async () => { f.leave(); return true; });
  expect(await f.workspace.restore(f.stored, 3)).toBe(""); expect(f.restored).not.toHaveBeenCalled();
  const g = setup(); g.authorize(); await g.workspace.review(); expect(await g.workspace.restore(g.stored, 3)).toBe("saved-local");
  expect(g.restored).toHaveBeenCalledWith(g.stored, "saved-local");
});
