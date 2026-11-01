import { expect, it, vi } from "vitest";
import { createProductionRuntime } from "../../../src/app/runtime/createProductionRuntime";
import { deniedModuleCapabilities } from "../../../src/app/runtime/moduleCapabilities";
import type { AuthSession, AuthSnapshot } from "../../../src/infrastructure/http/authSession";
import type { DraftRecord } from "../../../src/infrastructure/drafts/draftRecord";
import { DraftRepositoryError } from "../../../src/infrastructure/drafts/draftRecord";
const epoch = "11111111-2222-4333-8444-555555555555";
function fixture() {
  let snapshot: AuthSnapshot = { status: "authenticated", deploymentEpoch: epoch, actorKey: "1", actorGeneration: 1,
    capabilities: { read: true, write: true, post: true }, features: { ...deniedModuleCapabilities(), sales: { read: true, write: true, post: true }, "goods-receipt": { read: true, write: true, post: true } } };
  const listeners = new Set<() => void>();
  const auth = { getSnapshot: () => snapshot, subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); } } as unknown as AuthSession;
  const records = new Map<string, DraftRecord>();
  const repository = { read: vi.fn(), list: vi.fn(async () => ({ records: [], quarantined: [], conflicts: [] })),
    write: vi.fn(async (record: DraftRecord, expected: number | null) => {
      if ((records.get(record.localDocumentId)?.localPersistSequence ?? null) !== expected) throw new DraftRepositoryError("conflict");
      records.set(record.localDocumentId, structuredClone(record)); return record;
    }), delete: vi.fn(async (key: { localDocumentId: string }) => { records.delete(key.localDocumentId); }), close: vi.fn() };
  return { auth, records, repository, change(update: Partial<AuthSnapshot>) { snapshot = { ...snapshot, ...update } as AuthSnapshot; listeners.forEach(fn => fn()); } };
}
it("rejects production before opening storage when authoritative epoch or actor is missing", () => {
  const f = fixture(); f.change({ deploymentEpoch: undefined } as unknown as Partial<AuthSnapshot>);
  expect(() => createProductionRuntime(f.auth, { storage: null, draftRepository: f.repository })).toThrow();
  expect(f.repository.list).not.toHaveBeenCalled(); expect(f.repository.write).not.toHaveBeenCalled();
});
it("persists raw edits through runtime subscriptions without a mounted panel renderer", async () => {
  const f = fixture(); const r = createProductionRuntime(f.auth, { storage: null, draftRepository: f.repository });
  const id = await r.workspace.openSalesDocument(null);
  r.workspace.writeBuffer(id, "note", "chưa hoàn tất", true);
  await r.drafts.persistence.flush({ feature: "sales", localDocumentId: id });
  expect(f.records.get(id)?.snapshot.rawBuffers.note).toEqual({ raw: "chưa hoàn tất", composing: true });
  expect(f.records.get(id)?.deploymentEpoch).toBe(epoch);
  expect(await r.workspace.close.requestClose("absent", "tab")).toBe("closed");
  r.workspace.dispose();
});
it("does not remove a live session when discard storage fails", async () => {
  const f = fixture(); const r = createProductionRuntime(f.auth, { storage: null, draftRepository: f.repository });
  const id = await r.workspace.openSalesDocument(null);
  r.workspace.writeBuffer(id, "note", "keep", false);
  await r.drafts.persistence.flush({ feature: "sales", localDocumentId: id });
  f.repository.delete.mockRejectedValueOnce(new DraftRepositoryError("quota"));
  const close = r.workspace.close.requestClose(id, "tab"); await r.workspace.close.respond(id, "discard");
  expect(await close).toBe("blocked"); expect(r.workspace.store.getState().sessions[id].rawBuffers.note.raw).toBe("keep");
  r.workspace.dispose();
});
it("clears private RAM and local preview immediately on same-actor epoch change, retaining durable bytes", async () => {
  const f = fixture(); const r = createProductionRuntime(f.auth, { storage: null, draftRepository: f.repository });
  const id = await r.workspace.openSalesDocument(null); r.workspace.writeBuffer(id, "note", "private", false);
  await r.drafts.persistence.flush({ feature: "sales", localDocumentId: id });
  f.change({ deploymentEpoch: "22222222-2222-4333-8444-555555555555" });
  expect(r.workspace.store.getState().sessions).toEqual({}); expect(r.drafts.persistence.state.getState().documents).toEqual({});
  expect(r.drafts.recovery.state.getState().records).toEqual([]); expect(f.records.get(id)?.snapshot.rawBuffers.note.raw).toBe("private");
  expect(f.repository.delete).not.toHaveBeenCalled(); expect(f.repository.close).toHaveBeenCalledTimes(1); r.workspace.dispose();
});
