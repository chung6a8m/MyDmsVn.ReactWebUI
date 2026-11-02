import { expect, test } from "@playwright/test";
import type * as Harness from "./helpers/draftRepositoryHarness";
declare global { interface Window { draftRepositoryTest: typeof Harness } }
test.beforeEach(async ({ page }) => {
  await page.goto("/lab/components");
  await page.evaluate(async () => {
    const path = "/tests/e2e/helpers/draftRepositoryHarness.ts";
    window.draftRepositoryTest = await import(/* @vite-ignore */ path);
  });
});

test("completed draft survives reload with exact uncommitted text and operation store stays empty", async ({ page }) => {
  const dbName = `draft-reload-${test.info().testId}`;
  await page.evaluate(async name => {
    const h = window.draftRepositoryTest;
    const repository = h.createIndexedDbDraftRepository({ databaseName: name });
    const value = h.record();
    value.snapshot.draft.note = "Gõ chưa xong ệ  ";
    await repository.write(value, null);
    repository.close();
  }, dbName);
  await page.reload();
  const result = await page.evaluate(async name => {
    const path = "/tests/e2e/helpers/draftRepositoryHarness.ts";
    const h: typeof Harness = await import(/* @vite-ignore */ path);
    const repository = h.createIndexedDbDraftRepository({ databaseName: name });
    const restored = await repository.read(h.record());
    const db = await h.openRaw(name);
    const operationCount = await new Promise<number>(resolve => {
      const request = db.transaction("operations").objectStore("operations").count();
      request.onsuccess = () => resolve(request.result);
    });
    db.close(); repository.close();
    return { restored, operationCount };
  }, dbName);
  expect(result.restored).toMatchObject({ kind: "available", record: { localPersistSequence: 1, snapshot: { draft: { note: "Gõ chưa xong ệ  " } } } });
  expect(result.operationCount).toBe(0);
});

test("cross-tab CAS permits one winner and refuses stale overwrite and stale deletion", async ({ page, context }) => {
  const dbName = `draft-race-${test.info().testId}`;
  const other = await context.newPage();
  await other.goto("/lab/components");
  await page.evaluate(async name => {
    const h = window.draftRepositoryTest;
    const repository = h.createIndexedDbDraftRepository({ databaseName: name });
    await repository.write(h.record(), null); repository.close();
  }, dbName);
  const write = async (target: typeof page, note: string) => target.evaluate(async ({ name, note }) => {
    const path = "/tests/e2e/helpers/draftRepositoryHarness.ts";
    const h: typeof Harness = await import(/* @vite-ignore */ path);
    const repository = h.createIndexedDbDraftRepository({ databaseName: name });
    const value = { ...h.record(), localPersistSequence: 2, editRevision: 3 };
    value.snapshot.draft.note = note;
    const code = await h.errorCode(() => repository.write(value, 1));
    repository.close(); return code;
  }, { name: dbName, note });
  expect((await Promise.all([write(page, "tab A"), write(other, "tab B")])).sort()).toEqual(["conflict", "unexpected-success"]);
  const result = await page.evaluate(async name => {
    const h = window.draftRepositoryTest;
    const repository = h.createIndexedDbDraftRepository({ databaseName: name });
    const staleDelete = await h.errorCode(() => repository.delete(h.record(), 1));
    const found = await repository.read(h.record());
    await repository.delete(h.record(), 2);
    const missing = await repository.read(h.record());
    repository.close(); return { staleDelete, found, missing };
  }, dbName);
  expect(result.staleDelete).toBe("conflict");
  expect(result.found).toMatchObject({ kind: "available", record: { localPersistSequence: 2 } });
  expect(result.missing).toEqual({ kind: "missing" });
  await other.close();
});

test("quarantines only malformed own records and never returns other actor or epoch content", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.draftRepositoryTest;
    const name = crypto.randomUUID();
    const repository = h.createIndexedDbDraftRepository({ databaseName: name });
    await repository.write(h.record(), null);
    const future = { ...h.record("future"), schemaVersion: 2, privatePayload: "DO_NOT_PREVIEW" };
    await h.seed(name, future, h.key(h.record("future")));
    await h.seed(name, { ...h.record("mismatch"), actorKey: "8", privatePayload: "DO_NOT_PREVIEW" }, h.key(h.record("mismatch")));
    const foreignActor = { ...h.record("foreign-actor"), actorKey: "8" };
    foreignActor.snapshot.draft.note = "FOREIGN_ACTOR";
    await h.seed(name, foreignActor, h.key(foreignActor));
    const foreignEpoch = { ...h.record("foreign-epoch"), deploymentEpoch: "11112233-4455-6677-8899-aabbccddeeff" };
    foreignEpoch.snapshot.draft.note = "FOREIGN_EPOCH";
    await h.seed(name, foreignEpoch, h.key(foreignEpoch));
    const listing = await repository.list(h.record());
    const deletion = await h.errorCode(() => repository.delete(h.record("future"), 1));
    const overwrite = await h.errorCode(() => repository.write({ ...h.record("future"), localPersistSequence: 2 }, 1));
    repository.close(); return { listing, deletion, overwrite };
  });
  expect(result.listing.records).toHaveLength(1);
  expect(result.listing.quarantined).toHaveLength(2);
  expect(JSON.stringify(result)).not.toMatch(/DO_NOT_PREVIEW|FOREIGN_ACTOR|FOREIGN_EPOCH/);
  expect(result.deletion).toBe("invalid-record");
  expect(result.overwrite).toBe("invalid-record");
});

test("a protected marker without payload cannot be erased or cleared by ordinary writes", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.draftRepositoryTest;
    const repository = h.createIndexedDbDraftRepository({ databaseName: crypto.randomUUID() });
    const value = { ...h.record(), unresolvedOperation: true };
    await repository.write(value, null);
    const deletion = await h.errorCode(() => repository.delete(value, 1));
    const overwrite = await h.errorCode(() => repository.write({ ...value, localPersistSequence: 2, unresolvedOperation: false }, 1));
    const changeOperation = await h.errorCode(() => repository.write({ ...value, localPersistSequence: 2, operationId: "11111111-1111-4111-8111-111111111111" }, 1));
    const current = await repository.read(value); repository.close();
    return { deletion, overwrite, changeOperation, current };
  });
  expect(result).toMatchObject({ deletion: "protected", overwrite: "protected", changeOperation: "protected", current: { kind: "available", record: { unresolvedOperation: true, operationId: null, localPersistSequence: 1 } } });
});

test("two local identities for one server document remain separate and are flagged for review", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.draftRepositoryTest;
    const repository = h.createIndexedDbDraftRepository({ databaseName: crypto.randomUUID() });
    const first = h.existingRecord("local-first");
    const second = h.existingRecord("local-second");
    first.snapshot.draft.note = "first user draft";
    second.snapshot.draft.note = "second user draft";
    await repository.write(first, null); await repository.write(second, null);
    const listing = await repository.list(first); repository.close(); return listing;
  });
  expect(result.records.map(record => record.snapshot.draft.note).sort()).toEqual(["first user draft", "second user draft"]);
  expect(result.conflicts).toEqual([{ feature: "sales", serverId: "9223372036854775807", localDocumentIds: ["local-first", "local-second"] }]);
});

test("malformed primary keys and undefined values cannot evade quarantine or become new writable drafts", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.draftRepositoryTest;
    const name = crypto.randomUUID();
    const repository = h.createIndexedDbDraftRepository({ databaseName: name });
    const value = h.record();
    await repository.read(value);
    await h.seed(name, undefined, h.key(value));
    await h.seed(name, { private: "DO_NOT_PREVIEW" }, [value.deploymentEpoch, value.actorKey, ["malformed"], "private"]);
    const read = await repository.read(value);
    const listing = await repository.list(value);
    const overwrite = await h.errorCode(() => repository.write(value, null));
    const deletion = await h.errorCode(() => repository.delete(value, 1));
    repository.close(); return { read, listing, overwrite, deletion };
  });
  expect(result.read).toMatchObject({ kind: "quarantined" });
  expect(result.listing.records).toHaveLength(0);
  expect(result.listing.quarantined).toHaveLength(2);
  expect(result.listing.quarantined.some(record => record.key === null)).toBe(true);
  expect(result.overwrite).toBe("invalid-record");
  expect(result.deletion).toBe("invalid-record");
  expect(JSON.stringify(result)).not.toContain("DO_NOT_PREVIEW");
});

test("request success followed by transaction abort is failure and never durable success", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.draftRepositoryTest;
    const repository = h.createIndexedDbDraftRepository({ databaseName: crypto.randomUUID() });
    const original = IDBObjectStore.prototype.put;
    let requestSucceeded = false;
    IDBObjectStore.prototype.put = function (...args) {
      const request = original.apply(this, args);
      request.addEventListener("success", () => { requestSucceeded = true; request.transaction!.abort(); });
      return request;
    };
    let failure: string;
    try { failure = await h.errorCode(() => repository.write(h.record(), null)); }
    finally { IDBObjectStore.prototype.put = original; }
    const found = await repository.read(h.record()); repository.close();
    return { failure, requestSucceeded, found };
  });
  expect(result).toEqual({ failure: "transaction-aborted", requestSucceeded: true, found: { kind: "missing" } });
});

test("quota failure preserves existing bytes and permits explicit local retry", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.draftRepositoryTest;
    const repository = h.createIndexedDbDraftRepository({ databaseName: crypto.randomUUID() });
    await repository.write(h.record(), null);
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () { throw new DOMException("simulated disk quota", "QuotaExceededError"); };
    const next = { ...h.record(), localPersistSequence: 2, editRevision: 3 };
    let failure: string;
    try { failure = await h.errorCode(() => repository.write(next, 1)); }
    finally { IDBObjectStore.prototype.put = original; }
    const beforeRetry = await repository.read(next);
    await repository.write(next, 1);
    const afterRetry = await repository.read(next); repository.close();
    return { failure, beforeRetry, afterRetry };
  });
  expect(result).toMatchObject({ failure: "quota", beforeRetry: { record: { localPersistSequence: 1 } }, afterRetry: { record: { localPersistSequence: 2 } } });
});

test("version change closes the old connection and requires a fresh repository", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.draftRepositoryTest;
    const name = crypto.randomUUID();
    const repository = h.createIndexedDbDraftRepository({ databaseName: name });
    await repository.write(h.record(), null);
    const newer = await h.openRaw(name, 2);
    newer.close();
    const code = await h.errorCode(() => repository.read(h.record()));
    repository.close(); return code;
  });
  expect(result).toBe("versionchange");
});

test("asynchronous request quota errors retain their actionable classification", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.draftRepositoryTest;
    const repository = h.createIndexedDbDraftRepository({ databaseName: crypto.randomUUID() });
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const request = original.apply(this, args);
      request.addEventListener("success", () => {
        Object.defineProperty(request, "error", { value: new DOMException("simulated asynchronous quota", "QuotaExceededError") });
        request.dispatchEvent(new Event("error", { bubbles: true }));
        request.transaction!.abort();
      });
      return request;
    };
    let code: string;
    try { code = await h.errorCode(() => repository.write(h.record(), null)); }
    finally { IDBObjectStore.prototype.put = original; }
    const missing = await repository.read(h.record()); repository.close(); return { code, missing };
  });
  expect(result).toEqual({ code: "quota", missing: { kind: "missing" } });
});

test("blocked open reports failure then closes any late connection", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.draftRepositoryTest;
    const name = crypto.randomUUID();
    const blocker = await h.openRaw(name, 1);
    const factory = { open: (dbName: string) => indexedDB.open(dbName, 2) };
    const repository = h.createIndexedDbDraftRepository({ databaseName: name, indexedDB: factory });
    const code = await h.errorCode(() => repository.read(h.record()));
    repository.close(); blocker.close();
    // A further upgrade completing proves the rejected opener did not leak a blocking connection.
    const finalDb = await h.openRaw(name, 3); finalDb.close();
    return code;
  });
  expect(result).toBe("blocked");
});

test("blocked native open recovers only after explicit retry when the blocking connection closes", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.draftRepositoryTest, name = crypto.randomUUID();
    const blocker = await h.openRaw(name, 1);
    let opened = 0, settleFirst!: () => void;
    const firstSettled = new Promise<void>(resolve => { settleFirst = resolve; });
    const factory = { open(dbName: string) {
      const request = indexedDB.open(dbName, 2);
      if (++opened === 1) {
        request.addEventListener("error", settleFirst);
        request.addEventListener("success", settleFirst);
      }
      return request;
    } };
    const repository = h.createIndexedDbDraftRepository({ databaseName: name, indexedDB: factory });
    const blocked = await h.errorCode(() => repository.list(h.record()));
    blocker.close(); await firstSettled;
    const stillFenced = await h.errorCode(() => repository.list(h.record()));
    const beforeRetryOpens = opened;
    repository.retryConnection!();
    await repository.write(h.record(), null);
    const listing = await repository.list(h.record());
    repository.close();
    return { blocked, stillFenced, beforeRetryOpens, opened, listing };
  });
  expect(result).toMatchObject({ blocked: "blocked", stillFenced: "blocked", beforeRetryOpens: 1, opened: 2 });
  expect(result.listing.records).toHaveLength(1);
  expect(result.listing.records[0].localPersistSequence).toBe(1);
});

test("denied storage reports unavailable without accepting a write", async ({ page }) => {
  const code = await page.evaluate(async () => {
    const h = window.draftRepositoryTest;
    const repository = h.createIndexedDbDraftRepository({ indexedDB: { open() { throw new DOMException("denied", "SecurityError"); } } });
    const code = await h.errorCode(() => repository.write(h.record(), null)); repository.close(); return code;
  });
  expect(code).toBe("unavailable");
});
