import { expect, test } from "@playwright/test";
import type * as Harness from "./helpers/web4OperationRepositoryHarness";
declare global { interface Window { web4OperationTest: typeof Harness } }
test.beforeEach(async ({ page }) => {
  await page.goto("/lab/components");
  await page.evaluate(async () => {
    const path = "/tests/e2e/helpers/web4OperationRepositoryHarness.ts";
    window.web4OperationTest = await import(/* @vite-ignore */ path);
  });
});

for (const stem of ["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"]) {
  test(`atomic intent and original positive settlement: ${stem}`, async ({ page }) => {
    const result = await page.evaluate(async stem => {
      const h = window.web4OperationTest, name = crypto.randomUUID();
      const operations = h.createWeb4OperationRepository({ databaseName: name });
      const drafts = h.createIndexedDbDraftRepository({ databaseName: name });
      const prepared = await h.prepared(stem);
      const begun = await operations.begin(prepared);
      const before = { operation: await operations.read(prepared.operation), draft: await drafts.read(prepared.draft) };
      const ordinaryDelete = await h.code(() => drafts.delete(prepared.draft, 1));
      const settled = await operations.settle({ operationKey: prepared.operation, expectedOperationSequence: 1, expectedDraftSequence: 1, settledDraft: prepared.settledDraft, proof: prepared.proof });
      const after = { operation: await operations.read(prepared.operation), draft: await drafts.read(prepared.draft) };
      await drafts.write({ ...prepared.settledDraft, editRevision: 8, localPersistSequence: 3 }, 2);
      await drafts.delete(prepared.draft, 3);
      const missing = await drafts.read(prepared.draft), removedOperation = await operations.read(prepared.operation);
      operations.close(); drafts.close();
      return { begun, before, ordinaryDelete, settled, after, missing, removedOperation };
    }, stem);
    expect(result.begun.operation.state).toBe("DISPATCHED");
    expect(result.before).toMatchObject({ operation: { kind: "available", operation: { state: "DISPATCHED" } }, draft: { kind: "available", record: { unresolvedOperation: true } } });
    expect(result.ordinaryDelete).toBe("protected");
    expect(result.settled.operation.state).toBe("SETTLED");
    expect(result.after).toMatchObject({ operation: { kind: "available", operation: { localPersistSequence: 2 } }, draft: { kind: "available", record: { localPersistSequence: 2, unresolvedOperation: false, operationId: null } } });
    expect(result.missing).toEqual({ kind: "missing" });
    expect(result.removedOperation).toEqual({ kind: "missing" });
    if (stem === "receipt-post") expect(result.settled.operation.settlement).not.toHaveProperty("version");
    else expect(result.settled.operation.settlement).toHaveProperty("version");
    expect(JSON.stringify(result.settled.operation.settlement)).not.toContain("lines");
  });
}

test("a crash boundary before HTTP leaves both records durable and does not send on reload", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", request => {
    if (request.method() !== "GET" && /\/api\/v1\/(sales-receipts|goods-receipts)(\/|$)/.test(new URL(request.url()).pathname)) writes.push(`${request.method()} ${request.url()}`);
  });
  const name = `operation-reload-${test.info().testId}`;
  const saved = await page.evaluate(async name => {
    const h = window.web4OperationTest, input = await h.prepared();
    const repository = h.createWeb4OperationRepository({ databaseName: name });
    await repository.begin(input); repository.close(); return input;
  }, name);
  await page.reload();
  const result = await page.evaluate(async ({ name, saved }) => {
    const path = "/tests/e2e/helpers/web4OperationRepositoryHarness.ts";
    const h: typeof Harness = await import(/* @vite-ignore */ path);
    const repository = h.createWeb4OperationRepository({ databaseName: name });
    const operation = await repository.read(saved.operation), found = await repository.findForDraft(saved.draft);
    repository.close(); return { operation, found };
  }, { name, saved });
  expect(result.operation).toMatchObject({ kind: "available", operation: { state: "DISPATCHED", settlement: null } });
  expect(result.found.operations).toHaveLength(1);
  expect(result.found.quarantined).toBe(false);
  expect(writes).toEqual([]);
});

test("aborting the second store write rolls back both sides of begin and settlement", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web4OperationTest, name = crypto.randomUUID(), input = await h.prepared();
    const operations = h.createWeb4OperationRepository({ databaseName: name }), drafts = h.createIndexedDbDraftRepository({ databaseName: name });
    const original = IDBObjectStore.prototype.put;
    const inject = () => {
      IDBObjectStore.prototype.put = function (...args) {
        const request = original.apply(this, args);
        if (this.name === "operations") request.addEventListener("success", () => request.transaction!.abort());
        return request;
      };
    };
    inject(); let beginFailure: string;
    try { beginFailure = await h.code(() => operations.begin(input)); } finally { IDBObjectStore.prototype.put = original; }
    const failedBegin = { operation: await operations.read(input.operation), draft: await drafts.read(input.draft) };
    await operations.begin(input);
    inject(); let settleFailure: string;
    try { settleFailure = await h.code(() => operations.settle({ operationKey: input.operation, expectedOperationSequence: 1, expectedDraftSequence: 1, settledDraft: input.settledDraft, proof: input.proof })); }
    finally { IDBObjectStore.prototype.put = original; }
    const failedSettle = { operation: await operations.read(input.operation), draft: await drafts.read(input.draft) };
    operations.close(); drafts.close(); return { beginFailure, failedBegin, settleFailure, failedSettle };
  });
  expect(result.beginFailure).toBe("transaction-aborted");
  expect(result.failedBegin).toEqual({ operation: { kind: "missing" }, draft: { kind: "missing" } });
  expect(result.settleFailure).toBe("transaction-aborted");
  expect(result.failedSettle).toMatchObject({ operation: { operation: { state: "DISPATCHED" } }, draft: { record: { unresolvedOperation: true, localPersistSequence: 1 } } });
});

test("a tampered false draft marker cannot bypass begin, ordinary write or delete", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web4OperationTest, name = crypto.randomUUID(), input = await h.prepared();
    const operations = h.createWeb4OperationRepository({ databaseName: name }), drafts = h.createIndexedDbDraftRepository({ databaseName: name });
    await operations.begin(input);
    await h.rawPut(name, "drafts", h.draftKey(input.draft), input.draft);
    const next = { ...input.draft, localPersistSequence: 2 };
    const replacement = { ...input.operation, operationId: crypto.randomUUID() };
    const begin = await h.code(() => operations.begin({ draft: next, operation: replacement, expectedDraftSequence: 1 }));
    const write = await h.code(() => drafts.write(next, 1)), deletion = await h.code(() => drafts.delete(input.draft, 1));
    const found = await operations.findForDraft(input.draft);
    operations.close(); drafts.close(); return { begin, write, deletion, found };
  });
  expect(result).toMatchObject({ begin: "protected", write: "protected", deletion: "protected" });
  expect(result.found.operations).toHaveLength(1);
  expect(result.found.operations[0].state).toBe("DISPATCHED");
});

test("corrupted operation payload is quarantined and cannot be replaced or settled", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web4OperationTest, name = crypto.randomUUID(), input = await h.prepared();
    const operations = h.createWeb4OperationRepository({ databaseName: name }), drafts = h.createIndexedDbDraftRepository({ databaseName: name });
    const begun = await operations.begin(input);
    const corrupted = structuredClone(begun.operation) as any; delete corrupted.frozen.request.body;
    await h.rawPut(name, "operations", h.operationKey(input.operation), corrupted);
    await h.rawPut(name, "drafts", h.draftKey(input.draft), input.draft);
    const read = await operations.read(input.operation), found = await operations.findForDraft(input.draft);
    const deletion = await h.code(() => drafts.delete(input.draft, 1));
    const settlement = await h.code(() => operations.settle({ operationKey: input.operation, expectedOperationSequence: 1, expectedDraftSequence: 1, settledDraft: input.settledDraft, proof: input.proof }));
    operations.close(); drafts.close(); return { read, found, deletion, settlement };
  });
  expect(result.read).toMatchObject({ kind: "quarantined" });
  expect(result.found).toEqual({ operations: [], quarantined: true });
  expect(result.deletion).toBe("invalid-record");
  expect(result.settlement).toBe("invalid-record");
});

test("settlement never overwrites a newer draft revision or accepts the wrong result", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web4OperationTest, name = crypto.randomUUID(), input = await h.prepared();
    const operations = h.createWeb4OperationRepository({ databaseName: name }), drafts = h.createIndexedDbDraftRepository({ databaseName: name });
    const begun = await operations.begin(input);
    const badProof = structuredClone(input.proof) as any; badProof.value.note = "different result";
    const wrongResult = await h.code(() => operations.settle({ operationKey: input.operation, expectedOperationSequence: 1, expectedDraftSequence: 1, settledDraft: input.settledDraft, proof: badProof }));
    await h.rawPut(name, "drafts", h.draftKey(input.draft), { ...begun.draft, localPersistSequence: 2, editRevision: 8 });
    const stale = await h.code(() => operations.settle({ operationKey: input.operation, expectedOperationSequence: 1, expectedDraftSequence: 2, settledDraft: { ...input.settledDraft, localPersistSequence: 3 }, proof: input.proof }));
    const current = await drafts.read(input.draft), operation = await operations.read(input.operation);
    operations.close(); drafts.close(); return { wrongResult, stale, current, operation };
  });
  expect(result.wrongResult).toBe("invalid-record");
  expect(result.stale).toBe("conflict");
  expect(result.current).toMatchObject({ record: { localPersistSequence: 2, editRevision: 8, unresolvedOperation: true } });
  expect(result.operation).toMatchObject({ operation: { state: "DISPATCHED" } });
});

test("competing tabs cannot bind two operation IDs to one draft checkpoint", async ({ page, context }) => {
  const name = `operation-race-${test.info().testId}`, second = await context.newPage();
  await second.goto("/lab/components");
  const create = async (target: typeof page) => target.evaluate(async name => {
    const path = "/tests/e2e/helpers/web4OperationRepositoryHarness.ts";
    const h: typeof Harness = await import(/* @vite-ignore */ path), input = await h.prepared();
    const repository = h.createWeb4OperationRepository({ databaseName: name });
    const result = await h.code(() => repository.begin(input)); repository.close(); return result;
  }, name);
  expect((await Promise.all([create(page), create(second)])).sort()).toEqual(["protected", "success"]);
  await second.close();
});

test("unreadable own operation ownership fails closed without examining a foreign namespace", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web4OperationTest, name = crypto.randomUUID(), input = await h.prepared();
    const operations = h.createWeb4OperationRepository({ databaseName: name }), drafts = h.createIndexedDbDraftRepository({ databaseName: name });
    await operations.read(input.operation);
    await h.rawPut(name, "operations", ["22222222-2222-4333-8444-555555555555", input.operation.actorKey, input.operation.operationId], { private: "FOREIGN_CONTENT" });
    await h.rawPut(name, "operations", [input.operation.deploymentEpoch, "43", input.operation.operationId], undefined);
    await drafts.write(input.draft, null);
    const foreignIgnored = await operations.findForDraft(input.draft);
    await h.rawPut(name, "operations", h.operationKey(input.operation), { private: "CORRUPT_CONTENT" });
    const ownCorrupt = await operations.findForDraft(input.draft);
    const write = await h.code(() => drafts.write({ ...input.draft, localPersistSequence: 2 }, 1));
    const deletion = await h.code(() => drafts.delete(input.draft, 1));
    const begin = await h.code(() => operations.begin({ ...input, draft: { ...input.draft, localPersistSequence: 2 }, expectedDraftSequence: 1 }));
    operations.close(); drafts.close(); return { foreignIgnored, ownCorrupt, write, deletion, begin };
  });
  expect(result.foreignIgnored).toEqual({ operations: [], quarantined: false });
  expect(result.ownCorrupt).toEqual({ operations: [], quarantined: true });
  expect(result).toMatchObject({ write: "invalid-record", deletion: "invalid-record", begin: "invalid-record" });
  expect(JSON.stringify(result)).not.toMatch(/FOREIGN_CONTENT|CORRUPT_CONTENT/);
});

test("operation bytes changed during asynchronous rehash cannot settle through a stale validation", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web4OperationTest, name = crypto.randomUUID(), input = await h.prepared();
    const operations = h.createWeb4OperationRepository({ databaseName: name }), drafts = h.createIndexedDbDraftRepository({ databaseName: name });
    const begun = await operations.begin(input);
    let signalHash!: () => void, releaseHash!: () => void;
    const hashing = new Promise<void>(resolve => { signalHash = resolve; });
    const gate = new Promise<void>(resolve => { releaseHash = resolve; });
    const original = SubtleCrypto.prototype.digest;
    SubtleCrypto.prototype.digest = function (algorithm, data) {
      return original.call(this, algorithm, data).then(async digest => { signalHash(); await gate; return digest; });
    };
    let failure: string;
    try {
      const pending = h.code(() => operations.settle({ operationKey: input.operation, expectedOperationSequence: 1, expectedDraftSequence: 1, settledDraft: input.settledDraft, proof: input.proof }));
      await hashing;
      await h.rawPut(name, "operations", h.operationKey(input.operation), { ...begun.operation, createdAt: "2026-11-02T00:00:02.000Z" });
      releaseHash(); failure = await pending;
    } finally { releaseHash(); SubtleCrypto.prototype.digest = original; }
    const draft = await drafts.read(input.draft), operation = await operations.read(input.operation);
    operations.close(); drafts.close(); return { failure, draft, operation };
  });
  expect(result.failure).toBe("conflict");
  expect(result.draft).toMatchObject({ record: { localPersistSequence: 1, unresolvedOperation: true } });
  expect(result.operation).toMatchObject({ operation: { state: "DISPATCHED", settlement: null } });
});

test("explicit connection retry reads the existing protected intent without creating another operation", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web4OperationTest, name = crypto.randomUUID(), input = await h.prepared();
    const first = h.createWeb4OperationRepository({ databaseName: name });
    await first.begin(input); first.close();
    const blocker = await h.rawOpen(name);
    let opens = 0, finish!: () => void;
    const firstOpenFinished = new Promise<void>(resolve => { finish = resolve; });
    const factory = { open(dbName: string) {
      const request = indexedDB.open(dbName, 2);
      if (++opens === 1) { request.addEventListener("success", finish); request.addEventListener("error", finish); }
      return request;
    } };
    const repository = h.createWeb4OperationRepository({ databaseName: name, indexedDB: factory });
    const blocked = await h.code(() => repository.read(input.operation));
    blocker.close(); await firstOpenFinished;
    const stillBlocked = await h.code(() => repository.read(input.operation));
    const beforeRetry = opens;
    repository.retryConnection!();
    const retained = await repository.read(input.operation), found = await repository.findForDraft(input.draft);
    repository.close(); return { blocked, stillBlocked, beforeRetry, opens, retained, found };
  });
  expect(result).toMatchObject({ blocked: "blocked", stillBlocked: "blocked", beforeRetry: 1, opens: 2 });
  expect(result.retained).toMatchObject({ kind: "available", operation: { state: "DISPATCHED", localPersistSequence: 1 } });
  expect(result.found.operations).toHaveLength(1);
});

test("direct business rejection preserves the full source draft and allows only a new user operation ID", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web4OperationTest, name = crypto.randomUUID(), input = await h.prepared();
    input.draft.snapshot.rawBuffers.note = { raw: input.draft.snapshot.draft.note ?? "", composing: false };
    input.draft.snapshot.lookupBuffers.customerId = { selectedId: "101", displayText: "Khách riêng", query: "Khách riêng", confirmed: true, composing: false };
    const source = structuredClone(input.draft.snapshot);
    const operations = h.createWeb4OperationRepository({ databaseName: name }), drafts = h.createIndexedDbDraftRepository({ databaseName: name });
    await operations.begin(input);
    const rejectedDraft = { ...input.draft, localPersistSequence: 2, savedAt: "2026-11-02T00:00:01.000Z" };
    const rejected = await operations.reject({ operationKey: input.operation, expectedOperationSequence: 1, expectedDraftSequence: 1, rejectedDraft,
      proof: { operationKind: input.operation.request.operationKind, httpStatus: 400, code: "ValidationError" } });
    const reused = await h.code(() => operations.begin({ ...input, draft: { ...input.draft, localPersistSequence: 3 }, expectedDraftSequence: 2 }));
    const edited = { ...rejectedDraft, editRevision: 8, localPersistSequence: 3 };
    await drafts.write(edited, 2);
    const next = await operations.begin({ draft: { ...edited, localPersistSequence: 4 }, operation: { ...input.operation, operationId: crypto.randomUUID() }, expectedDraftSequence: 3 });
    const old = await operations.read(input.operation);
    operations.close(); drafts.close(); return { source, rejected, reused, next, old };
  });
  expect(result.rejected.draft.snapshot).toEqual(result.source);
  expect(result.rejected.draft).toMatchObject({ unresolvedOperation: false, operationId: null, localPersistSequence: 2 });
  expect(result.rejected.operation).toMatchObject({ state: "REJECTED", settlement: null, rejection: { httpStatus: 400, code: "ValidationError", draftSequence: 2 } });
  expect(result.reused).toBe("conflict");
  expect(result.next.operation.state).toBe("DISPATCHED");
  expect(result.next.operation.operationId).not.toBe(result.rejected.operation.operationId);
  expect(result.old).toMatchObject({ operation: { state: "REJECTED" } });
});

test("ambiguous or foreign-kind rejection and changed source never unlock the intent", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web4OperationTest, name = crypto.randomUUID(), input = await h.prepared();
    const operations = h.createWeb4OperationRepository({ databaseName: name }), drafts = h.createIndexedDbDraftRepository({ databaseName: name });
    await operations.begin(input);
    const rejectedDraft = { ...input.draft, localPersistSequence: 2, savedAt: "2026-11-02T00:00:01.000Z" };
    const failures = [];
    for (const proof of [
      { operationKind: "Receipt.Create", httpStatus: 400, code: "ValidationError" },
      { operationKind: "Sales.Create", httpStatus: 404, code: "Operation.NotObserved" },
      { operationKind: "Sales.Create", httpStatus: 409, code: "Idempotency.KeyConflict" },
      { operationKind: "Sales.Create", httpStatus: 403, code: "Auth.Forbidden" },
    ] as const) failures.push(await h.code(() => operations.reject({ operationKey: input.operation, expectedOperationSequence: 1, expectedDraftSequence: 1, rejectedDraft, proof })));
    const changed = structuredClone(rejectedDraft); changed.snapshot.draft.note = "changed source";
    failures.push(await h.code(() => operations.reject({ operationKey: input.operation, expectedOperationSequence: 1, expectedDraftSequence: 1, rejectedDraft: changed,
      proof: { operationKind: "Sales.Create", httpStatus: 400, code: "ValidationError" } })));
    const draft = await drafts.read(input.draft), operation = await operations.read(input.operation);
    operations.close(); drafts.close(); return { failures, draft, operation };
  });
  expect(result.failures).toEqual(Array(5).fill("invalid-record"));
  expect(result.draft).toMatchObject({ record: { unresolvedOperation: true, localPersistSequence: 1 } });
  expect(result.operation).toMatchObject({ operation: { state: "DISPATCHED" } });
});

test("failed local rejection persistence retains both protections until explicit local retry completes", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web4OperationTest, name = crypto.randomUUID(), input = await h.prepared("receipt-update");
    const operations = h.createWeb4OperationRepository({ databaseName: name }), drafts = h.createIndexedDbDraftRepository({ databaseName: name });
    await operations.begin(input);
    const args = { operationKey: input.operation, expectedOperationSequence: 1, expectedDraftSequence: 1, rejectedDraft: { ...input.draft, localPersistSequence: 2, savedAt: "2026-11-02T00:00:01.000Z" },
      proof: { operationKind: "Receipt.Update" as const, httpStatus: 409, code: "GoodsReceipt.ConcurrencyConflict" } };
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...parameters) {
      const request = original.apply(this, parameters);
      if (this.name === "operations") request.addEventListener("success", () => request.transaction!.abort());
      return request;
    };
    let failure: string;
    try { failure = await h.code(() => operations.reject(args)); } finally { IDBObjectStore.prototype.put = original; }
    const before = { operation: await operations.read(input.operation), draft: await drafts.read(input.draft) };
    const retried = await operations.reject(args);
    operations.close(); drafts.close(); return { failure, before, retried };
  });
  expect(result.failure).toBe("transaction-aborted");
  expect(result.before).toMatchObject({ operation: { operation: { state: "DISPATCHED" } }, draft: { record: { unresolvedOperation: true, localPersistSequence: 1 } } });
  expect(result.retried).toMatchObject({ operation: { state: "REJECTED" }, draft: { unresolvedOperation: false, localPersistSequence: 2 } });
});

test("admitted discard purges its terminal rejection payload and preserves other owners", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web4OperationTest, name = crypto.randomUUID(), input = await h.prepared(), other = await h.prepared("sales-create", "other-document");
    const operations = h.createWeb4OperationRepository({ databaseName: name }), drafts = h.createIndexedDbDraftRepository({ databaseName: name });
    await operations.begin(input); await operations.begin(other);
    await operations.reject({ operationKey: input.operation, expectedOperationSequence: 1, expectedDraftSequence: 1,
      rejectedDraft: { ...input.draft, localPersistSequence: 2 }, proof: { operationKind: "Sales.Create", httpStatus: 400, code: "ValidationError" } });
    const foreignKey = ["22222222-2222-4333-8444-555555555555", input.operation.actorKey, input.operation.operationId];
    await h.rawPut(name, "operations", foreignKey, { private: "foreign bytes" });
    await drafts.delete(input.draft, 2);
    const removed = { draft: await drafts.read(input.draft), operation: await operations.read(input.operation) };
    const retained = { draft: await drafts.read(other.draft), operation: await operations.read(other.operation) };
    const db = await h.rawOpen(name);
    const foreign = await new Promise<unknown>((resolve, reject) => { const request = db.transaction("operations").objectStore("operations").get(foreignKey); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close(); operations.close(); drafts.close(); return { removed, retained, foreign };
  });
  expect(result.removed).toEqual({ draft: { kind: "missing" }, operation: { kind: "missing" } });
  expect(result.retained).toMatchObject({ draft: { record: { unresolvedOperation: true } }, operation: { operation: { state: "DISPATCHED" } } });
  expect(result.foreign).toEqual({ private: "foreign bytes" });
});

test("terminal payload cleanup rejects corrupt fingerprints and changed bytes during rehash", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web4OperationTest, name = crypto.randomUUID(), input = await h.prepared();
    const operations = h.createWeb4OperationRepository({ databaseName: name }), drafts = h.createIndexedDbDraftRepository({ databaseName: name });
    await operations.begin(input);
    const settled = await operations.settle({ operationKey: input.operation, expectedOperationSequence: 1, expectedDraftSequence: 1, settledDraft: input.settledDraft, proof: input.proof });
    await h.rawPut(name, "operations", h.operationKey(input.operation), { ...settled.operation, frozen: { ...settled.operation.frozen, requestFingerprint: "0".repeat(64) } });
    const corrupt = await h.code(() => drafts.delete(input.draft, 2));
    const afterCorrupt = await drafts.read(input.draft);
    await h.rawPut(name, "operations", h.operationKey(input.operation), settled.operation);
    let signalHash!: () => void, releaseHash!: () => void;
    const hashing = new Promise<void>(resolve => { signalHash = resolve; }), gate = new Promise<void>(resolve => { releaseHash = resolve; });
    const original = SubtleCrypto.prototype.digest;
    SubtleCrypto.prototype.digest = function (algorithm, data) { return original.call(this, algorithm, data).then(async digest => { signalHash(); await gate; return digest; }); };
    let changed: string;
    try {
      const deletion = h.code(() => drafts.delete(input.draft, 2));
      await hashing;
      await h.rawPut(name, "operations", h.operationKey(input.operation), { ...settled.operation, createdAt: "2026-11-02T00:00:02.000Z" });
      releaseHash(); changed = await deletion;
    } finally { releaseHash(); SubtleCrypto.prototype.digest = original; }
    const after = { draft: await drafts.read(input.draft), operation: await operations.read(input.operation) };
    operations.close(); drafts.close(); return { corrupt, afterCorrupt, changed, after };
  });
  expect(result.corrupt).toBe("invalid-record"); expect(result.afterCorrupt.kind).toBe("available");
  expect(result.changed).toBe("conflict");
  expect(result.after).toMatchObject({ draft: { record: { localPersistSequence: 2 } }, operation: { operation: { state: "SETTLED" } } });
});

test("logout cleanup reports a terminal deletion abort and atomically retries without purging dirty or unknown", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web4OperationTest, name = crypto.randomUUID(), input = await h.prepared(), pending = await h.prepared("receipt-create", "pending"), dirty = await h.prepared("sales-create", "dirty");
    const operations = h.createWeb4OperationRepository({ databaseName: name }), drafts = h.createIndexedDbDraftRepository({ databaseName: name });
    await operations.begin(input); await operations.begin(pending); await drafts.write(dirty.draft, null);
    await operations.settle({ operationKey: input.operation, expectedOperationSequence: 1, expectedDraftSequence: 1, settledDraft: input.settledDraft, proof: input.proof });
    const factory = () => h.createIndexedDbDraftRepository({ databaseName: name });
    const namespace = { deploymentEpoch: input.draft.deploymentEpoch, actorKey: input.draft.actorKey };
    const original = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (key) {
      const request = original.call(this, key);
      if (this.name === "operations") request.addEventListener("success", () => request.transaction!.abort());
      return request;
    };
    let failed: boolean;
    try { failed = await h.cleanupCleanDrafts(namespace, factory); } finally { IDBObjectStore.prototype.delete = original; }
    const before = { draft: await drafts.read(input.draft), operation: await operations.read(input.operation) };
    const retried = await h.cleanupCleanDrafts(namespace, factory);
    const after = { draft: await drafts.read(input.draft), operation: await operations.read(input.operation), pending: await operations.read(pending.operation), dirty: await drafts.read(dirty.draft) };
    operations.close(); drafts.close(); return { failed, before, retried, after };
  });
  expect(result.failed).toBe(false);
  expect(result.before).toMatchObject({ draft: { kind: "available" }, operation: { operation: { state: "SETTLED" } } });
  expect(result.retried).toBe(true);
  expect(result.after).toMatchObject({ draft: { kind: "missing" }, operation: { kind: "missing" }, pending: { operation: { state: "DISPATCHED" } }, dirty: { record: { snapshot: { dirty: true } } } });
});
