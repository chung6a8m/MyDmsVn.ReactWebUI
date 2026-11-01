import { describe, expect, it, vi } from "vitest";
import { createLocalDraftPersistence, localDraftStateKey } from "../../../src/infrastructure/drafts/localDraftPersistence";
import { DraftRepositoryError, type DraftRecord } from "../../../src/infrastructure/drafts/draftRecord";
import type { FeatureDraftSnapshot } from "../../../src/infrastructure/drafts/featureDraftSnapshot";

const namespace = { deploymentEpoch: "11111111-2222-4333-8444-555555555555", actorKey: "1" };
const key = { feature: "sales" as const, localDocumentId: "local-sale" };
const stateKey = localDraftStateKey(key.feature, key.localDocumentId);
function checkpoint(editRevision = 1, raw = "1,invalid") {
  const draft = { saleId: null, expectedVersion: null, saleDate: "2026-11-02", customerId: "", warehouseId: "", employeeId: "", note: "", lines: [] };
  const snapshot: FeatureDraftSnapshot = { feature: "sales", serverId: null, draft, initialDraft: draft, baseline: null, postAcknowledgement: null,
    rawBuffers: { note: { raw, composing: true } }, lookupBuffers: {}, dirty: true };
  return { ...key, editRevision, snapshot, unresolvedOperation: false, operationId: null };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
function setup() {
  let current = true;
  const repository = {
    write: vi.fn(async (record: DraftRecord, _expected: number | null) => record),
    delete: vi.fn(async () => {}), read: vi.fn(), list: vi.fn(), close: vi.fn(),
  };
  const persistence = createLocalDraftPersistence({ namespace, repository, isCurrent: () => current, now: () => new Date("2026-11-02T00:00:00.000Z") });
  return { persistence, repository, leave: () => { current = false; } };
}

describe("local draft persistence queue", () => {
  it("never reports an old snapshot durable when retry follows a newer capture failure", async () => {
    const { persistence } = setup();
    persistence.update(checkpoint()); await persistence.flush(key);
    persistence.fail(key);
    await expect(persistence.retry(key)).rejects.toMatchObject({ code: "invalid-record" });
    expect(persistence.state.getState().documents[stateKey].phase).toBe("failed");
    persistence.update(checkpoint(3, "now within bounds")); await persistence.retry(key);
    expect(persistence.state.getState().documents[stateKey]).toMatchObject({ phase: "durable", editRevision: 3 });
  });
  it.each(["quota", "invalid-record"] as const)("discards abandoned edits after %s without trying to save them", async failure => {
    const { persistence, repository } = setup();
    persistence.update(checkpoint()); await persistence.flush(key);
    if (failure === "quota") {
      repository.write.mockRejectedValueOnce(new DraftRepositoryError("quota"));
      persistence.update(checkpoint(2)); await expect(persistence.flush(key)).rejects.toMatchObject({ code: "quota" });
    } else persistence.fail(key);
    const calls = repository.write.mock.calls.length;
    expect(await persistence.discard(key, 2, () => true)).toBe(true);
    expect(repository.write).toHaveBeenCalledTimes(calls); expect(repository.delete).toHaveBeenCalledWith({ ...namespace, ...key }, 1);
  });
  it("proves absence before discarding a never-persisted record and refuses a competitor record", async () => {
    const { persistence, repository } = setup();
    persistence.fail(key); repository.read.mockResolvedValueOnce({ kind: "available", record: {} });
    expect(await persistence.discard(key, 1, () => true)).toBe(false);
    repository.read.mockResolvedValueOnce({ kind: "missing" });
    expect(await persistence.discard(key, 1, () => true)).toBe(true); expect(repository.delete).not.toHaveBeenCalled();
  });
  it("coalesces edits and acknowledges only repository transaction completion", async () => {
    const { persistence, repository } = setup();
    const commit = deferred<DraftRecord>();
    repository.write.mockImplementationOnce(() => commit.promise);
    persistence.update(checkpoint(1)); persistence.update(checkpoint(2, "latest"));
    await tick();
    expect(repository.write).toHaveBeenCalledTimes(1);
    const sent = repository.write.mock.calls[0][0];
    expect(sent.snapshot.rawBuffers.note.raw).toBe("latest");
    expect(persistence.state.getState().documents[stateKey].phase).toBe("pending");
    let settled = false;
    const flushed = persistence.flush(key, 2).then(() => { settled = true; });
    await tick(); expect(settled).toBe(false);
    commit.resolve(sent); await flushed;
    expect(persistence.state.getState().documents[stateKey]).toMatchObject({ phase: "durable", editRevision: 2, localPersistSequence: 1 });
  });

  it("flush waits for the newer snapshot queued behind an older in-flight write", async () => {
    const { persistence, repository } = setup();
    const first = deferred<DraftRecord>(); const second = deferred<DraftRecord>();
    repository.write.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    persistence.update(checkpoint()); await tick();
    persistence.update(checkpoint(2, "second"));
    let settled = false; const flushed = persistence.flush(key, 2).then(() => { settled = true; });
    first.resolve(repository.write.mock.calls[0][0]); await tick();
    expect(settled).toBe(false);
    expect(repository.write.mock.calls[1][1]).toBe(1);
    second.resolve(repository.write.mock.calls[1][0]); await flushed;
    expect(persistence.state.getState().documents[stateKey]).toMatchObject({ phase: "durable", localPersistSequence: 2 });
  });

  it("retains latest RAM input after quota failure and retries only local persistence explicitly", async () => {
    const { persistence, repository } = setup();
    repository.write.mockRejectedValueOnce(new DraftRepositoryError("quota"));
    persistence.update(checkpoint());
    await expect(persistence.flush(key, 1)).rejects.toMatchObject({ code: "quota" });
    persistence.update(checkpoint(2, "still in RAM")); await tick();
    expect(repository.write).toHaveBeenCalledTimes(1);
    expect(persistence.state.getState().documents[stateKey]).toMatchObject({ phase: "failed", errorCode: "quota" });
    await persistence.retry(key);
    expect(repository.write.mock.calls[1][0].snapshot.rawBuffers.note.raw).toBe("still in RAM");
    expect(persistence.state.getState().documents[stateKey].phase).toBe("durable");
  });

  it("never adopts a competitor sequence to turn a CAS conflict into an overwrite", async () => {
    const { persistence, repository } = setup();
    persistence.adopt({ ...namespace, ...checkpoint(), schemaVersion: 1, localPersistSequence: 7, savedAt: "2026-11-02T00:00:00.000Z" });
    repository.write.mockRejectedValue(new DraftRepositoryError("conflict"));
    persistence.update(checkpoint(2));
    await expect(persistence.flush(key, 2)).rejects.toMatchObject({ code: "conflict" });
    await expect(persistence.retry(key)).rejects.toMatchObject({ code: "conflict" });
    expect(repository.write.mock.calls.map(call => call[1])).toEqual([7, 7]);
    expect(repository.read).not.toHaveBeenCalled();
  });

  it("does not discard after identity changes while the latest flush is pending", async () => {
    const { persistence, repository } = setup();
    const commit = deferred<DraftRecord>(); repository.write.mockImplementationOnce(() => commit.promise);
    persistence.update(checkpoint()); await tick();
    let admitted = true;
    const discarding = persistence.discard(key, 1, () => admitted);
    admitted = false; commit.resolve(repository.write.mock.calls[0][0]);
    expect(await discarding).toBe(false);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("preserves the session and rewrites a later edit when it arrives during deletion", async () => {
    const { persistence, repository } = setup();
    persistence.update(checkpoint()); await persistence.flush(key, 1);
    const removal = deferred<void>(); repository.delete.mockImplementationOnce(() => removal.promise);
    let admitted = true; const discarding = persistence.discard(key, 1, () => admitted);
    await tick(); expect(repository.delete).toHaveBeenCalledTimes(1);
    persistence.update(checkpoint(2, "edit after discard began")); admitted = false;
    removal.resolve(); expect(await discarding).toBe(false);
    await persistence.flush(key, 2);
    expect(repository.write.mock.calls.at(-1)?.[1]).toBeNull();
    expect(repository.write.mock.calls.at(-1)?.[0].snapshot.rawBuffers.note.raw).toBe("edit after discard began");
  });

  it("keeps protected operation records even when discard is otherwise admitted", async () => {
    const { persistence, repository } = setup();
    persistence.update({ ...checkpoint(), unresolvedOperation: true });
    await persistence.flush(key, 1);
    expect(await persistence.discard(key, 1, () => true)).toBe(false);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("fences queued callbacks and clears visible state after scope disposal", async () => {
    const { persistence, repository, leave } = setup();
    const commit = deferred<DraftRecord>(); repository.write.mockImplementationOnce(() => commit.promise);
    persistence.update(checkpoint()); await tick(); persistence.update(checkpoint(2));
    leave(); persistence.dispose(); commit.resolve(repository.write.mock.calls[0][0]); await tick();
    expect(repository.write).toHaveBeenCalledTimes(1);
    expect(repository.close).toHaveBeenCalledTimes(1);
    expect(persistence.state.getState().documents).toEqual({});
    await expect(persistence.flush(key, 2)).rejects.toMatchObject({ code: "closed" });
  });

  it("rejects restoration from another database before exposing local content", () => {
    const { persistence } = setup();
    expect(() => persistence.adopt({ ...namespace, ...checkpoint(), deploymentEpoch: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", schemaVersion: 1, localPersistSequence: 1, savedAt: "2026-11-02T00:00:00.000Z" })).toThrow();
    expect(persistence.state.getState().documents).toEqual({});
  });
});
