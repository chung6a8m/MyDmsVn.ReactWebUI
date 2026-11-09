import { expect, test } from "@playwright/test";
import type * as Harness from "./helpers/web6ManualResendRepositoryHarness";

declare global { interface Window { web6ClaimTest: typeof Harness } }

test.beforeEach(async ({ page }) => {
  await page.goto("/lab/components");
  await page.evaluate(async () => {
    const path = "/tests/e2e/helpers/web6ManualResendRepositoryHarness.ts";
    window.web6ClaimTest = await import(/* @vite-ignore */ path);
  });
});

test("two tabs racing one original operation produce one durable claim", async ({ page, context }) => {
  const databaseName = `web6-claim-race-${test.info().testId}`;
  const seed = await page.evaluate(name => window.web6ClaimTest.seeded(name), databaseName);
  const other = await context.newPage();
  await other.goto("/lab/components");
  const claim = (target: typeof page, consentId: string) => target.evaluate(async ({ databaseName, seed, consentId }) => {
    const path = "/tests/e2e/helpers/web6ManualResendRepositoryHarness.ts";
    const h: typeof Harness = await import(/* @vite-ignore */ path);
    const repository = h.createWeb6ManualResendRepository({ databaseName });
    const result = await h.code(() => repository.claimManualResend(h.claimInput(seed, { consentId })));
    const durable = await repository.readManualResendClaim(seed.checkpoint.operation);
    repository.close();
    return { result, durable };
  }, { databaseName, seed, consentId });

  const results = await Promise.all([
    claim(page, "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff"),
    claim(other, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"),
  ]);
  expect(results.map(value => value.result).sort()).toEqual(["conflict", "success"]);
  expect(results[0].durable).toEqual(results[1].durable);
  expect(results[0].durable).toMatchObject({ kind: "available", claim: { state: "CLAIMED", generation: 3 } });
  await other.close();
});

test("claim rejects stale draft, stale operation and a duplicate without changing the first claim", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web6ClaimTest, databaseName = crypto.randomUUID(), seed = await h.seeded(databaseName);
    const repository = h.createWeb6ManualResendRepository({ databaseName });
    const staleDraft = await h.code(() => repository.claimManualResend(h.claimInput(seed, {
      expectedDraft: { ...seed.checkpoint.draft, editRevision: seed.checkpoint.draft.editRevision + 1 },
    })));
    const staleOperation = await h.code(() => repository.claimManualResend(h.claimInput(seed, {
      expectedOperation: { ...seed.checkpoint.operation, localPersistSequence: 2 },
    })));
    const first = await repository.claimManualResend(h.claimInput(seed));
    const duplicate = await h.code(() => repository.claimManualResend(h.claimInput(seed, {
      consentId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    })));
    const current = await repository.readManualResendClaim(seed.checkpoint.operation);
    repository.close(); return { staleDraft, staleOperation, first, duplicate, current };
  });
  expect(result).toMatchObject({ staleDraft: "conflict", staleOperation: "invalid-record", duplicate: "conflict" });
  expect(result.first).toMatchObject({ state: "CLAIMED", consentId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff" });
  expect(result.current).toMatchObject({ kind: "available", claim: { consentId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff" } });
});

test("claim remains consumed across reload and can only advance to response observed", async ({ page }) => {
  const databaseName = `web6-claim-reload-${test.info().testId}`;
  const seed = await page.evaluate(async name => {
    const h = window.web6ClaimTest, seed = await h.seeded(name);
    const repository = h.createWeb6ManualResendRepository({ databaseName: name });
    await repository.claimManualResend(h.claimInput(seed)); repository.close(); return seed;
  }, databaseName);
  await page.reload();
  const result = await page.evaluate(async ({ databaseName, seed }) => {
    const path = "/tests/e2e/helpers/web6ManualResendRepositoryHarness.ts";
    const h: typeof Harness = await import(/* @vite-ignore */ path);
    const repository = h.createWeb6ManualResendRepository({ databaseName });
    const duplicate = await h.code(() => repository.claimManualResend(h.claimInput(seed)));
    const observed = await repository.observeManualResendResponse({ operationKey: seed.checkpoint.operation,
      expectedConsentId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff", observedAt: "2026-11-10T00:00:01.000Z" });
    const current = await repository.readManualResendClaim(seed.checkpoint.operation);
    repository.close(); return { duplicate, observed, current };
  }, { databaseName, seed });
  expect(result.duplicate).toBe("conflict");
  expect(result.observed).toMatchObject({ state: "RESPONSE_OBSERVED" });
  expect(result.current).toMatchObject({ kind: "available", claim: { state: "RESPONSE_OBSERVED" } });
});

test("version-1 upgrade preserves existing stores and adds receipt and claim stores", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web6ClaimTest, databaseName = crypto.randomUUID(), legacy = await h.openVersion1(databaseName);
    await new Promise<void>((resolve, reject) => {
      const tx = legacy.transaction("drafts", "readwrite"); tx.objectStore("drafts").put({ preserved: true }, "legacy");
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
    });
    legacy.close();
    const repository = h.createWeb6ManualResendRepository({ databaseName });
    await repository.readManualResendClaim({ deploymentEpoch: "00112233-4455-6677-8899-aabbccddeeff", actorKey: "7", operationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
    repository.close();
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(databaseName); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const stores = [...db.objectStoreNames];
    const preserved = await new Promise<unknown>((resolve, reject) => { const request = db.transaction("drafts").objectStore("drafts").get("legacy"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close(); return { stores, preserved };
  });
  expect(result.stores).toEqual(["drafts", "manualResendClaims", "manualResendReceipts", "operations"]);
  expect(result.preserved).toEqual({ preserved: true });
});

test("claim transaction abort fails closed", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web6ClaimTest, databaseName = crypto.randomUUID(), seed = await h.seeded(databaseName);
    const repository = h.createWeb6ManualResendRepository({ databaseName });
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      const request = original.apply(this, args);
      if (this.name === "manualResendClaims") request.addEventListener("success", () => request.transaction!.abort());
      return request;
    };
    let aborted: string;
    try { aborted = await h.code(() => repository.claimManualResend(h.claimInput(seed))); }
    finally { IDBObjectStore.prototype.add = original; }
    const afterAbort = await repository.readManualResendClaim(seed.checkpoint.operation);
    repository.close(); return { aborted, afterAbort };
  });
  expect(result).toEqual({ aborted: "transaction-aborted", afterAbort: { kind: "missing" } });
});

test("corrupt receipt and quota failure create no claim", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web6ClaimTest;
    const corruptName = crypto.randomUUID(), corrupt = await h.seeded(corruptName);
    await h.rawPut(corruptName, "manualResendReceipts", [corrupt.checkpoint.operation.deploymentEpoch, corrupt.checkpoint.operation.actorKey, corrupt.checkpoint.operation.operationId],
      { ...corrupt.receipt, receipt: "contains whitespace" });
    const corruptRepository = h.createWeb6ManualResendRepository({ databaseName: corruptName });
    const corruptCode = await h.code(() => corruptRepository.claimManualResend(h.claimInput(corrupt)));
    const corruptClaim = await corruptRepository.readManualResendClaim(corrupt.checkpoint.operation); corruptRepository.close();

    const quotaName = crypto.randomUUID(), quota = await h.seeded(quotaName);
    const quotaRepository = h.createWeb6ManualResendRepository({ databaseName: quotaName });
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === "manualResendClaims") throw new DOMException("quota", "QuotaExceededError");
      return original.apply(this, args);
    };
    let quotaCode: string;
    try { quotaCode = await h.code(() => quotaRepository.claimManualResend(h.claimInput(quota))); }
    finally { IDBObjectStore.prototype.add = original; }
    const quotaClaim = await quotaRepository.readManualResendClaim(quota.checkpoint.operation); quotaRepository.close();
    return { corruptCode, corruptClaim, quotaCode, quotaClaim };
  });
  expect(result).toEqual({ corruptCode: "invalid-record", corruptClaim: { kind: "missing" }, quotaCode: "quota", quotaClaim: { kind: "missing" } });
});

test("blocked upgrade and versionchange stay fail closed", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web6ClaimTest, blockedName = crypto.randomUUID(), blocker = await h.openVersion1(blockedName);
    const blockedRepository = h.createWeb6ManualResendRepository({ databaseName: blockedName });
    const key = { deploymentEpoch: "00112233-4455-6677-8899-aabbccddeeff", actorKey: "7", operationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" };
    const blocked = await h.code(() => blockedRepository.readManualResendClaim(key));
    blocker.close(); blockedRepository.close();

    const changedName = crypto.randomUUID(), changedRepository = h.createWeb6ManualResendRepository({ databaseName: changedName });
    await changedRepository.readManualResendClaim(key);
    const newer = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(changedName, 3); request.onupgradeneeded = () => {}; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    newer.close();
    const versionchange = await h.code(() => changedRepository.readManualResendClaim(key));
    changedRepository.close(); return { blocked, versionchange };
  });
  expect(result).toEqual({ blocked: "blocked", versionchange: "versionchange" });
});

test("a retained negative lineage blocks a claim for the same local document", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web6ClaimTest, databaseName = crypto.randomUUID(), seed = await h.seeded(databaseName);
    const old = await h.prepared("sales-create", seed.checkpoint.draft.localDocumentId);
    const negative = { schemaVersion: 2, deploymentEpoch: old.operation.deploymentEpoch, actorKey: old.operation.actorKey,
      operationId: old.operation.operationId, feature: "sales", localDocumentId: seed.checkpoint.draft.localDocumentId,
      localPersistSequence: 2, draftCheckpointSequence: 1, draftCheckpointEditRevision: 6,
      createdAt: "2026-11-01T00:00:00.000Z", frozen: old.operation, state: "NOT_EXECUTED", settlement: null,
      negative: { draftSequence: 2, resolvedAt: "2026-11-01T01:00:00.000Z", certificate: h.negativeCertificate(old.operation) } };
    await h.rawPut(databaseName, "operations", [old.operation.deploymentEpoch, old.operation.actorKey, old.operation.operationId], negative);
    const repository = h.createWeb6ManualResendRepository({ databaseName });
    const claim = await h.code(() => repository.claimManualResend(h.claimInput(seed)));
    const durable = await repository.readManualResendClaim(seed.checkpoint.operation);
    repository.close(); return { claim, durable };
  });
  expect(result).toEqual({ claim: "protected", durable: { kind: "missing" } });
});
