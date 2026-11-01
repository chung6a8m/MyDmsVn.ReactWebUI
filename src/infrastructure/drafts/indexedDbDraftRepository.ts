import {
  type DraftKey, type DraftNamespace, type DraftQuarantineReason, type DraftRecord,
  DraftRepositoryError, decodeDraftRecord, draftKey, validateDraftKey, validateDraftNamespace,
} from "./draftRecord";

export interface QuarantinedDraft { key: DraftKey | null; reason: DraftQuarantineReason }
export type DraftReadResult = { kind: "missing" } | { kind: "available"; record: DraftRecord } | ({ kind: "quarantined" } & QuarantinedDraft);
export interface DraftListResult {
  records: DraftRecord[];
  quarantined: QuarantinedDraft[];
  conflicts: { feature: DraftKey["feature"]; serverId: string; localDocumentIds: string[] }[];
}
export interface DraftRepository {
  read(key: DraftKey): Promise<DraftReadResult>;
  list(namespace: DraftNamespace): Promise<DraftListResult>;
  write(record: DraftRecord, expectedSequence: number | null): Promise<DraftRecord>;
  delete(key: DraftKey, expectedSequence: number): Promise<void>;
  retryConnection?(): void;
  close(): void;
}
export interface IndexedDbDraftRepositoryOptions {
  databaseName?: string;
  indexedDB?: Pick<IDBFactory, "open">;
}
function storageError(error: unknown): DraftRepositoryError {
  if (error instanceof DraftRepositoryError) return error;
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  if (name === "QuotaExceededError") return new DraftRepositoryError("quota");
  if (name === "VersionError") return new DraftRepositoryError("versionchange");
  if (name === "SecurityError" || name === "NotSupportedError") return new DraftRepositoryError("unavailable");
  return new DraftRepositoryError("transaction-aborted");
}
function quarantine(key: DraftKey | null, error: unknown): QuarantinedDraft {
  return { key, reason: error instanceof DraftRepositoryError ? error.reason ?? "invalid-shape" : "invalid-shape" };
}
function keyFromPrimary(primary: IDBValidKey): DraftKey | null {
  if (!Array.isArray(primary) || primary.length !== 4 || primary.some(part => typeof part !== "string")) return null;
  const key = { deploymentEpoch: primary[0], actorKey: primary[1], feature: primary[2], localDocumentId: primary[3] } as DraftKey;
  try { validateDraftKey(key); return key; } catch { return null; }
}
function expectedSequenceIsValid(sequence: number | null): boolean {
  return sequence === null || Number.isSafeInteger(sequence) && sequence > 0;
}

export function createIndexedDbDraftRepository(options: IndexedDbDraftRepositoryOptions = {}): DraftRepository {
  let database: IDBDatabase | null = null;
  let opening: Promise<IDBDatabase> | null = null;
  let closed = false;
  let fatal: DraftRepositoryError | null = null;

  function open(): Promise<IDBDatabase> {
    if (closed) return Promise.reject(new DraftRepositoryError("closed"));
    if (fatal) return Promise.reject(fatal);
    if (database) return Promise.resolve(database);
    if (opening) return opening;
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      let rejected = false;
      const fail = (error: DraftRepositoryError) => { rejected = true; reject(error); };
      let request: IDBOpenDBRequest;
      try {
        const factory = options.indexedDB ?? globalThis.indexedDB;
        if (!factory) throw new DraftRepositoryError("unavailable");
        request = factory.open(options.databaseName ?? "mydmsvn-drafts-v1", 1);
      } catch (error) { fail(storageError(error)); return; }
      request.onblocked = () => { fatal = new DraftRepositoryError("blocked"); fail(fatal); };
      request.onerror = () => fail(storageError(request.error));
      request.onupgradeneeded = () => {
        if (closed || rejected) { request.transaction?.abort(); return; }
        const db = request.result;
        // Out-of-line compound keys make the primary scope authoritative even
        // when persisted value fields are corrupt. F03 owns operation payloads.
        if (!db.objectStoreNames.contains("drafts")) db.createObjectStore("drafts");
        if (!db.objectStoreNames.contains("operations")) db.createObjectStore("operations");
      };
      request.onsuccess = () => {
        const db = request.result;
        if (closed || rejected) { db.close(); fail(new DraftRepositoryError(closed ? "closed" : "blocked")); return; }
        if (!db.objectStoreNames.contains("drafts") || !db.objectStoreNames.contains("operations")) {
          db.close(); fail(new DraftRepositoryError("invalid-record", "invalid-shape")); return;
        }
        const schema = db.transaction(["drafts", "operations"]);
        if (schema.objectStore("drafts").keyPath !== null || schema.objectStore("operations").keyPath !== null) {
          db.close(); fail(new DraftRepositoryError("invalid-record", "invalid-shape")); return;
        }
        db.onversionchange = () => {
          fatal = new DraftRepositoryError("versionchange");
          db.close(); database = null;
        };
        db.onclose = () => { if (database === db) { database = null; if (!closed && !fatal) fatal = new DraftRepositoryError("unavailable"); } };
        database = db; resolve(db);
      };
    });
    // A failed connection stays fenced until the user explicitly retries.
    void opening.catch(() => { opening = null; });
    return opening;
  }

  async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, done: (result: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
    const db = await open();
    if (closed || fatal) throw fatal ?? new DraftRepositoryError("closed");
    return new Promise<T>((resolve, reject) => {
      let tx: IDBTransaction;
      try { tx = db.transaction("drafts", mode); } catch (error) { reject(storageError(error)); return; }
      let result: T;
      let ready = false;
      let failure: DraftRepositoryError | null = null;
      const fail = (error: unknown) => {
        failure ??= storageError(error);
        try { tx.abort(); } catch { reject(failure); }
      };
      tx.oncomplete = () => {
        if (failure) reject(failure);
        else if (!ready) reject(new DraftRepositoryError("transaction-aborted"));
        else resolve(result);
      };
      tx.onabort = () => reject(failure ?? storageError(tx.error));
      tx.onerror = event => { failure ??= storageError((event.target as IDBRequest).error ?? tx.error); };
      try { action(tx.objectStore("drafts"), value => { result = value; ready = true; }, fail); }
      catch (error) { fail(error); }
    });
  }

  return {
    retryConnection() {
      if (closed) throw new DraftRepositoryError("closed");
      if (!fatal) return;
      database?.close(); database = null; opening = null; fatal = null;
    },
    async read(inputKey) {
      validateDraftKey(inputKey);
      const key = { deploymentEpoch: inputKey.deploymentEpoch, actorKey: inputKey.actorKey, feature: inputKey.feature, localDocumentId: inputKey.localDocumentId };
      return transaction<DraftReadResult>("readonly", (store, done) => {
        const request = store.openCursor(IDBKeyRange.only(draftKey(key)));
        request.onsuccess = () => {
          if (request.result === null) { done({ kind: "missing" }); return; }
          try { done({ kind: "available", record: decodeDraftRecord(request.result.value, key) }); }
          catch (error) { done({ kind: "quarantined", ...quarantine(key, error) }); }
        };
      });
    },
    async list(namespace) {
      validateDraftNamespace(namespace);
      const { deploymentEpoch, actorKey } = namespace;
      return transaction<DraftListResult>("readonly", (store, done, fail) => {
        const records: DraftRecord[] = [];
        const quarantined: QuarantinedDraft[] = [];
        // A NUL appended to the canonical numeric actor string is its next
        // prefix boundary, including malformed suffix keys but no other actor.
        const range = IDBKeyRange.bound([deploymentEpoch, actorKey], [deploymentEpoch, `${actorKey}\u0000`], false, true);
        const request = store.openCursor(range);
        request.onsuccess = () => {
          try {
            const cursor = request.result;
            if (!cursor) {
              const grouped = new Map<string, DraftRecord[]>();
              for (const record of records) {
                if (record.snapshot.serverId === null) continue;
                const groupKey = JSON.stringify([record.feature, record.snapshot.serverId]);
                grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), record]);
              }
              const conflicts = [...grouped.values()].filter(group => group.length > 1).map(group => ({
                feature: group[0].feature, serverId: group[0].snapshot.serverId!, localDocumentIds: group.map(record => record.localDocumentId),
              }));
              done({ records, quarantined, conflicts }); return;
            }
            const key = keyFromPrimary(cursor.primaryKey);
            if (!key) quarantined.push({ key: null, reason: "invalid-shape" });
            else {
              try { records.push(decodeDraftRecord(cursor.value, key)); }
              catch (error) { quarantined.push(quarantine(key, error)); }
            }
            cursor.continue();
          } catch (error) { fail(error); }
        };
      });
    },
    async write(input, expectedSequence) {
      const record = decodeDraftRecord(input);
      if (!expectedSequenceIsValid(expectedSequence) || record.localPersistSequence !== (expectedSequence ?? 0) + 1) throw new DraftRepositoryError("conflict");
      return transaction<DraftRecord>("readwrite", (store, done, fail) => {
        const request = store.openCursor(IDBKeyRange.only(draftKey(record)));
        request.onsuccess = () => {
          try {
            const previous = request.result === null ? null : decodeDraftRecord(request.result.value, record);
            if ((previous?.localPersistSequence ?? null) !== expectedSequence || previous && record.editRevision < previous.editRevision) throw new DraftRepositoryError("conflict");
            if (previous?.unresolvedOperation && (!record.unresolvedOperation || previous.operationId !== record.operationId)) throw new DraftRepositoryError("protected");
            const put = store.put(record, draftKey(record));
            put.onsuccess = () => done(record);
          } catch (error) { fail(error); }
        };
      });
    },
    async delete(inputKey, expectedSequence) {
      validateDraftKey(inputKey);
      if (!expectedSequenceIsValid(expectedSequence) || expectedSequence === null) throw new DraftRepositoryError("conflict");
      const key = { deploymentEpoch: inputKey.deploymentEpoch, actorKey: inputKey.actorKey, feature: inputKey.feature, localDocumentId: inputKey.localDocumentId };
      return transaction<void>("readwrite", (store, done, fail) => {
        const request = store.openCursor(IDBKeyRange.only(draftKey(key)));
        request.onsuccess = () => {
          try {
            if (request.result === null) throw new DraftRepositoryError("conflict");
            const record = decodeDraftRecord(request.result.value, key);
            if (record.unresolvedOperation) throw new DraftRepositoryError("protected");
            if (record.localPersistSequence !== expectedSequence) throw new DraftRepositoryError("conflict");
            const deletion = store.delete(draftKey(key));
            deletion.onsuccess = () => done(undefined);
          } catch (error) { fail(error); }
        };
      });
    },
    close() { closed = true; database?.close(); database = null; },
  };
}
