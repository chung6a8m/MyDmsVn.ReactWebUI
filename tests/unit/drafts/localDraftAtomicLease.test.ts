import { expect, it, vi } from "vitest";
import { createLocalDraftPersistence } from "../../../src/infrastructure/drafts/localDraftPersistence";
import { DraftRepositoryError, type DraftRecord } from "../../../src/infrastructure/drafts/draftRecord";
const namespace = { deploymentEpoch: "11111111-2222-4333-8444-555555555555", actorKey: "1" };
const key = { feature: "sales" as const, localDocumentId: "local" };
function setup() {
  const draft = { saleId: null, expectedVersion: null, saleDate: "2026-11-02", customerId: "", warehouseId: "", employeeId: "", note: "", lines: [] };
  const repository = { write: vi.fn(async (record: DraftRecord) => record), delete: vi.fn(), read: vi.fn(), list: vi.fn(), close: vi.fn() };
  const persistence = createLocalDraftPersistence({ namespace, repository, isCurrent: () => true });
  const checkpoint = { ...key, editRevision: 1, snapshot: { feature: "sales" as const, serverId: null, draft, initialDraft: draft, baseline: null, rawBuffers: {}, lookupBuffers: {}, dirty: false, postAcknowledgement: null }, unresolvedOperation: false, operationId: null };
  persistence.update(checkpoint);
  return { persistence, repository, checkpoint };
}
it("serializes an atomic intent owner after flush and holds ordinary snapshot writes until publication", async () => {
  const f = setup(); const lease = await f.persistence.beginAtomic(key, 1);
  expect(lease.checkpoint.localPersistSequence).toBe(1);
  await expect(f.persistence.beginAtomic(key, 1)).rejects.toMatchObject({ code: "protected" });
  const intent = { ...lease.checkpoint, unresolvedOperation: true, operationId: "11111111-2222-4333-8444-555555555555", localPersistSequence: 2 };
  lease.accept(intent);
  f.persistence.update({ ...f.checkpoint, unresolvedOperation: true, operationId: intent.operationId });
  await Promise.resolve(); expect(f.repository.write).toHaveBeenCalledTimes(1);
  lease.release(); await f.persistence.flush(key, 1);
  expect(f.repository.write).toHaveBeenCalledTimes(1);
});
it("accepts only consecutive own-namespace atomic commits and never a competitor's sequence", async () => {
  const f = setup(); const lease = await f.persistence.beginAtomic(key, 1);
  expect(() => lease.accept({ ...lease.checkpoint, localPersistSequence: 9 })).toThrow();
  expect(() => lease.accept({ ...lease.checkpoint, localPersistSequence: 2, actorKey: "2" })).toThrow();
  lease.release();
});
it("refuses atomic adoption over a newer edit while preserving the newer requested checkpoint", async () => {
  const f = setup(); const lease = await f.persistence.beginAtomic(key, 1);
  f.persistence.update({ ...f.checkpoint, editRevision: 2 });
  expect(() => lease.accept({ ...lease.checkpoint, localPersistSequence: 2 })).toThrow();
  lease.release();
  expect(Object.values(f.persistence.state.getState().documents)[0].phase).toBe("conflict");
  expect(Object.values(f.persistence.state.getState().documents)[0].editRevision).toBe(2);
});
it("explicit operation recovery retries a failed settlement without a generic draft write or sequence adoption", async () => {
  const f = setup(); const lease = await f.persistence.beginAtomic(key, 1);
  const operationId = "11111111-2222-4333-8444-555555555555";
  lease.accept({ ...lease.checkpoint, localPersistSequence: 2, unresolvedOperation: true, operationId });
  lease.fail(new DraftRepositoryError("quota")); lease.release();
  const retry = await f.persistence.beginAtomic(key, 1, { retryOperationId: operationId });
  expect(retry.checkpoint.localPersistSequence).toBe(2); expect(f.repository.write).toHaveBeenCalledTimes(1); retry.release();
  await expect(f.persistence.beginAtomic(key, 1, { retryOperationId: "22222222-2222-4333-8444-555555555555" })).rejects.toMatchObject({ code: "protected" });
});
it("refuses discard and owner release while an atomic transition holds the checkpoint", async () => {
  const f = setup(); const lease = await f.persistence.beginAtomic(key, 1);
  expect(await f.persistence.discard(key, 1, () => true)).toBe(false);
  expect(f.persistence.release(key)).toBe(false); expect(f.repository.delete).not.toHaveBeenCalled();
  lease.release(); expect(f.persistence.release(key)).toBe(true);
});
