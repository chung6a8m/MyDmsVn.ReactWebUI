import { z } from "../http/cspZod";
import { deploymentEpochSchema } from "../http/operationsContext";
import { decodeFrozenWeb4Operation, frozenWeb4OperationSchema, web4OperationIdSchema, type FrozenWeb4Operation } from "../http/web4OperationCodec";
import { DraftRepositoryError, decodeDraftRecord, draftKey, type DraftRecord } from "./draftRecord";
import { decodeDurableOperationRecord, operationKey, type DurableOperationRecord, type OperationKey } from "./web4OperationRepository";
import { draftDatabaseVersion, upgradeDraftDatabase, validateDraftDatabase, type DraftDatabaseStore } from "./draftDatabase";

const safeSequence = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const safeRevision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const utc7 = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/);
const utc3 = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/).refine(value => new Date(value).toISOString() === value);
const actorKey = z.string().regex(/^[1-9][0-9]{0,9}$/).refine(value => Number(value) <= 2147483647);
const keyShape = { deploymentEpoch: deploymentEpochSchema, actorKey, operationId: web4OperationIdSchema };
const receiptSchema = z.object({
  schemaVersion: z.literal(1), candidateId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
  frozen: frozenWeb4OperationSchema, feature: z.enum(["sales", "goods-receipt"]), localDocumentId: z.string().min(1),
  sourceDraftSequence: safeSequence, sourceOperationSequence: safeSequence, editRevision: safeRevision,
  issuedAtUtc: utc7, eligibleUntilUtc: utc7, receipt: z.string().min(5).max(4096).regex(/^[\x21-\x7e]+$/),
}).strict();
const claimShape = { schemaVersion: z.literal(1), ...keyShape, requestFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  feature: z.enum(["sales", "goods-receipt"]), localDocumentId: z.string().min(1), sourceDraftSequence: safeSequence,
  sourceOperationSequence: safeSequence, editRevision: safeRevision, generation: safeRevision,
  consentId: web4OperationIdSchema, claimedAt: utc3 };
const claimSchema = z.discriminatedUnion("state", [
  z.object({ ...claimShape, state: z.literal("CLAIMED") }).strict(),
  z.object({ ...claimShape, state: z.literal("RESPONSE_OBSERVED"), observedAt: utc3 }).strict(),
]);

export type ManualResendReceipt = Omit<z.infer<typeof receiptSchema>, "frozen"> & { frozen: FrozenWeb4Operation };
export type ManualResendClaim = z.infer<typeof claimSchema>;
export interface ClaimManualResendInput { operationKey: OperationKey; expectedDraft: DraftRecord; expectedOperation: DurableOperationRecord; generation: number; consentId: string; claimedAt: string }
export interface ObserveManualResendResponseInput { operationKey: OperationKey; expectedConsentId: string; observedAt: string }
export interface Web6ManualResendRepositoryOptions { databaseName?: string; indexedDB?: Pick<IDBFactory, "open"> }
export interface Web6ManualResendRepository {
  storeManualResendReceipt(input: ManualResendReceipt): Promise<ManualResendReceipt>;
  readManualResendReceipt(key: OperationKey): Promise<{ kind: "missing" } | { kind: "available"; receipt: ManualResendReceipt } | { kind: "quarantined" }>;
  claimManualResend(input: ClaimManualResendInput): Promise<ManualResendClaim>;
  readManualResendClaim(key: OperationKey): Promise<{ kind: "missing" } | { kind: "available"; claim: ManualResendClaim } | { kind: "quarantined" }>;
  observeManualResendResponse(input: ObserveManualResendResponseInput): Promise<ManualResendClaim>;
  retryConnection(): void;
  close(): void;
}

function storageError(error: unknown): DraftRepositoryError {
  if (error instanceof DraftRepositoryError) return error;
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  return new DraftRepositoryError(name === "QuotaExceededError" ? "quota" : name === "VersionError" ? "versionchange" :
    name === "SecurityError" || name === "NotSupportedError" ? "unavailable" : "transaction-aborted");
}
function reject(code: "conflict" | "protected" | "invalid-record"): never { throw new DraftRepositoryError(code); }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function same(left: unknown, right: unknown): boolean { return canonical(left) === canonical(right); }
function primary(value: Pick<OperationKey, "deploymentEpoch" | "actorKey" | "operationId">): [string, string, string] {
  try { deploymentEpochSchema.parse(value.deploymentEpoch); actorKey.parse(value.actorKey); web4OperationIdSchema.parse(value.operationId); }
  catch { reject("invalid-record"); }
  return operationKey(value);
}
async function decodeReceipt(value: unknown, expected?: OperationKey): Promise<ManualResendReceipt> {
  try {
    const parsed = receiptSchema.parse(value), frozen = await decodeFrozenWeb4Operation(parsed.frozen);
    if (expected && primary(frozen).some((part, index) => part !== primary(expected)[index])) reject("invalid-record");
    const feature = frozen.request.operationKind.startsWith("Sales.") ? "sales" : "goods-receipt";
    if (parsed.feature !== feature || parsed.sourceOperationSequence !== 1 || parsed.eligibleUntilUtc <= parsed.issuedAtUtc) reject("invalid-record");
    return { ...parsed, frozen };
  } catch (error) { if (error instanceof DraftRepositoryError) throw error; throw new DraftRepositoryError("invalid-record"); }
}
function decodeClaim(value: unknown, expected?: OperationKey): ManualResendClaim {
  try {
    const parsed = claimSchema.parse(value);
    if (expected && primary(parsed).some((part, index) => part !== primary(expected)[index])) reject("invalid-record");
    return parsed;
  } catch (error) { if (error instanceof DraftRepositoryError) throw error; throw new DraftRepositoryError("invalid-record"); }
}

export function createWeb6ManualResendRepository(options: Web6ManualResendRepositoryOptions = {}): Web6ManualResendRepository {
  let database: IDBDatabase | null = null, opening: Promise<IDBDatabase> | null = null;
  let closed = false, fatal: DraftRepositoryError | null = null;
  function open(): Promise<IDBDatabase> {
    if (closed || fatal) return Promise.reject(fatal ?? new DraftRepositoryError("closed"));
    if (database) return Promise.resolve(database);
    if (opening) return opening;
    opening = new Promise((resolve, rejectPromise) => {
      let failed = false;
      const fail = (error: unknown) => { if (!failed) { failed = true; rejectPromise(storageError(error)); } };
      let request: IDBOpenDBRequest;
      try {
        const factory = options.indexedDB ?? globalThis.indexedDB;
        if (!factory) throw new DraftRepositoryError("unavailable");
        request = factory.open(options.databaseName ?? "mydmsvn-drafts-v1", draftDatabaseVersion);
      } catch (error) { fail(error); return; }
      request.onblocked = () => { fatal = new DraftRepositoryError("blocked"); fail(fatal); };
      request.onerror = () => fail(request.error);
      request.onupgradeneeded = () => { if (closed || failed) request.transaction?.abort(); else upgradeDraftDatabase(request.result); };
      request.onsuccess = () => {
        const connection = request.result;
        if (closed || failed) { connection.close(); fail(new DraftRepositoryError(closed ? "closed" : "blocked")); return; }
        try {
          validateDraftDatabase(connection);
          connection.onversionchange = () => { fatal = new DraftRepositoryError("versionchange"); connection.close(); database = null; };
          connection.onclose = () => { if (database === connection) { database = null; if (!closed && !fatal) fatal = new DraftRepositoryError("unavailable"); } };
          database = connection; resolve(connection);
        } catch (error) { connection.close(); fail(error); }
      };
    });
    void opening.catch(() => { opening = null; });
    return opening;
  }
  async function transaction<T>(mode: IDBTransactionMode, stores: DraftDatabaseStore[], work: (tx: IDBTransaction, done: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
    const db = await open();
    if (closed || fatal) throw fatal ?? new DraftRepositoryError("closed");
    return new Promise<T>((resolve, rejectPromise) => {
      let tx: IDBTransaction;
      try { tx = db.transaction(stores, mode); } catch (error) { rejectPromise(storageError(error)); return; }
      let result!: T, ready = false, failure: DraftRepositoryError | null = null;
      const fail = (error: unknown) => { failure ??= storageError(error); try { tx.abort(); } catch { rejectPromise(failure); } };
      tx.oncomplete = () => failure ? rejectPromise(failure) : ready ? resolve(result) : rejectPromise(new DraftRepositoryError("transaction-aborted"));
      tx.onabort = () => rejectPromise(failure ?? storageError(tx.error));
      tx.onerror = event => { failure ??= storageError((event.target as IDBRequest).error ?? tx.error); };
      try { work(tx, value => { result = value; ready = true; }, fail); } catch (error) { fail(error); }
    });
  }
  async function rawRead(store: "manualResendReceipts" | "manualResendClaims", key: OperationKey) {
    return transaction<{ present: boolean; value?: unknown }>("readonly", [store], (tx, done) => {
      const request = tx.objectStore(store).get(primary(key));
      request.onsuccess = () => done(request.result === undefined ? { present: false } : { present: true, value: request.result });
    });
  }
  return {
    async storeManualResendReceipt(input) {
      const receipt = await decodeReceipt(input), key = primary(receipt.frozen);
      return transaction("readwrite", ["manualResendReceipts"], (tx, done, fail) => {
        const store = tx.objectStore("manualResendReceipts"), read = store.get(key);
        read.onsuccess = () => { try {
          if (read.result !== undefined) { if (!same(read.result, receipt)) reject("conflict"); done(receipt); return; }
          const write = store.add(receipt, key); write.onsuccess = () => done(receipt);
        } catch (error) { fail(error); } };
      });
    },
    async readManualResendReceipt(key) {
      const raw = await rawRead("manualResendReceipts", key);
      if (!raw.present) return { kind: "missing" };
      try { return { kind: "available", receipt: await decodeReceipt(raw.value, key) }; } catch { return { kind: "quarantined" }; }
    },
    async claimManualResend(input) {
      const draft = decodeDraftRecord(input.expectedDraft);
      const operation = await decodeDurableOperationRecord(input.expectedOperation, input.operationKey);
      if (operation.state !== "DISPATCHED" || operation.localPersistSequence !== 1 || !draft.unresolvedOperation ||
        draft.operationId !== operation.operationId || draft.localPersistSequence !== operation.draftCheckpointSequence ||
        draft.editRevision !== operation.draftCheckpointEditRevision) reject("conflict");
      const found = await this.readManualResendReceipt(input.operationKey);
      if (found.kind !== "available") reject(found.kind === "quarantined" ? "invalid-record" : "protected");
      const receipt = found.receipt;
      if (!same(receipt.frozen, operation.frozen) || receipt.localDocumentId !== draft.localDocumentId ||
        receipt.sourceDraftSequence !== draft.localPersistSequence || receipt.sourceOperationSequence !== operation.localPersistSequence || receipt.editRevision !== draft.editRevision) reject("conflict");
      const claim = claimSchema.parse({ schemaVersion: 1, ...input.operationKey, requestFingerprint: operation.frozen.requestFingerprint,
        feature: operation.feature, localDocumentId: operation.localDocumentId, sourceDraftSequence: draft.localPersistSequence,
        sourceOperationSequence: operation.localPersistSequence, editRevision: draft.editRevision, generation: input.generation,
        consentId: input.consentId, claimedAt: input.claimedAt, state: "CLAIMED" });
      const key = primary(input.operationKey);
      return transaction("readwrite", ["drafts", "operations", "manualResendReceipts", "manualResendClaims"], (tx, done, fail) => {
        const draftRead = tx.objectStore("drafts").get(draftKey(draft));
        const operationRead = tx.objectStore("operations").get(key);
        const receiptRead = tx.objectStore("manualResendReceipts").get(key);
        const claimRead = tx.objectStore("manualResendClaims").get(key);
        const lineageRead = tx.objectStore("operations").openCursor(IDBKeyRange.bound(
          [input.operationKey.deploymentEpoch, input.operationKey.actorKey],
          [input.operationKey.deploymentEpoch, `${input.operationKey.actorKey}\u0000`], false, true));
        let completed = 0;
        const check = () => { if (++completed !== 5) return; try {
          if (!same(draftRead.result, draft) || !same(operationRead.result, operation) || !same(receiptRead.result, receipt) || claimRead.result !== undefined) reject("conflict");
          const write = tx.objectStore("manualResendClaims").add(claim, key); write.onsuccess = () => done(claim);
        } catch (error) { fail(error); } };
        draftRead.onsuccess = check; operationRead.onsuccess = check; receiptRead.onsuccess = check; claimRead.onsuccess = check;
        lineageRead.onsuccess = () => { try {
          const cursor = lineageRead.result;
          if (!cursor) { check(); return; }
          const candidate = cursor.value as Partial<DurableOperationRecord> | null;
          if (!same(cursor.primaryKey, key) && candidate && candidate.feature === operation.feature && candidate.localDocumentId === operation.localDocumentId &&
            (candidate.state === "DISPATCHED" || candidate.state === "NOT_EXECUTED")) reject("protected");
          cursor.continue();
        } catch (error) { fail(error); } };
      });
    },
    async readManualResendClaim(key) {
      const raw = await rawRead("manualResendClaims", key);
      if (!raw.present) return { kind: "missing" };
      try { return { kind: "available", claim: decodeClaim(raw.value, key) }; } catch { return { kind: "quarantined" }; }
    },
    async observeManualResendResponse(input) {
      const key = primary(input.operationKey);
      return transaction("readwrite", ["manualResendClaims"], (tx, done, fail) => {
        const store = tx.objectStore("manualResendClaims"), read = store.get(key);
        read.onsuccess = () => { try {
          if (read.result === undefined) reject("protected");
          const current = decodeClaim(read.result, input.operationKey);
          if (current.consentId !== input.expectedConsentId) reject("conflict");
          if (current.state === "RESPONSE_OBSERVED") { done(current); return; }
          const next = claimSchema.parse({ ...current, state: "RESPONSE_OBSERVED", observedAt: input.observedAt });
          const write = store.put(next, key); write.onsuccess = () => done(next);
        } catch (error) { fail(error); } };
      });
    },
    retryConnection() { if (closed) throw new DraftRepositoryError("closed"); if (!fatal) return; database?.close(); database = null; opening = null; fatal = null; },
    close() { closed = true; database?.close(); database = null; },
  };
}
