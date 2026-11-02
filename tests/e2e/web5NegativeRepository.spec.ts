import { expect, test } from "@playwright/test";
import type * as Harness from "./helpers/web4OperationRepositoryHarness";
test.beforeEach(async ({ page }) => {
  await page.goto("/lab/components");
  await page.evaluate(async () => { const path = "/tests/e2e/helpers/web4OperationRepositoryHarness.ts"; window.web4OperationTest = await import(/* @vite-ignore */ path); });
});
for (const stem of ["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"]) {
  test(`negative ${stem} preserves raw checkpoint and requires fresh admission for local edits`, async ({ page }) => {
    const result = await page.evaluate(async stem => {
      const h: typeof Harness = window.web4OperationTest, name = crypto.randomUUID(), input = await h.prepared(stem);
      input.draft.snapshot.rawBuffers.note = { raw: "giữ nguyên bản nhập", composing: true };
      const negativeAdmission = h.createNegativeLineageAdmission();
      const operations = h.createWeb4OperationRepository({ databaseName: name, negativeAdmission }), drafts = h.createIndexedDbDraftRepository({ databaseName: name, negativeAdmission });
      const begun = await operations.begin(input);
      const resolvedDraft = { ...begun.draft, localPersistSequence: 2, unresolvedOperation: false, operationId: null };
      const resolved = await operations.resolveNegative!({ operationKey: input.operation, expectedOperationSequence: 1, expectedDraftSequence: 1,
        resolvedDraft, certificate: h.negativeCertificate(input.operation), isCurrent: () => true });
      const next = { ...resolved.draft, localPersistSequence: 3 };
      const protectedWrite = await h.code(() => drafts.write(next, 2));
      const protectedDelete = await h.code(() => drafts.delete(resolved.draft, 2));
      const decoded = await operations.read(input.operation); if (decoded.kind !== "available") throw Error("Missing terminal record");
      let current = true; negativeAdmission.admit(decoded.operation, () => current);
      const admittedWrite = await h.code(() => drafts.write(next, 2));
      current = false;
      const revokedDelete = await h.code(() => drafts.delete(resolved.draft, 3));
      const stored = await drafts.read(resolved.draft);
      operations.close(); drafts.close();
      return { protectedWrite, protectedDelete, admittedWrite, revokedDelete, stored, frozen: resolved.operation.frozen, original: input.operation };
    }, stem);
    expect(result).toMatchObject({ protectedWrite: "protected", protectedDelete: "protected", admittedWrite: "success", revokedDelete: "protected" });
    expect(result.stored).toMatchObject({ kind: "available", record: { snapshot: { rawBuffers: { note: { raw: "giữ nguyên bản nhập", composing: true } } } } });
    expect(result.frozen).toEqual(result.original);
  });
}
test("negative storage abort keeps both records pending and a fresh repository cannot delete forged terminal lineage", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web4OperationTest, name = crypto.randomUUID(), input = await h.prepared();
    const operations = h.createWeb4OperationRepository({ databaseName: name }), drafts = h.createIndexedDbDraftRepository({ databaseName: name });
    const begun = await operations.begin(input), resolvedDraft = { ...begun.draft, localPersistSequence: 2, unresolvedOperation: false, operationId: null };
    const args = { operationKey: input.operation, expectedOperationSequence: 1, expectedDraftSequence: 1, resolvedDraft, certificate: h.negativeCertificate(input.operation), isCurrent: () => true };
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...values) { const request = original.apply(this, values); if (this.name === "operations") request.addEventListener("success", () => request.transaction!.abort()); return request; };
    let failure: string;
    try { failure = await h.code(() => operations.resolveNegative!(args)); } finally { IDBObjectStore.prototype.put = original; }
    const afterAbort = { operation: await operations.read(input.operation), draft: await drafts.read(input.draft) };
    const forged = { ...begun.operation, schemaVersion: 2, state: "NOT_EXECUTED", localPersistSequence: 2,
      negative: { draftSequence: 2, resolvedAt: resolvedDraft.savedAt, certificate: args.certificate } };
    await h.rawPut(name, "operations", h.operationKey(input.operation), forged); await h.rawPut(name, "drafts", h.draftKey(input.draft), resolvedDraft);
    const deletion = await h.code(() => drafts.delete(input.draft, 2));
    const begin = await h.code(() => operations.begin({ ...input, operation: { ...input.operation, operationId: crypto.randomUUID() }, draft: { ...resolvedDraft, localPersistSequence: 3 }, expectedDraftSequence: 2 }));
    const cleanup = await h.cleanupCleanDrafts({ deploymentEpoch: input.draft.deploymentEpoch, actorKey: input.draft.actorKey }, () => h.createIndexedDbDraftRepository({ databaseName: name }));
    const retained = await drafts.read(input.draft); operations.close(); drafts.close();
    return { failure, afterAbort, deletion, begin, cleanup, retained };
  });
  expect(result.failure).toBe("transaction-aborted");
  expect(result.afterAbort).toMatchObject({ operation: { operation: { state: "DISPATCHED" } }, draft: { record: { unresolvedOperation: true, localPersistSequence: 1 } } });
  expect(result.deletion).toBe("protected"); expect(result.begin).toBe("protected"); expect(result.retained.kind).toBe("available");
});
for (const action of ["write", "begin", "delete"] as const) {
  test(`negative admission revoked after cursor scan prevents ${action}`, async ({ page }) => {
    const result = await page.evaluate(async action => {
      const h = window.web4OperationTest, name = crypto.randomUUID(), input = await h.prepared(), negativeAdmission = h.createNegativeLineageAdmission();
      const operations = h.createWeb4OperationRepository({ databaseName: name, negativeAdmission }), drafts = h.createIndexedDbDraftRepository({ databaseName: name, negativeAdmission });
      const begun = await operations.begin(input), resolvedDraft = { ...begun.draft, localPersistSequence: 2, unresolvedOperation: false, operationId: null };
      const terminal = await operations.resolveNegative!({ operationKey: input.operation, expectedOperationSequence: 1, expectedDraftSequence: 1, resolvedDraft, certificate: h.negativeCertificate(input.operation), isCurrent: () => true });
      let current = true; negativeAdmission.admit(terminal.operation, () => current);
      const original = IDBObjectStore.prototype.openCursor;
      IDBObjectStore.prototype.openCursor = function (...args) { if (this.name === "drafts") current = false; return original.apply(this, args); };
      let code: string;
      try {
        code = await h.code(() => action === "write" ? drafts.write({ ...resolvedDraft, localPersistSequence: 3 }, 2)
          : action === "delete" ? drafts.delete(resolvedDraft, 2)
            : operations.begin({ ...input, operation: { ...input.operation, operationId: crypto.randomUUID() }, draft: { ...resolvedDraft, localPersistSequence: 3 }, expectedDraftSequence: 2 }));
      } finally { IDBObjectStore.prototype.openCursor = original; }
      const stored = await drafts.read(resolvedDraft); operations.close(); drafts.close(); return { code, stored };
    }, action);
    expect(result.code).toBe("protected"); expect(result.stored).toMatchObject({ kind: "available", record: { localPersistSequence: 2, unresolvedOperation: false } });
  });
}
test("two tabs cannot both resolve the same negative checkpoint and altered source remains protected", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.web4OperationTest, name = crypto.randomUUID(), input = await h.prepared();
    const first = h.createWeb4OperationRepository({ databaseName: name }), second = h.createWeb4OperationRepository({ databaseName: name }), drafts = h.createIndexedDbDraftRepository({ databaseName: name });
    const begun = await first.begin(input), resolvedDraft = { ...begun.draft, localPersistSequence: 2, unresolvedOperation: false, operationId: null };
    const args = { operationKey: input.operation, expectedOperationSequence: 1, expectedDraftSequence: 1, resolvedDraft, certificate: h.negativeCertificate(input.operation), isCurrent: () => true };
    const changedDraft = structuredClone(resolvedDraft); changedDraft.snapshot.rawBuffers.note = { raw: "other tab", composing: false };
    const changed = await h.code(() => first.resolveNegative!({ ...args, resolvedDraft: changedDraft }));
    const unauthorized = await h.code(() => first.resolveNegative!({ ...args, isCurrent: () => false }));
    const wrong = await h.code(() => first.resolveNegative!({ ...args, certificate: { ...args.certificate, actorUserId: 43 } }));
    const races = await Promise.all([h.code(() => first.resolveNegative!(args)), h.code(() => second.resolveNegative!(args))]);
    const stored = await drafts.read(resolvedDraft), operation = await first.read(input.operation);
    first.close(); second.close(); drafts.close(); return { changed, unauthorized, wrong, races, stored, operation };
  });
  expect(result).toMatchObject({ changed: "invalid-record", unauthorized: "protected", wrong: "invalid-record" });
  expect(result.races.sort()).toEqual(["conflict", "success"]);
  expect(result.stored).toMatchObject({ kind: "available", record: { localPersistSequence: 2, snapshot: { rawBuffers: {} } } });
  expect(result.operation).toMatchObject({ kind: "available", operation: { state: "NOT_EXECUTED" } });
});
