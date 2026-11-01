import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { createWeb4MutationRuntime } from "../../../src/app/runtime/web4MutationRuntime";
import { createSalesSessionStore, type SalesSession } from "../../../src/features/sales/salesSessionStore";
import { createGoodsReceiptSessionStore, type GoodsReceiptSession } from "../../../src/features/goodsReceipt/goodsReceiptSessionStore";
import { createSalesPortCommands } from "../../../src/features/sales/salesCommands";
import { createGoodsReceiptCommands } from "../../../src/features/goodsReceipt/goodsReceiptCommands";
import { createLocalDraftPersistence, localDraftStateKey } from "../../../src/infrastructure/drafts/localDraftPersistence";
import { captureFeatureDraft } from "../../../src/infrastructure/drafts/featureDraftSnapshot";
import { DraftRepositoryError, type DraftRecord } from "../../../src/infrastructure/drafts/draftRecord";
import type { DraftRepository } from "../../../src/infrastructure/drafts/indexedDbDraftRepository";
import type { DurableOperationRecord, Web4OperationRepository } from "../../../src/infrastructure/drafts/web4OperationRepository";
import type { AuthSession, AuthSnapshot } from "../../../src/infrastructure/http/authSession";
import { HttpError } from "../../../src/infrastructure/http/authApi";
import type { HttpTransport } from "../../../src/infrastructure/http/readBoundary";
import { mapSalesDetail } from "../../../src/infrastructure/http/salesWireMapper";
import { mapGoodsReceiptDetail } from "../../../src/infrastructure/http/goodsReceiptWireMapper";
import { salesDetailSchema } from "../../../src/infrastructure/http/salesWireSchemas";
import { receiptDetailSchema } from "../../../src/infrastructure/http/goodsReceiptWireSchemas";
import type { SalesPort } from "../../../src/ports/salesPort";
import type { GoodsReceiptPort } from "../../../src/ports/goodsReceiptPort";
import type { Web4WireIntent } from "../../../src/infrastructure/http/web4OperationCodec";
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/web4-v1/corpus/${name}.json`, import.meta.url), "utf8"));
const epoch = fixture("context-response").data.deploymentEpoch as string;
const namespace = { deploymentEpoch: epoch, actorKey: "42" };
const grants = { read: false, write: true, post: true };
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function setup(stem = "sales-create") {
  const intent = fixture(`${stem}-intent`) as Web4WireIntent;
  const feature = stem.startsWith("sales") ? "sales" as const : "goods-receipt" as const;
  const kind = stem.endsWith("post") ? "post" as const : "save" as const;
  const scope = { ...namespace, actorGeneration: 1 };
  let authSnapshot = { ...scope, status: "authenticated", capabilities: grants, features: { sales: grants, "goods-receipt": grants } } as AuthSnapshot;
  const auth = { getSnapshot: () => authSnapshot } as AuthSession;
  const salesStore = createSalesSessionStore(), receiptStore = createGoodsReceiptSessionStore();
  const common = { ...scope, sessionId: "local-1", generation: 3, requestGeneration: 1, editRevision: 7, dirty: false,
    status: "ready" as const, mutation: "pending" as const, mutationKind: kind, rawBuffers: {}, lookupBuffers: {}, capabilities: grants, commandCount: 0, view: {} };
  if (feature === "sales") {
    const baseline = mapSalesDetail(salesDetailSchema.parse(fixture(kind === "post" ? "sales-update-response" : `${stem}-response`).data));
    baseline.saved.lines.forEach((line, i) => { line.clientLineId = `local-${i}`; }); baseline.lines.forEach((line, i) => { line.clientLineId = `local-${i}`; });
    const draft = structuredClone(baseline.saved);
    draft.saleId = intent.requestTargetId; draft.expectedVersion = "expectedVersion" in intent.body ? intent.body.expectedVersion : null;
    if (intent.operationKind === "Sales.Create" || intent.operationKind === "Sales.Update") draft.lines.forEach((line, i) => { const sent = intent.body as { lines: { saleLineId: string }[] }; line.saleLineId = sent.lines[i].saleLineId === "0" ? null : sent.lines[i].saleLineId; });
    if (draft.expectedVersion) { baseline.version = draft.expectedVersion; baseline.saved = structuredClone(draft); }
    const session: SalesSession = { ...common, saleId: draft.saleId, draft, baseline: draft.saleId ? baseline : null, initialDraft: draft.saleId ? undefined : structuredClone(draft), mutationSnapshot: draft };
    salesStore.setState({ sessions: { "local-1": session } });
  } else {
    const baseline = mapGoodsReceiptDetail(receiptDetailSchema.parse(fixture(kind === "post" ? "receipt-update-response" : `${stem}-response`).data));
    baseline.saved.lines.forEach((line, i) => { line.clientLineId = `local-${i}`; }); baseline.lines.forEach((line, i) => { line.clientLineId = `local-${i}`; });
    const draft = structuredClone(baseline.saved); draft.receiptId = intent.requestTargetId; draft.expectedVersion = "expectedVersion" in intent.body ? intent.body.expectedVersion : null;
    if (draft.receiptId === null) draft.lines.forEach(line => { line.receiptLineId = null; });
    if (draft.expectedVersion) { baseline.version = draft.expectedVersion; baseline.saved = structuredClone(draft); }
    const session: GoodsReceiptSession = { ...common, receiptId: draft.receiptId, draft, baseline: draft.receiptId ? baseline : null, initialDraft: draft.receiptId ? undefined : structuredClone(draft), mutationSnapshot: draft };
    receiptStore.setState({ sessions: { "local-1": session } });
  }
  const live = () => feature === "sales" ? salesStore.getState().sessions["local-1"] : receiptStore.getState().sessions["local-1"];
  const patch = (change: Partial<typeof common> & { localRecovery?: { operationId: string | null }; writeReviewRequired?: boolean }) => {
    if (feature === "sales") salesStore.setState(s => ({ sessions: { "local-1": { ...s.sessions["local-1"], ...change } } }));
    else receiptStore.setState(s => ({ sessions: { "local-1": { ...s.sessions["local-1"], ...change } } }));
  };
  let diskDraft: DraftRecord | null = null, diskOperation: DurableOperationRecord | null = null;
  const events: string[] = [];
  const draftRepository: DraftRepository = { read: vi.fn(), list: vi.fn(), delete: vi.fn(), close: vi.fn(),
    write: vi.fn(async (record, expected) => { if (diskOperation?.state === "DISPATCHED") throw new DraftRepositoryError("protected"); if ((diskDraft?.localPersistSequence ?? null) !== expected) throw new DraftRepositoryError("conflict"); events.push("draft"); diskDraft = structuredClone(record); return structuredClone(record); }) };
  const persistence = createLocalDraftPersistence({ namespace, repository: draftRepository, isCurrent: () => authSnapshot.actorGeneration === 1 });
  const capture = () => { if (authSnapshot.actorGeneration !== 1) return; const session = live(); const snapshot = captureFeatureDraft(feature, session); if (snapshot) persistence.update({ feature, localDocumentId: session.sessionId, editRevision: session.editRevision, snapshot, unresolvedOperation: !!session.localRecovery || session.mutation === "outcome-unknown", operationId: session.localRecovery?.operationId ?? null }); };
  salesStore.subscribe(capture); receiptStore.subscribe(capture);
  const repository = {
    begin: vi.fn<Web4OperationRepository["begin"]>(async input => {
      events.push("begin"); if ((diskDraft?.localPersistSequence ?? null) !== input.expectedDraftSequence) throw new DraftRepositoryError("conflict");
      diskDraft = { ...structuredClone(input.draft), unresolvedOperation: true, operationId: input.operation.operationId };
      diskOperation = { ...namespace, schemaVersion: 1, feature, localDocumentId: "local-1", localPersistSequence: 1, draftCheckpointSequence: diskDraft.localPersistSequence,
        draftCheckpointEditRevision: diskDraft.editRevision, createdAt: diskDraft.savedAt, frozen: input.operation, operationId: input.operation.operationId, state: "DISPATCHED", settlement: null };
      return structuredClone({ draft: diskDraft, operation: diskOperation });
    }),
    read: vi.fn<Web4OperationRepository["read"]>(async () => diskOperation ? { kind: "available", operation: structuredClone(diskOperation) } : { kind: "missing" }),
    findForDraft: vi.fn<Web4OperationRepository["findForDraft"]>(async () => ({ operations: diskOperation ? [structuredClone(diskOperation)] : [], quarantined: false })),
    settle: vi.fn<Web4OperationRepository["settle"]>(async input => {
      events.push("settle"); if (!diskOperation || diskDraft?.localPersistSequence !== input.expectedDraftSequence) throw new DraftRepositoryError("conflict");
      diskDraft = structuredClone(input.settledDraft); const proof = input.proof;
      diskOperation = { ...diskOperation, state: "SETTLED", localPersistSequence: 2, settlement: { draftSequence: diskDraft.localPersistSequence, settledAt: diskDraft.savedAt,
        resultDocumentId: "saleId" in proof.value ? proof.value.saleId : proof.value.receiptId, status: proof.value.status, ...("version" in proof.value ? { version: proof.value.version } : {}) } };
      return structuredClone({ draft: diskDraft, operation: diskOperation });
    }),
    reject: vi.fn<Web4OperationRepository["reject"]>(async input => {
      events.push("reject"); if (!diskOperation || diskDraft?.localPersistSequence !== input.expectedDraftSequence) throw new DraftRepositoryError("conflict");
      diskDraft = structuredClone(input.rejectedDraft);
      diskOperation = { ...diskOperation, state: "REJECTED", localPersistSequence: 2, settlement: null,
        rejection: { httpStatus: input.proof.httpStatus, code: input.proof.code, draftSequence: diskDraft.localPersistSequence, rejectedAt: diskDraft.savedAt } };
      return structuredClone({ draft: diskDraft, operation: diskOperation });
    }), close: vi.fn(),
  };
  const transport = { request: vi.fn<HttpTransport["request"]>(async (path, _init, dispatch) => {
    if (path.startsWith("/api/v1/operations/")) {
      events.push("status"); const op = diskOperation!;
      const { operationKind, method, routeScope, requestTargetId } = op.frozen.request;
      return { deploymentEpoch: epoch, operationId: op.operationId, requestFingerprint: op.frozen.requestFingerprint, operationKind, method, routeScope, requestTargetId,
        state: "COMMITTED", outcome: fixture(`${stem}-response`) };
    }
    dispatch?.(); events.push("http"); return fixture(`${stem}-response`).data;
  }) };
  // Use the real feature acceptance paths; these ports can never perform reads.
  const noRead = vi.fn(async () => { throw Error("Public Get is forbidden in protected recovery"); });
  const salesCommands = createSalesPortCommands(salesStore, { get: noRead } as unknown as SalesPort);
  const receiptCommands = createGoodsReceiptCommands(receiptStore, { get: noRead } as unknown as GoodsReceiptPort);
  const applySales = vi.fn((...args: Parameters<typeof salesCommands.applyProtectedResult>) => { events.push("apply"); return salesCommands.applyProtectedResult(...args); });
  const applyReceipt = vi.fn((...args: Parameters<typeof receiptCommands.applyProtectedResult>) => { events.push("apply"); return receiptCommands.applyProtectedResult(...args); });
  const runtime = createWeb4MutationRuntime({ auth, workspace: { store: salesStore, applyProtectedResult: applySales }, receipt: { store: receiptStore, applyProtectedResult: applyReceipt }, drafts: { capture, persistence }, repository, transport });
  const context = { ...scope, signal: new AbortController().signal, document: { localDocumentId: "local-1", generation: 3, editRevision: 7 } };
  const invoke = () => {
    const session = live();
    if ("saleId" in session) return kind === "save" ? runtime.saveSales(session.mutationSnapshot!, context) : runtime.postSales({ saleId: session.saleId!, expectedVersion: session.baseline!.version }, context);
    return kind === "save" ? runtime.saveReceipt(session.mutationSnapshot!, context) : runtime.postReceipt({ receiptId: session.receiptId!, expectedVersion: session.baseline!.version }, context);
  };
  return { runtime, context, live, patch, invoke, events, transport, repository, draftRepository, persistence, capture, noRead, applySales, applyReceipt, feature,
    stored: () => ({ draft: diskDraft!, operation: diskOperation! }), setDraft: (draft: DraftRecord) => { diskDraft = draft; },
    shift: () => { authSnapshot = { ...authSnapshot, actorGeneration: 2 }; }, state: () => runtime.state.getState().documents[localDraftStateKey(feature, "local-1")] };
}
it.each(["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"])("durably settles %s before publishing without public Read", async stem => {
  const s = setup(stem); const ids = s.live().draft!.lines.map(line => line.clientLineId);
  expect((await s.invoke()).kind).toBe("success"); expect(s.events).toEqual(["draft", "begin", "http", "settle", "apply"]);
  expect(s.stored().operation.state).toBe("SETTLED"); expect(s.stored().draft.unresolvedOperation).toBe(false);
  expect(s.live().localRecovery).toBeUndefined(); expect(s.live().draft!.lines.map(line => line.clientLineId)).toEqual(ids); expect(s.noRead).not.toHaveBeenCalled();
  if (stem === "receipt-post") expect(s.live().postAcknowledgement).not.toHaveProperty("version");
  if (stem === "sales-post") expect(s.live().postAcknowledgement).toHaveProperty("version");
});
it("does not dispatch until the atomic begin completes", async () => {
  const s = setup(); const begin = s.repository.begin.getMockImplementation()!; const held = deferred<void>();
  s.repository.begin.mockImplementation(async input => { await held.promise; return begin(input); });
  const result = s.invoke(); await vi.waitFor(() => expect(s.repository.begin).toHaveBeenCalledOnce()); expect(s.transport.request).not.toHaveBeenCalled();
  held.resolve(); expect((await result).kind).toBe("success");
});
it("quota before begin preserves memory and sends no HTTP", async () => {
  const s = setup(); vi.mocked(s.draftRepository.write).mockRejectedValueOnce(new DraftRepositoryError("quota"));
  expect(await s.invoke()).toMatchObject({ kind: "failed", dispatched: false }); expect(s.transport.request).not.toHaveBeenCalled(); expect(s.repository.begin).not.toHaveBeenCalled(); expect(s.live().draft).not.toBeNull();
});
it("actor shift after begin locks the saved intent without sending HTTP", async () => {
  const s = setup(); const begin = s.repository.begin.getMockImplementation()!;
  s.repository.begin.mockImplementation(async input => { const value = await begin(input); s.shift(); return value; });
  expect(await s.invoke()).toEqual({ kind: "outcome-unknown" }); expect(s.transport.request).not.toHaveBeenCalled(); expect(s.stored().operation.state).toBe("DISPATCHED"); expect(s.live().localRecovery).toBeDefined();
});
it("lost acknowledgement and explicit 404 check remain unknown without resending", async () => {
  const s = setup(); s.transport.request.mockImplementation(async (_path, _init, dispatched) => { if (dispatched) { dispatched(); throw Error("lost"); } throw new HttpError(404, { error: { code: "Operation.NotObserved", message: "not observed", details: [], correlationId: "correlation-1" } }); });
  expect(await s.invoke()).toEqual({ kind: "outcome-unknown" }); expect(s.transport.request).toHaveBeenCalledOnce();
  await s.runtime.checkResult(s.feature, "local-1"); expect(s.transport.request).toHaveBeenCalledTimes(2); expect(s.repository.settle).not.toHaveBeenCalled(); expect(s.live().mutation).toBe("outcome-unknown"); expect(s.state()?.correlationId).toBe("correlation-1");
});
it("post-response local failure retries only local settlement on explicit check", async () => {
  const s = setup(); s.repository.settle.mockRejectedValueOnce(new DraftRepositoryError("quota"));
  expect(await s.invoke()).toEqual({ kind: "outcome-unknown" }); expect(s.live().localRecovery).toBeDefined();
  await s.runtime.checkResult(s.feature, "local-1"); expect(s.transport.request).toHaveBeenCalledOnce(); expect(s.repository.settle).toHaveBeenCalledTimes(2); expect(s.live().localRecovery).toBeUndefined(); expect(s.stored().operation.state).toBe("SETTLED");
});
it("late revision after HTTP cannot settle or publish into edited RAM", async () => {
  const s = setup(); s.transport.request.mockImplementation(async (_path, _init, dispatched) => { dispatched?.(); s.patch({ editRevision: 8 }); return fixture("sales-create-response").data; });
  expect(await s.invoke()).toEqual({ kind: "outcome-unknown" }); expect(s.repository.settle).not.toHaveBeenCalled(); expect(s.applySales).not.toHaveBeenCalled(); expect(s.live().localRecovery).toBeDefined();
});
it("does not overwrite an already committed clean checkpoint when feature binding fails", async () => {
  const s = setup(); s.applySales.mockReturnValue(false);
  expect(await s.invoke()).toEqual({ kind: "outcome-unknown" }); expect(s.stored().operation.state).toBe("SETTLED");
  s.capture(); await tick(); expect(s.stored().draft.unresolvedOperation).toBe(false); expect(s.stored().draft.localPersistSequence).toBe(3); expect(s.state()?.message).toMatch(/đã lưu|đối soát|liên kết/);
});
it.each(["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"])("settles a first direct ValidationError for %s without discarding input", async stem => {
  const s = setup(stem); const snapshot = captureFeatureDraft(s.feature, s.live());
  s.transport.request.mockImplementation(async (_path, _init, dispatched) => { dispatched?.(); throw new HttpError(400, { error: { code: "ValidationError", message: "Inactive product", details: [] } }); });
  expect((await s.invoke()).kind).toBe("failed"); expect(s.stored().operation.state).toBe("REJECTED");
  expect(s.stored().draft.snapshot).toEqual(snapshot); expect(s.live().localRecovery).toBeUndefined(); expect(s.live().writeReviewRequired).toBeFalsy();
  expect(s.transport.request).toHaveBeenCalledOnce(); expect(s.repository.settle).not.toHaveBeenCalled(); expect(s.noRead).not.toHaveBeenCalled();
});
it.each(["sales-update", "receipt-update"])("requires a server review after a known %s conflict, including restore", async stem => {
  const s = setup(stem); const code = `${stem.startsWith("sales") ? "SalesReceipt" : "GoodsReceipt"}.ConcurrencyConflict`;
  s.transport.request.mockImplementation(async (_path, _init, dispatched) => { dispatched?.(); throw new HttpError(409, { error: { code, message: "Conflict", details: [] } }); });
  expect((await s.invoke()).kind).toBe("failed"); expect(s.live().writeReviewRequired).toBe(true);
  const record = s.stored().draft; expect(await s.runtime.validateRestore(record)).toBe(true);
  s.patch({ writeReviewRequired: undefined });
  s.runtime.bindRestored(record, "local-1"); expect(s.live().writeReviewRequired).toBe(true); expect(s.live().mutation).toBe("idle");
});
it("coalesces a repeated request while the first atomic claim is pending", async () => {
  const s = setup(); const held = deferred<void>(), begin = s.repository.begin.getMockImplementation()!;
  s.repository.begin.mockImplementation(async input => { await held.promise; return begin(input); });
  const first = s.invoke(); await vi.waitFor(() => expect(s.repository.begin).toHaveBeenCalledOnce());
  expect(await s.invoke()).toMatchObject({ kind: "failed", dispatched: false }); held.resolve();
  expect((await first).kind).toBe("success"); expect(s.transport.request).toHaveBeenCalledOnce();
});
it("rejects a restored false marker or changed source instead of discovering a new writable intent", async () => {
  const s = setup(); s.transport.request.mockImplementation(async (_path, _init, dispatched) => { dispatched?.(); throw Error("lost"); });
  await s.invoke(); const record = s.stored().draft;
  expect(await s.runtime.validateRestore({ ...record, unresolvedOperation: false, operationId: null })).toBe(false);
  const changed = structuredClone(record); changed.snapshot.draft.note = "Changed after dispatch";
  expect(await s.runtime.validateRestore(changed)).toBe(false);
  expect(await s.runtime.validateRestore(record)).toBe(true);
});
it("retries only local rejection settlement after storage failure", async () => {
  const s = setup(); s.repository.reject.mockRejectedValueOnce(new DraftRepositoryError("quota"));
  s.transport.request.mockImplementation(async (_path, _init, dispatched) => { dispatched?.(); throw new HttpError(400, { error: { code: "ValidationError", message: "Inactive product", details: [] } }); });
  expect((await s.invoke()).kind).toBe("outcome-unknown"); expect(s.live().localRecovery).toBeDefined();
  await s.runtime.checkResult(s.feature, "local-1"); expect(s.transport.request).toHaveBeenCalledOnce(); expect(s.repository.reject).toHaveBeenCalledTimes(2);
  expect(s.stored().operation.state).toBe("REJECTED"); expect(s.live().localRecovery).toBeUndefined();
});
