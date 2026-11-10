import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { createWeb4MutationRuntime } from "../../../src/app/runtime/web4MutationRuntime";
import { createDurableDraftWorkspace } from "../../../src/app/runtime/durableDraftWorkspace";
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
import type { ManualResendClaim, ManualResendReceipt, Web6ManualResendRepository } from "../../../src/infrastructure/drafts/web6ManualResendRepository";
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/web4-v1/corpus/${name}.json`, import.meta.url), "utf8"));
const epoch = fixture("context-response").data.deploymentEpoch as string;
const namespace = { deploymentEpoch: epoch, actorKey: "42" };
const grants = { read: false, write: true, post: true };
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function setup(stem = "sales-create", options: { manual?: boolean; originalLost?: boolean } = {}) {
  const intent = fixture(`${stem}-intent`) as Web4WireIntent;
  const feature = stem.startsWith("sales") ? "sales" as const : "goods-receipt" as const;
  const kind = stem.endsWith("post") ? "post" as const : "save" as const;
  const scope = { ...namespace, actorGeneration: 1 };
  let authSnapshot = { ...scope, status: "authenticated", capabilities: grants, features: { sales: grants, "goods-receipt": grants } } as AuthSnapshot;
  const authListeners = new Set<() => void>();
  const auth = { getSnapshot: () => authSnapshot, subscribe: (listener: () => void) => { authListeners.add(listener); return () => { authListeners.delete(listener); }; } } as AuthSession;
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
      events.push("settle"); if (!diskOperation || diskOperation.state !== "DISPATCHED" || diskDraft?.localPersistSequence !== input.expectedDraftSequence) throw new DraftRepositoryError("conflict");
      diskDraft = structuredClone(input.settledDraft); const proof = input.proof;
      diskOperation = { ...diskOperation, state: "SETTLED", localPersistSequence: 2, settlement: { draftSequence: diskDraft.localPersistSequence, settledAt: diskDraft.savedAt,
        resultDocumentId: "saleId" in proof.value ? proof.value.saleId : proof.value.receiptId, status: proof.value.status, ...("version" in proof.value ? { version: proof.value.version } : {}) } };
      return structuredClone({ draft: diskDraft, operation: diskOperation });
    }),
    reject: vi.fn<Web4OperationRepository["reject"]>(async input => {
      events.push("reject"); if (!diskOperation || diskOperation.state !== "DISPATCHED" || diskDraft?.localPersistSequence !== input.expectedDraftSequence) throw new DraftRepositoryError("conflict");
      diskDraft = structuredClone(input.rejectedDraft);
      diskOperation = { ...diskOperation, state: "REJECTED", localPersistSequence: 2, settlement: null,
        rejection: { httpStatus: input.proof.httpStatus, code: input.proof.code, draftSequence: diskDraft.localPersistSequence, rejectedAt: diskDraft.savedAt } };
      return structuredClone({ draft: diskDraft, operation: diskOperation });
    }),
    resolveNegative: vi.fn(async (input: { resolvedDraft: DraftRecord; expectedDraftSequence: number; certificate: unknown }) => {
      events.push("negative"); if (!diskOperation || diskDraft?.localPersistSequence !== input.expectedDraftSequence) throw new DraftRepositoryError("conflict");
      diskDraft = structuredClone(input.resolvedDraft);
      diskOperation = { ...diskOperation, schemaVersion: 2, state: "NOT_EXECUTED", localPersistSequence: 2, settlement: null,
        negative: { draftSequence: diskDraft.localPersistSequence, resolvedAt: diskDraft.savedAt, certificate: input.certificate } } as DurableOperationRecord;
      return structuredClone({ draft: diskDraft, operation: diskOperation });
    }), close: vi.fn(),
  };
  let storedReceipt: ManualResendReceipt | null = null, storedClaim: ManualResendClaim | null = null, mutationCount = 0;
  const identity = () => { const op = diskOperation!; return { contractVersion: "web6-resend-eligibility-v1" as const, candidateId: "candidate-a", deploymentEpoch: epoch,
    actorUserId: 42, operationId: op.operationId, operationKind: op.frozen.request.operationKind, method: op.frozen.request.method,
    routeScope: op.frozen.request.routeScope, requestTargetId: op.frozen.request.requestTargetId, requestFingerprint: op.frozen.requestFingerprint }; };
  const manualRepository: Web6ManualResendRepository = {
    storeManualResendReceipt: vi.fn(async value => { events.push("receipt-store"); storedReceipt = structuredClone(value); return structuredClone(value); }),
    readManualResendReceipt: vi.fn<Web6ManualResendRepository["readManualResendReceipt"]>(async () => storedReceipt ? { kind: "available" as const, receipt: structuredClone(storedReceipt) } : { kind: "missing" as const }),
    claimManualResend: vi.fn<Web6ManualResendRepository["claimManualResend"]>(async input => { if (storedClaim) throw new DraftRepositoryError("conflict"); events.push("claim");
      storedClaim = { schemaVersion: 1, ...input.operationKey, requestFingerprint: input.expectedOperation.frozen.requestFingerprint, feature,
        localDocumentId: "local-1", sourceDraftSequence: input.expectedDraft.localPersistSequence, sourceOperationSequence: input.expectedOperation.localPersistSequence,
        editRevision: input.expectedDraft.editRevision, generation: input.generation, consentId: input.consentId, claimedAt: input.claimedAt, state: "CLAIMED" }; return structuredClone(storedClaim!); }),
    readManualResendClaim: vi.fn<Web6ManualResendRepository["readManualResendClaim"]>(async () => storedClaim ? { kind: "available" as const, claim: structuredClone(storedClaim) } : { kind: "missing" as const }),
    observeManualResendResponse: vi.fn(async input => { if (!storedClaim || storedClaim.consentId !== input.expectedConsentId) throw new DraftRepositoryError("conflict");
      storedClaim = { ...storedClaim, state: "RESPONSE_OBSERVED", observedAt: input.observedAt }; events.push("observed"); return structuredClone(storedClaim); }),
    retryConnection: vi.fn(), close: vi.fn(),
  };
  const transport = { request: vi.fn<HttpTransport["request"]>(async (path, _init, dispatch) => {
    if (path === "/api/v3/operations/resend-context") { events.push("context"); return { contractVersion: "web6-resend-eligibility-v1", candidateId: "candidate-a", deploymentEpoch: epoch, actorUserId: 42,
      serverUtc: "2026-11-10T01:00:00.0000000Z", maximumEligibilitySeconds: 604800, eligibilityEnabled: true }; }
    if (path.endsWith("/resend-receipt")) { events.push("receipt"); return { ...identity(), issuedAtUtc: "2026-11-10T01:00:00.0000000Z", eligibleUntilUtc: "2026-11-17T01:00:00.0000000Z", receipt: "opaque-signed-receipt" }; }
    if (path.endsWith("/resend-eligibility")) { events.push("eligibility"); return { ...identity(), decision: "ALLOW", reason: "ORIGINAL_NOT_OBSERVED_RECEIPT_VALID",
      serverUtc: "2026-11-10T01:00:01.0000000Z", eligibleUntilUtc: "2026-11-17T01:00:00.0000000Z" }; }
    if (path.startsWith("/api/v1/operations/")) {
      events.push("status"); const op = diskOperation!;
      const { operationKind, method, routeScope, requestTargetId } = op.frozen.request;
      return { deploymentEpoch: epoch, operationId: op.operationId, requestFingerprint: op.frozen.requestFingerprint, operationKind, method, routeScope, requestTargetId,
        state: "COMMITTED", outcome: fixture(`${stem}-response`) };
    }
    dispatch?.(); events.push("http"); mutationCount++; if (options.originalLost && mutationCount === 1) throw Error("lost"); return fixture(`${stem}-response`).data;
  }) };
  // Use the real feature acceptance paths; these ports can never perform reads.
  const noRead = vi.fn(async () => { throw Error("Public Get is forbidden in protected recovery"); });
  const salesCommands = createSalesPortCommands(salesStore, { get: noRead } as unknown as SalesPort);
  const receiptCommands = createGoodsReceiptCommands(receiptStore, { get: noRead } as unknown as GoodsReceiptPort);
  const applySales = vi.fn((...args: Parameters<typeof salesCommands.applyProtectedResult>) => { events.push("apply"); return salesCommands.applyProtectedResult(...args); });
  const applyReceipt = vi.fn((...args: Parameters<typeof receiptCommands.applyProtectedResult>) => { events.push("apply"); return receiptCommands.applyProtectedResult(...args); });
  const makeRuntime = () => createWeb4MutationRuntime({ auth, workspace: { store: salesStore, applyProtectedResult: applySales }, receipt: { store: receiptStore, applyProtectedResult: applyReceipt }, drafts: { capture, persistence }, repository, transport,
    ...(options.manual ? { manualResend: { enabled: true as const, candidateId: "candidate-a", repository: manualRepository } } : {}) });
  const runtime = makeRuntime();
  const context = { ...scope, signal: new AbortController().signal, document: { localDocumentId: "local-1", generation: 3, editRevision: 7 } };
  const invoke = () => {
    const session = live();
    if ("saleId" in session) return kind === "save" ? runtime.saveSales(session.mutationSnapshot!, context) : runtime.postSales({ saleId: session.saleId!, expectedVersion: session.baseline!.version }, context);
    return kind === "save" ? runtime.saveReceipt(session.mutationSnapshot!, context) : runtime.postReceipt({ receiptId: session.receiptId!, expectedVersion: session.baseline!.version }, context);
  };
  return { runtime, makeRuntime, context, live, patch, invoke, events, transport, repository, draftRepository, manualRepository, persistence, capture, noRead, applySales, applyReceipt, feature,
    stored: () => ({ draft: diskDraft!, operation: diskOperation! }), setDraft: (draft: DraftRecord) => { diskDraft = draft; },
    setGrants(currentGrants: typeof grants) {
      authSnapshot = { ...authSnapshot, ...(feature === "sales" ? { capabilities: currentGrants } : {}),
        features: { ...authSnapshot.features, [feature]: currentGrants } };
      authListeners.forEach(listener => listener());
    },
    revokeOriginalGrant() {
      // Ordinary Read and the other mutation grant cannot authorize this original operation.
      const currentGrants = { read: true, write: kind === "post", post: kind === "save" };
      authSnapshot = { ...authSnapshot, ...(feature === "sales" ? { capabilities: currentGrants } : {}),
        features: { ...authSnapshot.features, [feature]: currentGrants } };
      authListeners.forEach(listener => listener());
    },
    regrant() { authSnapshot = { ...authSnapshot, capabilities: grants, features: { ...authSnapshot.features, sales: grants, "goods-receipt": grants } }; authListeners.forEach(listener => listener()); },
    shift: () => { authSnapshot = { ...authSnapshot, actorGeneration: 2 }; }, state: () => runtime.state.getState().documents[localDraftStateKey(feature, "local-1")] };
}
it.each(["candidateMismatchOn", "eligibility401", "eligibility500"] as const)("manual prepare %s preserves original UNKNOWN bytes and never consumes a claim", async boundary => {
  const s = setup("sales-create", { manual: true, originalLost: true });
  await s.invoke();
  const before = structuredClone(s.stored());
  const request = s.transport.request.getMockImplementation()!;
  s.transport.request.mockImplementation(async (path, init, dispatch) => {
    if (boundary === "candidateMismatchOn" && path.endsWith("resend-context")) {
      return { ...await request(path, init, dispatch) as object, candidateId: "different-candidate" };
    }
    if (boundary === "eligibility401" && path.endsWith("resend-context")) { s.shift(); throw new HttpError(401, null); }
    if (boundary === "eligibility500" && path.endsWith("resend-eligibility")) throw new HttpError(500, null);
    return request(path, init, dispatch);
  });
  await expect(s.runtime.prepareManualResend(s.feature, "local-1")).rejects.toThrow();
  expect(s.stored()).toEqual(before);
  expect(s.stored().operation.state).toBe("DISPATCHED");
  expect(s.stored().draft.unresolvedOperation).toBe(true);
  expect(s.events.filter(event => event === "http")).toHaveLength(1);
  expect(s.manualRepository.claimManualResend).not.toHaveBeenCalled();
  s.runtime.dispose(); s.persistence.dispose();
});
it.each(["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"])("durably settles %s before publishing without public Read", async stem => {
  const s = setup(stem); const ids = s.live().draft!.lines.map(line => line.clientLineId);
  expect((await s.invoke()).kind).toBe("success"); expect(s.events).toEqual(["draft", "begin", "http", "settle", "apply"]);
  expect(s.stored().operation.state).toBe("SETTLED"); expect(s.stored().draft.unresolvedOperation).toBe(false);
  expect(s.live().localRecovery).toBeUndefined(); expect(s.live().draft!.lines.map(line => line.clientLineId)).toEqual(ids); expect(s.noRead).not.toHaveBeenCalled();
  if (stem === "receipt-post") expect(s.live().postAcknowledgement).not.toHaveProperty("version");
  if (stem === "sales-post") expect(s.live().postAcknowledgement).toHaveProperty("version");
});
it("keeps WEB6 network and storage completely off by default", async () => {
  const s = setup(); await s.invoke();
  expect(s.events).toEqual(["draft", "begin", "http", "settle", "apply"]);
  expect(s.manualRepository.storeManualResendReceipt).not.toHaveBeenCalled();
});
it.each(["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"])("claims before one exact frozen resend for %s", async stem => {
  const s = setup(stem, { manual: true, originalLost: true });
  expect(await s.invoke()).toEqual({ kind: "outcome-unknown" });
  const mutationCallsBefore = s.transport.request.mock.calls.filter(([path]) => !String(path).startsWith("/api/v3/") && !String(path).startsWith("/api/v1/operations/"));
  expect(mutationCallsBefore).toHaveLength(1);
  const info = await s.runtime.prepareManualResend(s.feature, "local-1");
  expect(info).toMatchObject({ operationKind: s.stored().operation.frozen.request.operationKind, consumed: false });
  const consentId = "11111111-1111-4111-8111-111111111111";
  expect((await s.runtime.confirmManualResend(s.feature, "local-1", consentId)).kind).toBe("success");
  const mutationCalls = s.transport.request.mock.calls.filter(([path]) => !String(path).startsWith("/api/v3/") && !String(path).startsWith("/api/v1/operations/"));
  expect(mutationCalls).toHaveLength(2);
  expect(mutationCalls[1][0]).toBe(mutationCalls[0][0]);
  const originalInit = mutationCalls[0]![1]!;
  expect(mutationCalls[1]![1]).toMatchObject({ method: originalInit.method, body: originalInit.body,
    headers: { "Idempotency-Key": s.stored().operation.operationId, "X-MyDmsVn-Deployment-Epoch": epoch } });
  expect(s.events.indexOf("claim")).toBeLessThan(s.events.lastIndexOf("http"));
  expect(s.manualRepository.claimManualResend).toHaveBeenCalledOnce();
  expect(s.manualRepository.observeManualResendResponse).toHaveBeenCalledOnce();
});
it("sends zero additional mutation when durable claim fails", async () => {
  const s = setup("sales-create", { manual: true, originalLost: true });
  await s.invoke();
  expect(await s.runtime.prepareManualResend(s.feature, "local-1")).not.toBeNull();
  vi.mocked(s.manualRepository.claimManualResend).mockRejectedValueOnce(new DraftRepositoryError("quota"));
  const before = s.events.filter(event => event === "http").length;
  expect(await s.runtime.confirmManualResend(s.feature, "local-1", "11111111-1111-4111-8111-111111111111")).toEqual({ kind: "outcome-unknown" });
  expect(s.events.filter(event => event === "http")).toHaveLength(before);
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
it("refuses a local-only retry without cached proof, without falling back to status HTTP", async () => {
  const s = setup();
  s.transport.request.mockImplementationOnce(async (_path, _init, dispatched) => { dispatched?.(); throw Error("lost"); });
  await s.invoke();
  expect(s.runtime.recoveryInfo(s.feature, "local-1")?.localRetry).toBe(false);
  await s.runtime.retryLocalResult(s.feature, "local-1");
  expect(s.transport.request).toHaveBeenCalledOnce(); expect(s.repository.settle).not.toHaveBeenCalled();
  expect(s.live().localRecovery).toBeDefined();
});
it("offers local retry only for cached proof and hides recovery after original grant or generation changes", async () => {
  const s = setup(); s.repository.settle.mockRejectedValueOnce(new DraftRepositoryError("quota"));
  await s.invoke();
  expect(s.runtime.recoveryInfo(s.feature, "local-1")).toMatchObject({ operationId: s.stored().operation.operationId, localRetry: true });
  await s.runtime.retryLocalResult(s.feature, "local-1");
  expect(s.transport.request).toHaveBeenCalledOnce(); expect(s.stored().operation.state).toBe("SETTLED");
  const r = setup("receipt-post"); r.transport.request.mockImplementationOnce(async (_path, _init, dispatched) => { dispatched?.(); throw Error("lost"); });
  await r.invoke(); expect(r.runtime.recoveryInfo(r.feature, "local-1")).toBeDefined();
  r.revokeOriginalGrant(); expect(r.runtime.recoveryInfo(r.feature, "local-1")).toBeUndefined();
  await r.runtime.retryLocalResult(r.feature, "local-1"); expect(r.transport.request).toHaveBeenCalledOnce();
  const g = setup(); g.transport.request.mockImplementationOnce(async (_path, _init, dispatched) => { dispatched?.(); throw Error("lost"); });
  await g.invoke(); g.shift(); expect(g.runtime.recoveryInfo(g.feature, "local-1")).toBeUndefined();
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

it.each(["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"])("does not check %s after its original grant is revoked despite ordinary Read", async stem => {
  const s = setup(stem);
  s.transport.request.mockImplementationOnce(async (_path, _init, dispatched) => { dispatched?.(); throw Error("lost"); });
  expect(await s.invoke()).toEqual({ kind: "outcome-unknown" });
  const protectedCheckpoint = structuredClone(s.stored()), input = structuredClone(s.live().draft);
  s.revokeOriginalGrant();
  await s.runtime.checkResult(s.feature, "local-1");
  expect(s.transport.request).toHaveBeenCalledOnce();
  expect(s.repository.begin).toHaveBeenCalledOnce();
  expect(s.repository.settle).not.toHaveBeenCalled(); expect(s.repository.reject).not.toHaveBeenCalled();
  expect(s.applySales).not.toHaveBeenCalled(); expect(s.applyReceipt).not.toHaveBeenCalled(); expect(s.noRead).not.toHaveBeenCalled();
  expect(s.stored()).toEqual(protectedCheckpoint); expect(s.live().draft).toEqual(input);
  expect(s.live().mutation).toBe("outcome-unknown"); expect(s.live().localRecovery?.operationId).toBe(protectedCheckpoint.operation.operationId);
});
it.each(["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"])("does not settle late %s status after its original grant is revoked despite ordinary Read", async stem => {
  const s = setup(stem), held = deferred<unknown>();
  s.transport.request.mockImplementationOnce(async (_path, _init, dispatched) => { dispatched?.(); throw Error("lost"); });
  expect(await s.invoke()).toEqual({ kind: "outcome-unknown" });
  const protectedCheckpoint = structuredClone(s.stored()), input = structuredClone(s.live().draft);
  s.transport.request.mockImplementationOnce(async () => held.promise);
  const checking = s.runtime.checkResult(s.feature, "local-1");
  await vi.waitFor(() => expect(s.transport.request).toHaveBeenCalledTimes(2));
  expect(s.transport.request.mock.calls[1][0]).toBe(`/api/v1/operations/${protectedCheckpoint.operation.operationId}`);
  s.revokeOriginalGrant();
  held.resolve({ ...fixture(`${stem}-status`).data, operationId: protectedCheckpoint.operation.operationId,
    requestFingerprint: protectedCheckpoint.operation.frozen.requestFingerprint });
  await checking;
  expect(s.transport.request).toHaveBeenCalledTimes(2); expect(s.repository.begin).toHaveBeenCalledOnce();
  expect(s.repository.settle).not.toHaveBeenCalled(); expect(s.repository.reject).not.toHaveBeenCalled();
  expect(s.applySales).not.toHaveBeenCalled(); expect(s.applyReceipt).not.toHaveBeenCalled(); expect(s.noRead).not.toHaveBeenCalled();
  expect(s.stored()).toEqual(protectedCheckpoint); expect(s.live().draft).toEqual(input);
  expect(s.live().mutation).toBe("outcome-unknown"); expect(s.live().localRecovery?.operationId).toBe(protectedCheckpoint.operation.operationId);
});

async function negativeSetup(stem = "sales-create") {
  const s = setup(stem);
  s.transport.request.mockImplementationOnce(async (_path, _init, dispatched) => { dispatched?.(); throw Error("lost"); });
  await s.invoke();
  s.transport.request.mockImplementation(async path => {
    if (path === "/api/v2/operations/context") return { contractVersion: "web5-resolution-v1", actorUserId: 42, deploymentEpoch: epoch, sameKeyResendEnabled: false };
    const { operation } = s.stored(), request = operation.frozen.request;
    return { contractVersion: "web5-resolution-v1", actorUserId: 42, deploymentEpoch: epoch, operationId: operation.operationId,
      requestFingerprint: operation.frozen.requestFingerprint, operationKind: request.operationKind, method: request.method, routeScope: request.routeScope,
      requestTargetId: request.requestTargetId, state: "NOT_EXECUTED", outcome: null,
      terminal: { decisionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", caseId: "CASE_42", decidedAtUtc: "2026-11-02T01:00:00.1234567Z" } };
  });
  return s;
}
it.each(["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"])("records %s negative atomically and preserves raw draft behind explicit review", async stem => {
  const s = await negativeSetup(stem), before = structuredClone(s.stored().draft.snapshot);
  expect(typeof s.runtime.checkResolution).toBe("function");
  await s.runtime.checkResolution(s.feature, "local-1");
  expect(s.stored().operation.state).toBe("NOT_EXECUTED"); expect(s.stored().draft.snapshot).toEqual(before);
  expect(s.live().localRecovery).toBeUndefined(); expect(s.live().mutation).toBe("idle"); expect(s.live().writeReviewRequired).toBe(true);
  expect(s.runtime.negativeReviewInfo(s.feature, "local-1")).toMatchObject({ caseId: "CASE_42", create: stem.endsWith("create") });
  expect(s.noRead).not.toHaveBeenCalled(); expect(s.events.filter(event => event === "http")).toHaveLength(0);
});
it("negative quota retains UNKNOWN and cached local retry sends no HTTP", async () => {
  const s = await negativeSetup(); s.repository.resolveNegative.mockRejectedValueOnce(new DraftRepositoryError("quota"));
  expect(typeof s.runtime.checkResolution).toBe("function"); await s.runtime.checkResolution(s.feature, "local-1");
  expect(s.stored().operation.state).toBe("DISPATCHED"); expect(s.live().localRecovery).toBeDefined(); expect(s.runtime.recoveryInfo(s.feature, "local-1")?.localRetry).toBe(true);
  const count = s.transport.request.mock.calls.length; await s.runtime.retryLocalResult(s.feature, "local-1");
  expect(s.transport.request).toHaveBeenCalledTimes(count); expect(s.stored().operation.state).toBe("NOT_EXECUTED");
});
it("negative proof cannot revive after revoke/regrant and Create needs separate explicit intent", async () => {
  const s = await negativeSetup(); expect(typeof s.runtime.checkResolution).toBe("function"); await s.runtime.checkResolution(s.feature, "local-1");
  s.revokeOriginalGrant(); s.regrant();
  expect(s.runtime.confirmCreateReintent(s.feature, "local-1")).toBe(false); expect(s.live().writeReviewRequired).toBe(true);
  await s.runtime.checkResolution(s.feature, "local-1");
  const calls = s.transport.request.mock.calls.length;
  expect(s.runtime.confirmCreateReintent(s.feature, "local-1")).toBe(true); expect(s.live().writeReviewRequired).toBeUndefined();
  expect(s.transport.request).toHaveBeenCalledTimes(calls);
});
it("stored negative inspection is local and cannot authorize restoration without a fresh exact server certificate", async () => {
  const s = await negativeSetup(); await s.runtime.checkResolution(s.feature, "local-1");
  const record = structuredClone(s.stored().draft); s.runtime.dispose();
  const restored = s.makeRuntime(), before = s.transport.request.mock.calls.length;
  await restored.inspectRecord(record); expect(s.transport.request).toHaveBeenCalledTimes(before);
  expect(restored.canReviewNegativeBaseline(s.feature, "local-1")).toBe(false);
  s.transport.request.mockImplementationOnce(async () => ({ contractVersion: "web5-resolution-v1", actorUserId: 42, deploymentEpoch: epoch, sameKeyResendEnabled: false }));
  s.transport.request.mockImplementationOnce(async () => { const operation = s.stored().operation; const certificate = operation.state === "NOT_EXECUTED" ? operation.negative.certificate as Record<string, unknown> : {}; return { ...certificate, state: "INDETERMINATE", terminal: null }; });
  expect(await restored.validateRestore(record)).toBe(false);
  expect(s.live().writeReviewRequired).toBe(true); expect(s.noRead).not.toHaveBeenCalled();
  expect(await restored.validateRestore(record)).toBe(true); restored.bindRestored(record, "local-1");
  expect(restored.negativeReviewInfo(s.feature, "local-1")).toMatchObject({ verified: true, reviewRequired: true });
  expect(restored.confirmCreateReintent(s.feature, "local-1")).toBe(true);
});
it("legacy DISPATCHED inspection and restoration perform no automatic status request", async () => {
  const s = await negativeSetup(), record = structuredClone(s.stored().draft), before = s.transport.request.mock.calls.length;
  s.runtime.dispose(); const restored = s.makeRuntime();
  await restored.inspectRecord(record); expect(await restored.validateRestore(record)).toBe(true); restored.bindRestored(record, "local-1");
  expect(s.transport.request).toHaveBeenCalledTimes(before); expect(s.live().mutation).toBe("outcome-unknown"); expect(s.live().localRecovery).toBeDefined();
});
it.each([
  ["receipt-post", "receipt-update", { read: false, write: true, post: false }],
  ["sales-update", "sales-post", { read: false, write: false, post: true }],
] as const)("recovers current %s successor %s with its own grant while historical negative remains protected", async (historicalStem, currentStem, currentGrants) => {
  const history = await negativeSetup(historicalStem);
  await history.runtime.checkResolution(history.feature, "local-1");
  const historical = structuredClone(history.stored()), historicalBytes = JSON.stringify(historical);
  expect(historical.operation.state).toBe("NOT_EXECUTED"); history.runtime.dispose();
  const s = setup(currentStem);
  // Seed the next reviewed baseline checkpoint. The current dispatch and its
  // subsequent recovery use the real runtime; earlier NTE bytes remain intact.
  const reviewed = { ...historical.draft, snapshot: captureFeatureDraft(s.feature, s.live())! };
  s.setDraft(reviewed); s.persistence.adopt(reviewed);
  s.transport.request.mockImplementationOnce(async (_path, _init, dispatched) => { dispatched?.(); throw Error("lost"); });
  expect(await s.invoke()).toEqual({ kind: "outcome-unknown" });
  const pending = structuredClone(s.stored());
  expect(pending.operation.operationId).not.toBe(historical.operation.operationId);
  expect(pending.draft.localPersistSequence).toBeGreaterThan(historical.draft.localPersistSequence);
  s.repository.findForDraft.mockImplementation(async () => ({ operations: [structuredClone(historical.operation), structuredClone(s.stored().operation)], quarantined: false }));
  s.runtime.dispose(); s.setGrants(currentGrants); const restored = s.makeRuntime();
  const before = s.transport.request.mock.calls.length;
  await restored.inspectRecord(pending.draft);
  expect(restored.canReviewRecord(pending.draft)).toBe(true);
  expect(await restored.validateRestore(pending.draft)).toBe(true);
  expect(restored.validateAdoption(pending.draft)).toBe(true);
  restored.bindRestored(pending.draft, "local-1");
  expect(restored.canReviewLiveRecord(s.feature, "local-1")).toBe(true);
  expect(restored.recoveryInfo(s.feature, "local-1")?.operationId).toBe(pending.operation.operationId);
  expect(restored.negativeReviewInfo(s.feature, "local-1")).toBeUndefined();
  expect(s.live().mutation).toBe("outcome-unknown"); expect(s.live().writeReviewRequired).toBe(true);
  expect(s.transport.request).toHaveBeenCalledTimes(before);
  const resolutionPaths: string[] = [];
  s.transport.request.mockImplementation(async path => {
    resolutionPaths.push(path);
    if (path === "/api/v2/operations/context") return { contractVersion: "web5-resolution-v1", actorUserId: 42, deploymentEpoch: epoch, sameKeyResendEnabled: false };
    expect(path).toBe(`/api/v2/operations/${pending.operation.operationId}/resolution`);
    return { ...fixture(`${currentStem}-status`).data, contractVersion: "web5-resolution-v1", actorUserId: 42, terminal: null,
      operationId: pending.operation.operationId, requestFingerprint: pending.operation.frozen.requestFingerprint };
  });
  await restored.checkResolution(s.feature, "local-1");
  expect(resolutionPaths).toEqual(["/api/v2/operations/context", `/api/v2/operations/${pending.operation.operationId}/resolution`]);
  expect(s.stored().operation.state).toBe("SETTLED"); expect(s.stored().draft.unresolvedOperation).toBe(false);
  expect(s.live().localRecovery).toBeUndefined(); expect(s.live().writeReviewRequired).toBe(true);
  expect(restored.canReviewNegativeBaseline(s.feature, "local-1")).toBe(false);
  expect(restored.negativeReviewInfo(s.feature, "local-1")).toBeUndefined();
  const after = s.transport.request.mock.calls.length;
  expect(await restored.validateRestore(s.stored().draft)).toBe(false);
  expect(s.transport.request).toHaveBeenCalledTimes(after); expect(s.noRead).not.toHaveBeenCalled();
  expect(JSON.stringify(historical)).toBe(historicalBytes);
  expect(s.repository.begin).toHaveBeenCalledOnce(); expect(s.repository.settle).toHaveBeenCalledOnce();
  restored.dispose();
});
it.each(["sales-update", "sales-post", "receipt-update", "receipt-post"])("negative %s proof without ordinary Read cannot confirm a new editable baseline", async stem => {
  const s = await negativeSetup(stem); await s.runtime.checkResolution(s.feature, "local-1");
  expect(s.runtime.negativeReviewInfo(s.feature, "local-1")).toMatchObject({ verified: true, create: false });
  expect(s.runtime.canReviewNegativeBaseline(s.feature, "local-1")).toBe(false);
  expect(s.runtime.confirmCreateReintent(s.feature, "local-1")).toBe(false); expect(s.live().writeReviewRequired).toBe(true);
});
it("a late negative response after revoke and regrant cannot clear UNKNOWN", async () => {
  const s = await negativeSetup(), held = deferred<unknown>(), negative = s.transport.request.getMockImplementation()!;
  s.transport.request.mockImplementationOnce(negative).mockImplementationOnce(async () => held.promise);
  const checking = s.runtime.checkResolution(s.feature, "local-1");
  await vi.waitFor(() => expect(s.transport.request).toHaveBeenCalledTimes(3));
  const certificate = await negative("resolution", {} as never);
  s.revokeOriginalGrant(); s.regrant(); held.resolve(certificate); await checking;
  expect(s.stored().operation.state).toBe("DISPATCHED"); expect(s.live().localRecovery).toBeDefined(); expect(s.runtime.recoveryInfo(s.feature, "local-1")?.localRetry).toBe(false);
});
it("revoking an active negative recheck releases its busy state while keeping fresh authority invalid", async () => {
  const s = await negativeSetup(); await s.runtime.checkResolution(s.feature, "local-1");
  const held = deferred<unknown>(), negative = s.transport.request.getMockImplementation()!, certificate = await negative("resolution", {} as never);
  s.transport.request.mockImplementationOnce(async () => held.promise);
  const checking = s.runtime.checkResolution(s.feature, "local-1");
  await vi.waitFor(() => expect(s.state().checking).toBe(true));
  s.revokeOriginalGrant(); held.resolve(certificate); await checking;
  expect(s.state().checking).toBe(false);
  s.regrant(); expect(s.runtime.negativeReviewInfo(s.feature, "local-1")?.verified).toBe(false); expect(s.runtime.confirmCreateReintent(s.feature, "local-1")).toBe(false);
});
it("a concurrent negative inspection between fresh authority and final draft reread cannot open an unguarded session", async () => {
  const s = await negativeSetup(); await s.runtime.checkResolution(s.feature, "local-1");
  const record = structuredClone(s.stored().draft); s.runtime.dispose(); const runtime = s.makeRuntime();
  const finalRead = deferred<void>(), inspection = deferred<Awaited<ReturnType<Web4OperationRepository["findForDraft"]>>>();
  let reads = 0, opened = false;
  const repository: DraftRepository = { ...s.draftRepository,
    list: vi.fn(async () => ({ records: [record], quarantined: [], conflicts: [] })),
    read: vi.fn(async () => { if (++reads === 2) await finalRead.promise; return { kind: "available" as const, record }; }) };
  const persistence = createLocalDraftPersistence({ namespace, repository, isCurrent: () => true });
  const workspace = createDurableDraftWorkspace({ repository, persistence, isCurrent: () => true, ready: () => true, allowed: () => true,
    isLive: () => opened, inspect: runtime.inspectRecord, validateRestore: runtime.validateRestore, allowedRecord: runtime.canReviewRecord,
    restore: () => { opened = true; s.patch({ writeReviewRequired: undefined }); return "local-1"; }, restored: runtime.bindRestored });
  await workspace.review(); const restoring = workspace.restore(record, record.localPersistSequence);
  await vi.waitFor(() => expect(reads).toBe(2));
  s.repository.findForDraft.mockImplementationOnce(async () => inspection.promise);
  const inspecting = runtime.inspectRecord(record); finalRead.resolve(); const restored = await restoring;
  inspection.resolve({ operations: [s.stored().operation], quarantined: false }); await inspecting;
  expect(restored).toBe(""); expect(opened).toBe(false);
  expect(persistence.state.getState().documents).toEqual({});
});
it("negative binding defensively retains review protection when synchronous restore callbacks invalidate inspection", async () => {
  const s = await negativeSetup(); await s.runtime.checkResolution(s.feature, "local-1");
  const record = structuredClone(s.stored().draft); s.runtime.dispose(); const runtime = s.makeRuntime();
  expect(await runtime.validateRestore(record)).toBe(true); s.patch({ writeReviewRequired: undefined });
  const held = deferred<Awaited<ReturnType<Web4OperationRepository["findForDraft"]>>>();
  s.repository.findForDraft.mockImplementationOnce(async () => held.promise);
  const inspect = runtime.inspectRecord(record); runtime.bindRestored(record, "local-1");
  const protectedReview = s.live().writeReviewRequired;
  held.resolve({ operations: [s.stored().operation], quarantined: false }); await inspect;
  expect(protectedReview).toBe(true); expect(runtime.canReviewNegativeBaseline(s.feature, "local-1")).toBe(false);
});
it.each(["forbidden", "timeout"])("an explicit negative recheck %s invalidates previous authority even while local grants remain allowed", async fault => {
  const s = await negativeSetup(); await s.runtime.checkResolution(s.feature, "local-1");
  expect(s.runtime.confirmCreateReintent(s.feature, "local-1")).toBe(true);
  const original = s.transport.request.getMockImplementation()!;
  s.transport.request.mockImplementationOnce(async () => { throw fault === "forbidden" ? new HttpError(403, {}) : Error("timeout"); });
  await s.runtime.checkResolution(s.feature, "local-1");
  expect(s.runtime.negativeReviewInfo(s.feature, "local-1")?.verified).toBe(false);
  expect(s.runtime.canReviewNegativeBaseline(s.feature, "local-1")).toBe(false); expect(s.runtime.confirmCreateReintent(s.feature, "local-1")).toBe(false);
  expect(s.live().writeReviewRequired).toBe(true); expect(s.stored().operation.state).toBe("NOT_EXECUTED");
  s.transport.request.mockImplementation(original); await s.runtime.checkResolution(s.feature, "local-1");
  expect(s.runtime.negativeReviewInfo(s.feature, "local-1")?.verified).toBe(true); expect(s.runtime.confirmCreateReintent(s.feature, "local-1")).toBe(true);
});
it.each(["sales-post", "receipt-post"])("withholds clean %s previews when the associated negative operation is quarantined", async stem => {
  const s = await negativeSetup(stem); await s.runtime.checkResolution(s.feature, "local-1");
  const record = structuredClone(s.stored().draft);
  expect(record.unresolvedOperation).toBe(false);
  s.revokeOriginalGrant(); s.runtime.dispose(); const restored = s.makeRuntime();
  s.repository.findForDraft.mockResolvedValueOnce({ operations: [], quarantined: true });
  const reads = s.transport.request.mock.calls.length;
  await restored.inspectRecord(record);
  expect(restored.canReviewRecord(record)).toBe(false);
  expect(s.transport.request).toHaveBeenCalledTimes(reads);
  expect(record.snapshot).toEqual(s.stored().draft.snapshot);
});
it.each(["none", "settled"])("admits ordinary clean previews after successful local inspection with %s operation history", async history => {
  const s = setup("sales-update"); expect((await s.invoke()).kind).toBe("success");
  const record = structuredClone(s.stored().draft);
  expect(record.unresolvedOperation).toBe(false);
  s.revokeOriginalGrant(); s.runtime.dispose(); const restored = s.makeRuntime();
  if (history === "none") s.repository.findForDraft.mockResolvedValueOnce({ operations: [], quarantined: false });
  const reads = s.transport.request.mock.calls.length;
  await restored.inspectRecord(record);
  expect(restored.canReviewRecord(record)).toBe(true);
  expect(s.transport.request).toHaveBeenCalledTimes(reads);
});
