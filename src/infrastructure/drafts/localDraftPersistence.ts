import { createStore } from "zustand/vanilla";
import { decodeDraftRecord, DraftRepositoryError, validateDraftNamespace, type DraftNamespace, type DraftRecord, type DraftRepositoryErrorCode } from "./draftRecord";
import type { DraftRepository } from "./indexedDbDraftRepository";

export type LocalDraftKey = Pick<DraftRecord, "feature" | "localDocumentId">;
export type DraftCheckpoint = LocalDraftKey & Pick<DraftRecord, "editRevision" | "snapshot" | "unresolvedOperation" | "operationId">;
export interface LocalDraftStatus {
  phase: "pending" | "durable" | "failed" | "conflict";
  editRevision: number;
  localPersistSequence: number | null;
  errorCode?: DraftRepositoryErrorCode;
}
interface Entry {
  key: LocalDraftKey;
  requested?: DraftCheckpoint;
  signature?: string;
  durableSignature?: string;
  sequence: number | null;
  record?: DraftRecord;
  error?: DraftRepositoryError;
  captureFailed?: boolean;
  scheduled: boolean;
  discarding: boolean;
  flight?: Promise<void>;
}
export function localDraftStateKey(feature: string, localDocumentId: string) {
  return JSON.stringify([feature, localDocumentId]);
}
const code = (error: unknown) => error instanceof DraftRepositoryError ? error : new DraftRepositoryError("unavailable");

// The feature stores stay synchronous. This queue acknowledges only completed repository
// transactions and never advances a conflicted writer to someone else's sequence.
export function createLocalDraftPersistence(options: {
  namespace: DraftNamespace;
  repository: DraftRepository;
  isCurrent(): boolean;
  now?: () => Date;
}) {
  validateDraftNamespace(options.namespace);
  const namespace = { ...options.namespace };
  const state = createStore<{ documents: Record<string, LocalDraftStatus> }>(() => ({ documents: {} }));
  const entries = new Map<string, Entry>();
  let disposed = false;
  const active = () => !disposed && options.isCurrent();
  function requireActive() { if (!active()) throw new DraftRepositoryError("closed"); }
  function get(key: LocalDraftKey) {
    const id = localDraftStateKey(key.feature, key.localDocumentId);
    let entry = entries.get(id);
    if (!entry) { entry = { key: { ...key }, sequence: null, scheduled: false, discarding: false }; entries.set(id, entry); }
    return entry;
  }
  function publish(entry: Entry) {
    if (!active()) return;
    const error = entry.error;
    const value: LocalDraftStatus = {
      phase: error ? error.code === "conflict" ? "conflict" : "failed" : entry.signature === entry.durableSignature && !!entry.record ? "durable" : "pending",
      editRevision: entry.requested?.editRevision ?? entry.record?.editRevision ?? 0,
      localPersistSequence: entry.sequence,
      ...(error ? { errorCode: error.code } : {}),
    };
    state.setState(previous => ({ documents: { ...previous.documents, [localDraftStateKey(entry.key.feature, entry.key.localDocumentId)]: value } }));
  }
  function schedule(entry: Entry) {
    if (!active() || entry.scheduled || entry.flight || entry.error || entry.discarding || !entry.requested || entry.signature === entry.durableSignature) return;
    entry.scheduled = true;
    queueMicrotask(() => { entry.scheduled = false; if (active()) void start(entry); });
  }
  function start(entry: Entry): Promise<void> {
    if (entry.flight) return entry.flight;
    if (!active() || entry.error || entry.discarding || !entry.requested) return Promise.resolve();
    const task = (async () => {
      while (active() && !entry.error && !entry.discarding && entry.requested && entry.signature !== entry.durableSignature) {
        const signature = entry.signature;
        const requested = structuredClone(entry.requested);
        const next: DraftRecord = { ...namespace, ...requested, schemaVersion: 1,
          localPersistSequence: (entry.sequence ?? 0) + 1, savedAt: (options.now?.() ?? new Date()).toISOString() };
        try {
          const committed = await options.repository.write(next, entry.sequence);
          if (!active()) return;
          entry.sequence = committed.localPersistSequence;
          entry.record = committed;
          entry.durableSignature = signature;
          publish(entry);
        } catch (error) {
          entry.error = code(error);
          publish(entry);
        }
      }
    })();
    entry.flight = task.finally(() => { entry.flight = undefined; schedule(entry); });
    return entry.flight;
  }
  function update(checkpoint: DraftCheckpoint) {
    requireActive();
    const entry = get(checkpoint);
    try {
      const captured = structuredClone(checkpoint);
      const signature = JSON.stringify(captured);
      entry.captureFailed = false;
      if (signature === entry.signature) return;
      entry.requested = captured;
      entry.signature = signature;
      publish(entry);
      schedule(entry);
    } catch { entry.captureFailed = true; entry.error = new DraftRepositoryError("invalid-record"); publish(entry); }
  }
  async function flush(key: LocalDraftKey, expectedEditRevision?: number): Promise<DraftRecord> {
    requireActive();
    const entry = entries.get(localDraftStateKey(key.feature, key.localDocumentId));
    if (!entry?.requested) throw new DraftRepositoryError("invalid-record");
    if (entry.discarding) throw new DraftRepositoryError("conflict");
    do {
      if (entry.error) throw entry.error;
      await start(entry);
      requireActive();
      if (entry.error) throw entry.error;
    } while (entry.signature !== entry.durableSignature);
    if (expectedEditRevision !== undefined && entry.requested.editRevision !== expectedEditRevision) throw new DraftRepositoryError("conflict");
    if (!entry.record) throw new DraftRepositoryError("invalid-record");
    return structuredClone(entry.record);
  }
  function adopt(record: DraftRecord) {
    requireActive();
    const key = { feature: record.feature, localDocumentId: record.localDocumentId };
    const validated = decodeDraftRecord(record, { ...namespace, ...key });
    const id = localDraftStateKey(key.feature, key.localDocumentId);
    if (entries.has(id)) throw new DraftRepositoryError("conflict");
    const requested: DraftCheckpoint = { ...key, editRevision: validated.editRevision, snapshot: validated.snapshot,
      unresolvedOperation: validated.unresolvedOperation, operationId: validated.operationId };
    const signature = JSON.stringify(requested);
    const entry: Entry = { key, requested, signature, durableSignature: signature, sequence: validated.localPersistSequence,
      record: validated, scheduled: false, discarding: false };
    entries.set(id, entry); publish(entry);
  }
  async function discard(key: LocalDraftKey, editRevision: number, stillAdmitted: () => boolean): Promise<boolean> {
    requireActive();
    const id = localDraftStateKey(key.feature, key.localDocumentId);
    const entry = entries.get(id);
    if (!entry) return stillAdmitted();
    if (entry.discarding || entry.requested?.unresolvedOperation || entry.record?.unresolvedOperation) return false;
    if (!entry.error && entry.requested && entry.requested.editRevision !== editRevision) return false;
    entry.discarding = true;
    try {
      // Discard abandons the latest RAM edits. Wait only for an already-started
      // transaction; quota/invalid input must not force us to save those edits.
      if (entry.flight) await entry.flight;
      if (!stillAdmitted() || !active() || entry.requested?.unresolvedOperation || entry.record?.unresolvedOperation) return false;
      if (entry.sequence !== null) await options.repository.delete({ ...namespace, ...key }, entry.sequence);
      else {
        const existing = await options.repository.read({ ...namespace, ...key });
        if (existing.kind !== "missing") throw new DraftRepositoryError("conflict");
      }
      // A new edit can arrive during the asynchronous delete. Keep RAM/session alive and
      // persist that edit as a fresh CAS insertion instead of finalising a stale close.
      entry.sequence = null; entry.record = undefined; entry.durableSignature = undefined;
      if (!active()) return false;
      if (!stillAdmitted()) return false;
      entries.delete(id);
      state.setState(previous => { const documents = { ...previous.documents }; delete documents[id]; return { documents }; });
      return true;
    } catch (error) { entry.error = code(error); publish(entry); return false; }
    finally { entry.discarding = false; if (entries.get(id) === entry) { publish(entry); schedule(entry); } }
  }
  return {
    namespace, state, update, adopt, flush, discard,
    release(key: LocalDraftKey) {
      const id = localDraftStateKey(key.feature, key.localDocumentId);
      const entry = entries.get(id);
      if (!entry || entry.flight || entry.scheduled || entry.signature !== entry.durableSignature) return false;
      entries.delete(id);
      state.setState(previous => { const documents = { ...previous.documents }; delete documents[id]; return { documents }; });
      return true;
    },
    fail(key: LocalDraftKey, error: DraftRepositoryError = new DraftRepositoryError("invalid-record")) {
      if (!active()) return;
      const entry = get(key); entry.captureFailed = true; entry.error = error; publish(entry);
    },
    async retry(key: LocalDraftKey) {
      requireActive(); const entry = get(key);
      if (entry.captureFailed) throw entry.error ?? new DraftRepositoryError("invalid-record");
      options.repository.retryConnection?.();
      entry.error = undefined; publish(entry);
      return flush(key);
    },
    dispose() { if (disposed) return; disposed = true; entries.clear(); state.setState({ documents: {} }); options.repository.close(); },
  };
}
export type LocalDraftPersistence = ReturnType<typeof createLocalDraftPersistence>;
