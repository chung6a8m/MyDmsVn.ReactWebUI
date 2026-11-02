import { z } from "../http/cspZod";
import { deploymentEpochSchema } from "../http/operationsContext";
import { canonicalizeWeb4Request, decodeFrozenWeb4Operation, frozenWeb4OperationSchema, parseWeb4WireIntent, receiptPostOperationRequest, receiptSaveOperationRequest, salesPostOperationRequest, salesSaveOperationRequest, web4OperationIdSchema, type FrozenWeb4Operation } from "../http/web4OperationCodec";
import { web3LongId, web3Version } from "../http/web3WireSchemas";
import { decodeWeb4OperationOutcome, type Web4CommittedResult } from "../http/operationStatusPort";
import { validateDirectRejection, type Web4DirectRejection } from "../http/directWriteRejection";
import { mapSalesDetail } from "../http/salesWireMapper";
import { mapGoodsReceiptDetail } from "../http/goodsReceiptWireMapper";
import { DraftRepositoryError, decodeDraftRecord, draftKey, validateDraftKey, validateDraftNamespace, type DraftKey, type DraftNamespace, type DraftRecord } from "./draftRecord";

export interface OperationKey extends DraftNamespace { operationId: string }
const safeSequence = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const timestamp = z.string().refine(value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
const settlementSchema = z.object({ draftSequence: safeSequence, settledAt: timestamp, resultDocumentId: web3LongId, status: z.enum(["Draft", "Posted"]), version: web3Version.optional() }).strict();
const rejectionSchema = z.object({ httpStatus: z.number().int(), code: z.string(), draftSequence: safeSequence, rejectedAt: timestamp }).strict();
const operationRecordShape = {
  schemaVersion: z.literal(1), deploymentEpoch: deploymentEpochSchema, actorKey: z.string(), operationId: web4OperationIdSchema,
  feature: z.enum(["sales", "goods-receipt"]), localDocumentId: z.string(), draftCheckpointSequence: safeSequence,
  draftCheckpointEditRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), createdAt: timestamp, frozen: z.unknown(),
};
const operationRecordSchema = z.discriminatedUnion("state", [
  z.object({ ...operationRecordShape, state: z.literal("DISPATCHED"), localPersistSequence: z.literal(1), settlement: z.null() }).strict(),
  z.object({ ...operationRecordShape, state: z.literal("SETTLED"), localPersistSequence: z.literal(2), settlement: settlementSchema }).strict(),
  z.object({ ...operationRecordShape, state: z.literal("REJECTED"), localPersistSequence: z.literal(2), settlement: z.null(), rejection: rejectionSchema }).strict(),
]);
type RawOperationRecord = z.infer<typeof operationRecordSchema>;
type WithFrozen<T> = T extends RawOperationRecord ? Omit<T, "frozen"> & { frozen: FrozenWeb4Operation } : never;
export type DurableOperationRecord = WithFrozen<RawOperationRecord>;
export function operationKey(key: OperationKey): [string, string, string] { return [key.deploymentEpoch, key.actorKey, key.operationId]; }
function validateOperationKey(key: OperationKey): void {
  validateDraftNamespace(key); web4OperationIdSchema.parse(key.operationId);
}
function structure(value: unknown, expectedKey?: OperationKey) {
  const parsed = operationRecordSchema.parse(value);
  validateDraftKey(parsed); validateOperationKey(parsed);
  if (expectedKey && operationKey(parsed).some((part, index) => part !== operationKey(expectedKey)[index])) throw new Error();
  const frozen = frozenWeb4OperationSchema.parse(parsed.frozen);
  parseWeb4WireIntent(frozen.request);
  if (frozen.operationId !== parsed.operationId || frozen.deploymentEpoch !== parsed.deploymentEpoch || frozen.actorKey !== parsed.actorKey ||
    (frozen.request.operationKind.startsWith("Sales.") ? "sales" : "goods-receipt") !== parsed.feature) throw new Error();
  if (parsed.state === "SETTLED") {
    const metadata = parsed.settlement;
    const post = frozen.request.operationKind.endsWith(".Post");
    if (metadata.status !== (post ? "Posted" : "Draft") || metadata.draftSequence <= parsed.draftCheckpointSequence ||
      (frozen.request.requestTargetId !== null && metadata.resultDocumentId !== frozen.request.requestTargetId) ||
      (frozen.request.operationKind === "Receipt.Post" ? Object.hasOwn(metadata, "version") : metadata.version === undefined)) throw new Error();
  } else if (parsed.state === "REJECTED") {
    validateDirectRejection({ operationKind: frozen.request.operationKind, httpStatus: parsed.rejection.httpStatus, code: parsed.rejection.code }, frozen.request.operationKind);
    if (parsed.rejection.draftSequence <= parsed.draftCheckpointSequence) throw new Error();
  }
  return { ...parsed, frozen };
}
export async function decodeDurableOperationRecord(value: unknown, expectedKey?: OperationKey): Promise<DurableOperationRecord> {
  try {
    const parsed = structure(value, expectedKey);
    const frozen = await decodeFrozenWeb4Operation(parsed.frozen);
    return { ...parsed, frozen };
  } catch { throw new DraftRepositoryError("invalid-record"); }
}

function namespaceRange(key: DraftNamespace) {
  return IDBKeyRange.bound([key.deploymentEpoch, key.actorKey], [key.deploymentEpoch, `${key.actorKey}\u0000`], false, true);
}
function primaryOperationKey(value: IDBValidKey): OperationKey {
  if (!Array.isArray(value) || value.length !== 3 || value.some(part => typeof part !== "string")) throw new DraftRepositoryError("invalid-record");
  const key = { deploymentEpoch: value[0], actorKey: value[1], operationId: value[2] } as OperationKey;
  validateOperationKey(key); return key;
}
function knownOtherOwner(value: unknown, key: DraftKey): boolean {
  if (!value || typeof value !== "object") return false;
  const candidate = value as DraftKey;
  try {
    validateDraftKey(candidate);
    return candidate.deploymentEpoch === key.deploymentEpoch && candidate.actorKey === key.actorKey &&
      (candidate.feature !== key.feature || candidate.localDocumentId !== key.localDocumentId);
  } catch { return false; }
}
// This guard is deliberately synchronous inside a transaction. It never accepts
// an operation as positive evidence; any unresolved/uncertain owner blocks writes.
export interface DraftOperationCandidate { key: OperationKey; value: unknown }
export function guardUnresolvedDraftOperation(store: IDBObjectStore, key: DraftKey, done: (terminal: DraftOperationCandidate[]) => void, fail: (error: unknown) => void, collectTerminal = false): void {
  const terminal: DraftOperationCandidate[] = [];
  const request = store.openCursor(namespaceRange(key));
  request.onsuccess = () => {
    try {
      const cursor = request.result;
      if (!cursor) { done(terminal); return; }
      const primary = primaryOperationKey(cursor.primaryKey);
      if (!knownOtherOwner(cursor.value, key)) {
        const record = structure(cursor.value, primary);
        if (record.state === "DISPATCHED") throw new DraftRepositoryError("protected");
        if (collectTerminal) terminal.push({ key: primary, value: cursor.value });
      }
      cursor.continue();
    } catch (error) { fail(error instanceof DraftRepositoryError ? error : new DraftRepositoryError("invalid-record")); }
  };
}

export type OperationReadResult = { kind: "missing" } | { kind: "available"; operation: DurableOperationRecord } | { kind: "quarantined"; key: OperationKey; reason: "invalid-record" };
export interface BeginWeb4Operation {
  draft: DraftRecord;
  operation: FrozenWeb4Operation;
  expectedDraftSequence: number | null;
}
export interface SettleWeb4Operation {
  operationKey: OperationKey;
  expectedOperationSequence: number;
  expectedDraftSequence: number;
  settledDraft: DraftRecord;
  proof: Web4CommittedResult;
}
export interface RejectWeb4Operation {
  operationKey: OperationKey;
  expectedOperationSequence: number;
  expectedDraftSequence: number;
  rejectedDraft: DraftRecord;
  proof: Web4DirectRejection;
}
export interface OperationCheckpoint { draft: DraftRecord; operation: DurableOperationRecord }
export interface Web4OperationRepository {
  begin(input: BeginWeb4Operation): Promise<OperationCheckpoint>;
  read(key: OperationKey): Promise<OperationReadResult>;
  findForDraft(key: DraftKey): Promise<{ operations: DurableOperationRecord[]; quarantined: boolean }>;
  settle(input: SettleWeb4Operation): Promise<OperationCheckpoint>;
  reject(input: RejectWeb4Operation): Promise<OperationCheckpoint>;
  retryConnection?(): void;
  close(): void;
}
export interface Web4OperationRepositoryOptions { databaseName?: string; indexedDB?: Pick<IDBFactory, "open"> }
function storageError(error: unknown): DraftRepositoryError {
  if (error instanceof DraftRepositoryError) return error;
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  return new DraftRepositoryError(name === "QuotaExceededError" ? "quota" : name === "VersionError" ? "versionchange" : name === "SecurityError" || name === "NotSupportedError" ? "unavailable" : "transaction-aborted");
}
function sequence(value: number | null): boolean { return value === null || Number.isSafeInteger(value) && value > 0; }
function requireValue(value: boolean, code: "conflict" | "protected" | "invalid-record" = "invalid-record"): void { if (!value) throw new DraftRepositoryError(code); }
function checkpointRequest(draft: DraftRecord, post: boolean) {
  const snapshot = draft.snapshot;
  if (snapshot.feature === "sales") return post
    ? salesPostOperationRequest({ saleId: snapshot.serverId!, expectedVersion: snapshot.draft.expectedVersion! }) : salesSaveOperationRequest(snapshot.draft);
  return post ? receiptPostOperationRequest({ receiptId: snapshot.serverId!, expectedVersion: snapshot.draft.expectedVersion! }) : receiptSaveOperationRequest(snapshot.draft);
}
function validateSettledDraft(draft: DraftRecord, proof: Web4CommittedResult): void {
  const snapshot = draft.snapshot;
  requireValue(!draft.unresolvedOperation && draft.operationId === null && !snapshot.dirty);
  if (proof.operationKind === "Sales.Post") {
    requireValue(snapshot.feature === "sales" && snapshot.serverId === proof.value.saleId && JSON.stringify(snapshot.postAcknowledgement) === JSON.stringify(proof.value));
  } else if (proof.operationKind === "Receipt.Post") {
    requireValue(snapshot.feature === "goods-receipt" && snapshot.serverId === proof.value.receiptId && JSON.stringify(snapshot.postAcknowledgement) === JSON.stringify(proof.value));
  } else {
    requireValue(Object.keys(snapshot.rawBuffers).length === 0 && snapshot.postAcknowledgement === null && snapshot.baseline !== null);
    const expected = "saleId" in proof.value ? salesSaveOperationRequest(mapSalesDetail(proof.value).saved) : receiptSaveOperationRequest(mapGoodsReceiptDetail(proof.value).saved);
    requireValue(canonicalizeWeb4Request(checkpointRequest(draft, false)) === canonicalizeWeb4Request(expected));
    const baseline = snapshot.feature === "sales" ? salesSaveOperationRequest(snapshot.baseline!.saved) : receiptSaveOperationRequest(snapshot.baseline!.saved);
    requireValue(canonicalizeWeb4Request(baseline) === canonicalizeWeb4Request(expected));
  }
}

export function createWeb4OperationRepository(options: Web4OperationRepositoryOptions = {}): Web4OperationRepository {
  let db: IDBDatabase | null = null;
  let opening: Promise<IDBDatabase> | null = null;
  let closed = false;
  let fatal: DraftRepositoryError | null = null;
  function open(): Promise<IDBDatabase> {
    if (closed || fatal) return Promise.reject(fatal ?? new DraftRepositoryError("closed"));
    if (db) return Promise.resolve(db);
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      let rejected = false;
      const fail = (error: unknown) => { rejected = true; reject(storageError(error)); };
      let request: IDBOpenDBRequest;
      try {
        const factory = options.indexedDB ?? globalThis.indexedDB;
        if (!factory) throw new DraftRepositoryError("unavailable");
        // Shared with F02; both stores already belong to this version-1 database.
        request = factory.open(options.databaseName ?? "mydmsvn-drafts-v1", 1);
      } catch (error) { fail(error); return; }
      request.onblocked = () => { fatal = new DraftRepositoryError("blocked"); fail(fatal); };
      request.onerror = () => fail(request.error);
      request.onupgradeneeded = () => {
        if (closed || rejected) { request.transaction?.abort(); return; }
        for (const store of ["drafts", "operations"]) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
      };
      request.onsuccess = () => {
        const connection = request.result;
        if (closed || rejected) { connection.close(); fail(new DraftRepositoryError(closed ? "closed" : "blocked")); return; }
        try {
          const check = connection.transaction(["drafts", "operations"]);
          requireValue(check.objectStore("drafts").keyPath === null && check.objectStore("operations").keyPath === null);
          connection.onversionchange = () => { fatal = new DraftRepositoryError("versionchange"); connection.close(); db = null; };
          connection.onclose = () => { if (db === connection) { db = null; if (!closed && !fatal) fatal = new DraftRepositoryError("unavailable"); } };
          db = connection; resolve(connection);
        } catch (error) { connection.close(); fail(error); }
      };
    });
    void opening.catch(() => { opening = null; });
    return opening;
  }
  async function transaction<T>(mode: IDBTransactionMode, work: (drafts: IDBObjectStore, operations: IDBObjectStore, done: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
    const connection = await open();
    if (closed || fatal) throw fatal ?? new DraftRepositoryError("closed");
    return new Promise<T>((resolve, reject) => {
      let tx: IDBTransaction;
      try { tx = connection.transaction(["drafts", "operations"], mode); } catch (error) { reject(storageError(error)); return; }
      let result: T, ready = false, failure: DraftRepositoryError | null = null;
      const fail = (error: unknown) => { failure ??= storageError(error); try { tx.abort(); } catch { reject(failure); } };
      tx.oncomplete = () => failure ? reject(failure) : ready ? resolve(result) : reject(new DraftRepositoryError("transaction-aborted"));
      tx.onabort = () => reject(failure ?? storageError(tx.error));
      tx.onerror = event => { failure ??= storageError((event.target as IDBRequest).error ?? tx.error); };
      try { work(tx.objectStore("drafts"), tx.objectStore("operations"), value => { result = value; ready = true; }, fail); }
      catch (error) { fail(error); }
    });
  }
  const rawRead = (key: OperationKey) => transaction<{ present: boolean; value?: unknown }>("readonly", (_drafts, operations, done) => {
    const request = operations.openCursor(IDBKeyRange.only(operationKey(key)));
    request.onsuccess = () => done(request.result ? { present: true, value: request.result.value } : { present: false });
  });
  return {
    retryConnection() {
      if (closed) throw new DraftRepositoryError("closed");
      if (!fatal) return;
      db?.close(); db = null; opening = null; fatal = null;
    },
    async begin(input) {
      const draft = decodeDraftRecord(input.draft);
      const expectedSequence = input.expectedDraftSequence;
      requireValue(sequence(expectedSequence) && draft.localPersistSequence === (expectedSequence ?? 0) + 1, "conflict");
      requireValue(!draft.unresolvedOperation && draft.operationId === null, "protected");
      const frozen = await decodeFrozenWeb4Operation(input.operation);
      requireValue(frozen.actorKey === draft.actorKey && frozen.deploymentEpoch === draft.deploymentEpoch && (frozen.request.operationKind.startsWith("Sales.") ? "sales" : "goods-receipt") === draft.feature);
      requireValue(draft.snapshot.postAcknowledgement === null && draft.snapshot.baseline?.status !== "Posted", "protected");
      const post = frozen.request.operationKind.endsWith(".Post");
      requireValue(!post || !draft.snapshot.dirty, "protected");
      requireValue(canonicalizeWeb4Request(checkpointRequest(draft, post)) === canonicalizeWeb4Request(frozen.request));
      const protectedDraft = decodeDraftRecord({ ...draft, unresolvedOperation: true, operationId: frozen.operationId });
      const operation: DurableOperationRecord = { schemaVersion: 1, deploymentEpoch: draft.deploymentEpoch, actorKey: draft.actorKey, operationId: frozen.operationId,
        feature: draft.feature, localDocumentId: draft.localDocumentId, localPersistSequence: 1, draftCheckpointSequence: draft.localPersistSequence,
        draftCheckpointEditRevision: draft.editRevision, createdAt: draft.savedAt, frozen, state: "DISPATCHED", settlement: null };
      return transaction<OperationCheckpoint>("readwrite", (drafts, operations, done, fail) => {
        guardUnresolvedDraftOperation(operations, draft, () => {
          const existingOperation = operations.openCursor(IDBKeyRange.only(operationKey(operation)));
          existingOperation.onsuccess = () => {
            try {
              requireValue(existingOperation.result === null, "conflict");
              const previous = drafts.openCursor(IDBKeyRange.only(draftKey(draft)));
              previous.onsuccess = () => {
                try {
                  const current = previous.result ? decodeDraftRecord(previous.result.value, draft) : null;
                  requireValue(!current?.unresolvedOperation, "protected");
                  requireValue((current?.localPersistSequence ?? null) === expectedSequence && (!current || draft.editRevision >= current.editRevision), "conflict");
                  drafts.put(protectedDraft, draftKey(protectedDraft));
                  operations.put(operation, operationKey(operation));
                  done({ draft: protectedDraft, operation });
                } catch (error) { fail(error); }
              };
            } catch (error) { fail(error); }
          };
        }, fail);
      });
    },
    async read(inputKey) {
      const key = { ...inputKey }; validateOperationKey(key);
      const raw = await rawRead(key);
      if (!raw.present) return { kind: "missing" };
      try { return { kind: "available", operation: await decodeDurableOperationRecord(raw.value, key) }; }
      catch { return { kind: "quarantined", key, reason: "invalid-record" }; }
    },
    async findForDraft(inputKey) {
      const key = { ...inputKey }; validateDraftKey(key);
      const candidates = await transaction<{ key: OperationKey | null; value: unknown }[]>("readonly", (_drafts, operations, done, fail) => {
        const values: { key: OperationKey | null; value: unknown }[] = [];
        const request = operations.openCursor(namespaceRange(key));
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) { done(values); return; }
          try {
            if (!knownOtherOwner(cursor.value, key)) {
              try { values.push({ key: primaryOperationKey(cursor.primaryKey), value: cursor.value }); }
              catch { values.push({ key: null, value: null }); }
            }
            cursor.continue();
          } catch (error) { fail(error); }
        };
      });
      const operations: DurableOperationRecord[] = []; let quarantined = false;
      for (const candidate of candidates) {
        if (!candidate.key) { quarantined = true; continue; }
        try { operations.push(await decodeDurableOperationRecord(candidate.value, candidate.key)); }
        catch { quarantined = true; }
      }
      return { operations, quarantined };
    },
    async settle(input) {
      const key = { ...input.operationKey }; validateOperationKey(key);
      const draft = decodeDraftRecord(input.settledDraft);
      const expectedOperationSequence = input.expectedOperationSequence, expectedDraftSequence = input.expectedDraftSequence;
      const proofInput = structuredClone(input.proof);
      const raw = await rawRead(key);
      requireValue(raw.present, "conflict");
      const originalBytes = JSON.stringify(raw.value);
      // Rehash outside the transaction; the transaction below compares the exact
      // bytes again before it changes either store, closing the validation race.
      const operation = await decodeDurableOperationRecord(raw.value, key);
      requireValue(operation.state === "DISPATCHED" && operation.localPersistSequence === expectedOperationSequence, "conflict");
      requireValue(sequence(expectedDraftSequence) && draft.localPersistSequence === expectedDraftSequence + 1 && draft.editRevision === operation.draftCheckpointEditRevision, "conflict");
      requireValue(draftKey(draft).every((part, index) => part === draftKey(operation)[index]));
      requireValue(proofInput.kind === "committed" && proofInput.operationKind === operation.frozen.request.operationKind);
      const proof = decodeWeb4OperationOutcome(operation.frozen.request, proofInput.value);
      validateSettledDraft(draft, proof);
      const resultDocumentId = "saleId" in proof.value ? proof.value.saleId : proof.value.receiptId;
      const settlement = { draftSequence: draft.localPersistSequence, settledAt: draft.savedAt, resultDocumentId, status: proof.value.status,
        ...("version" in proof.value ? { version: proof.value.version } : {}) };
      const settled: DurableOperationRecord = { ...operation, state: "SETTLED", localPersistSequence: 2, settlement };
      return transaction<OperationCheckpoint>("readwrite", (drafts, operations, done, fail) => {
        const operationRead = operations.openCursor(IDBKeyRange.only(operationKey(key)));
        operationRead.onsuccess = () => {
          try {
            requireValue(operationRead.result !== null && JSON.stringify(operationRead.result.value) === originalBytes, "conflict");
            const draftRead = drafts.openCursor(IDBKeyRange.only(draftKey(draft)));
            draftRead.onsuccess = () => {
              try {
                requireValue(draftRead.result !== null, "conflict");
                const current = decodeDraftRecord(draftRead.result!.value, draft);
                requireValue(current.localPersistSequence === expectedDraftSequence && current.editRevision === operation.draftCheckpointEditRevision, "conflict");
                requireValue(current.unresolvedOperation && current.operationId === operation.operationId, "protected");
                drafts.put(draft, draftKey(draft)); operations.put(settled, operationKey(settled));
                done({ draft, operation: settled });
              } catch (error) { fail(error); }
            };
          } catch (error) { fail(error); }
        };
      });
    },
    async reject(input) {
      const key = { ...input.operationKey }; validateOperationKey(key);
      const draft = decodeDraftRecord(input.rejectedDraft);
      const expectedOperationSequence = input.expectedOperationSequence, expectedDraftSequence = input.expectedDraftSequence;
      const proofInput = structuredClone(input.proof);
      const raw = await rawRead(key);
      requireValue(raw.present, "conflict");
      const originalBytes = JSON.stringify(raw.value);
      const operation = await decodeDurableOperationRecord(raw.value, key);
      requireValue(operation.state === "DISPATCHED" && operation.localPersistSequence === expectedOperationSequence, "conflict");
      requireValue(sequence(expectedDraftSequence) && draft.localPersistSequence === expectedDraftSequence + 1 && draft.editRevision === operation.draftCheckpointEditRevision, "conflict");
      requireValue(draftKey(draft).every((part, index) => part === draftKey(operation)[index]));
      requireValue(!draft.unresolvedOperation && draft.operationId === null);
      const proof = validateDirectRejection(proofInput, operation.frozen.request.operationKind);
      // This is an explicit business acknowledgement from the first live write,
      // never negative status evidence or an operator UNKNOWN disposition.
      const rejected: DurableOperationRecord = { ...operation, state: "REJECTED", localPersistSequence: 2, settlement: null,
        rejection: { httpStatus: proof.httpStatus, code: proof.code, draftSequence: draft.localPersistSequence, rejectedAt: draft.savedAt } };
      return transaction<OperationCheckpoint>("readwrite", (drafts, operations, done, fail) => {
        const operationRead = operations.openCursor(IDBKeyRange.only(operationKey(key)));
        operationRead.onsuccess = () => {
          try {
            requireValue(operationRead.result !== null && JSON.stringify(operationRead.result.value) === originalBytes, "conflict");
            const draftRead = drafts.openCursor(IDBKeyRange.only(draftKey(draft)));
            draftRead.onsuccess = () => {
              try {
                requireValue(draftRead.result !== null, "conflict");
                const current = decodeDraftRecord(draftRead.result!.value, draft);
                requireValue(current.localPersistSequence === expectedDraftSequence && current.editRevision === operation.draftCheckpointEditRevision, "conflict");
                requireValue(current.unresolvedOperation && current.operationId === operation.operationId, "protected");
                requireValue(JSON.stringify(current.snapshot) === JSON.stringify(draft.snapshot));
                requireValue(canonicalizeWeb4Request(checkpointRequest(current, operation.frozen.request.operationKind.endsWith(".Post"))) === canonicalizeWeb4Request(operation.frozen.request));
                drafts.put(draft, draftKey(draft)); operations.put(rejected, operationKey(rejected));
                done({ draft, operation: rejected });
              } catch (error) { fail(error); }
            };
          } catch (error) { fail(error); }
        };
      });
    },
    close() { closed = true; db?.close(); db = null; },
  };
}
