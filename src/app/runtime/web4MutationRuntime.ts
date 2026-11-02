import { createStore } from "zustand/vanilla";
import type { WorkspaceRuntime } from "../workspace/panelRegistry";
import { sameActorScope, type DocumentIdentity, type DocumentModule } from "../workspace/documentContracts";
import type { GoodsReceiptRuntime } from "../../features/goodsReceipt/GoodsReceiptContext";
import type { SalesSession } from "../../features/sales/salesSessionStore";
import type { GoodsReceiptSession } from "../../features/goodsReceipt/goodsReceiptSessionStore";
import type { SalesDocument, SalesSaveSnapshot, PostAcknowledgement } from "../../features/sales/contracts";
import type { GoodsReceiptDocument, GoodsReceiptSaveSnapshot, GoodsReceiptPostAcknowledgement } from "../../features/goodsReceipt/contracts";
import type { PortContext, WriteResult } from "../../ports/portContracts";
import type { AuthSession } from "../../infrastructure/http/authSession";
import type { HttpTransport } from "../../infrastructure/http/readBoundary";
import { createSalesHttpPort } from "../../infrastructure/http/salesHttpPort";
import { createGoodsReceiptHttpPort } from "../../infrastructure/http/goodsReceiptHttpPort";
import { createOperationStatusPort, type Web4CommittedResult } from "../../infrastructure/http/operationStatusPort";
import { canonicalizeWeb4Request, freezeWeb4Operation, receiptPostOperationRequest, receiptSaveOperationRequest, salesPostOperationRequest, salesSaveOperationRequest, type Web4WireIntent } from "../../infrastructure/http/web4OperationCodec";
import { mapSavedDetail } from "../../infrastructure/http/salesWireMapper";
import { mapSavedGoodsReceiptDetail } from "../../infrastructure/http/goodsReceiptWireMapper";
import { decodeDurableOperationRecord, type DurableOperationRecord, type OperationCheckpoint, type Web4OperationRepository } from "../../infrastructure/drafts/web4OperationRepository";
import { decodeDraftRecord, DraftRepositoryError, type DraftRecord } from "../../infrastructure/drafts/draftRecord";
import { captureFeatureDraft, type FeatureDraftSnapshot } from "../../infrastructure/drafts/featureDraftSnapshot";
import { localDraftStateKey } from "../../infrastructure/drafts/localDraftPersistence";
import type { ProductionDrafts } from "./productionDrafts";
import { hasModuleCapability } from "./moduleCapabilities";
import type { Web4DirectRejection } from "../../infrastructure/http/directWriteRejection";

type Session = SalesSession | GoodsReceiptSession;
type DomainValue = SalesDocument | PostAcknowledgement | GoodsReceiptDocument | GoodsReceiptPostAcknowledgement;
type Lease = Awaited<ReturnType<ProductionDrafts["persistence"]["beginAtomic"]>>;
interface Owner { identity: DocumentIdentity; session: Session; kind: "save" | "post"; signal: AbortSignal }
interface KnownResult { checkpoint: OperationCheckpoint; proof?: Web4CommittedResult; rejection?: Web4DirectRejection; settled?: OperationCheckpoint }
export interface Web4DocumentOperationState { checking: boolean; message: string; operationId?: string; correlationId?: string }
export interface Web4MutationRuntimeOptions {
  auth: AuthSession;
  workspace: Pick<WorkspaceRuntime, "store" | "applyProtectedResult">;
  receipt: Pick<GoodsReceiptRuntime, "store" | "applyProtectedResult">;
  drafts: Pick<ProductionDrafts, "capture" | "persistence">;
  repository: Web4OperationRepository;
  transport: HttpTransport;
}
const unknown = (): WriteResult<never> => ({ kind: "outcome-unknown" });
const failed = (message: string): WriteResult<never> => ({ kind: "failed", dispatched: false, error: { kind: "unavailable", code: "LocalDraft.NotReady", message } });
const serverId = (session: Session) => "saleId" in session ? session.saleId : session.receiptId;
const operationKind = (operation: DurableOperationRecord) => operation.frozen.request.operationKind.endsWith(".Post") ? "post" as const : "save" as const;
function snapshotRequest(snapshot: FeatureDraftSnapshot, kind: "save" | "post"): Web4WireIntent {
  if (snapshot.feature === "sales") return kind === "save" ? salesSaveOperationRequest(snapshot.draft)
    : salesPostOperationRequest({ saleId: snapshot.serverId!, expectedVersion: snapshot.draft.expectedVersion! });
  return kind === "save" ? receiptSaveOperationRequest(snapshot.draft)
    : receiptPostOperationRequest({ receiptId: snapshot.serverId!, expectedVersion: snapshot.draft.expectedVersion! });
}
function sourceMatches(record: DraftRecord, operation: DurableOperationRecord): boolean {
  return operation.state === "DISPATCHED" && record.unresolvedOperation && record.operationId === operation.operationId &&
    record.deploymentEpoch === operation.deploymentEpoch && record.actorKey === operation.actorKey && record.feature === operation.feature &&
    record.localDocumentId === operation.localDocumentId && record.localPersistSequence === operation.draftCheckpointSequence && record.editRevision === operation.draftCheckpointEditRevision &&
    canonicalizeWeb4Request(snapshotRequest(record.snapshot, operationKind(operation))) === canonicalizeWeb4Request(operation.frozen.request);
}

export function createWeb4MutationRuntime(options: Web4MutationRuntimeOptions) {
  const { auth, workspace, receipt, drafts, repository, transport } = options;
  const scope = auth.getSnapshot();
  if (scope.status !== "authenticated") throw new Error("Authenticated operation scope required");
  const namespace = { deploymentEpoch: scope.deploymentEpoch, actorKey: scope.actorKey };
  const state = createStore<{ documents: Record<string, Web4DocumentOperationState> }>(() => ({ documents: {} }));
  const pending = new Set<string>();
  const known = new Map<string, KnownResult>();
  const validated = new Map<string, { record: string; operation?: DurableOperationRecord; reviewRequired?: boolean }>();
  const reads = new Set<AbortController>();
  const statusPort = createOperationStatusPort(transport, auth);
  let disposed = false;
  const key = (feature: DocumentModule, id: string) => localDraftStateKey(feature, id);
  const active = () => !disposed && auth.getSnapshot().status === "authenticated" && sameActorScope(scope, auth.getSnapshot());
  const session = (feature: DocumentModule, id: string): Session | undefined => feature === "sales" ? workspace.store.getState().sessions[id] : receipt.store.getState().sessions[id];
  function publish(feature: DocumentModule, id: string, value: Web4DocumentOperationState) {
    if (active()) state.setState(previous => ({ documents: { ...previous.documents, [key(feature, id)]: value } }));
  }
  function sameOwner(owner: Owner, current = session(owner.identity.module, owner.identity.sessionId)): current is Session {
    return !!current && sameActorScope(current, owner.identity) && current.sessionId === owner.identity.sessionId && current.generation === owner.identity.generation;
  }
  function current(owner: Owner, operationId?: string) {
    const live = session(owner.identity.module, owner.identity.sessionId);
    return active() && !owner.signal.aborted && sameOwner(owner, live) && live.editRevision === owner.identity.editRevision &&
      live.status === "ready" && !live.preparing && live.baseline === owner.session.baseline && live.draft === owner.session.draft &&
      serverId(live) === serverId(owner.session) && live.mutationSnapshot === owner.session.mutationSnapshot && live.mutationKind === owner.kind &&
      (operationId ? live.localRecovery?.operationId === operationId && (live.mutation === "pending" || live.mutation === "outcome-unknown") : !live.localRecovery && live.mutation === "pending") &&
      hasModuleCapability(auth.getSnapshot(), owner.identity, owner.identity.module, owner.kind === "post" ? "post" : "write");
  }
  function ownerFor(feature: DocumentModule, context: PortContext, kind: "save" | "post"): Owner | null {
    const document = context.document;
    if (!document || !sameActorScope(scope, context)) return null;
    const live = session(feature, document.localDocumentId);
    if (!live || !live.draft || !live.mutationSnapshot || !Number.isSafeInteger(document.editRevision) || !Number.isSafeInteger(document.generation)) return null;
    return { identity: { deploymentEpoch: context.deploymentEpoch, actorKey: context.actorKey, actorGeneration: context.actorGeneration,
      module: feature, sessionId: document.localDocumentId, generation: document.generation, editRevision: document.editRevision }, session: live, kind, signal: context.signal };
  }
  function mark(owner: Owner, operationId: string, message: string, mutation: "pending" | "outcome-unknown" = "outcome-unknown") {
    // A completed local begin must lock its old private owner even when auth or
    // edit revision changed during the transaction. Never touch a replacement.
    const change = { localRecovery: { operationId }, mutation, feedback: message };
    const id = owner.identity.sessionId;
    if (owner.identity.module === "sales") workspace.store.setState(previous => sameOwner(owner, previous.sessions[id]) ? { sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], ...change } } } : previous);
    else receipt.store.setState(previous => sameOwner(owner, previous.sessions[id]) ? { sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], ...change } } } : previous);
  }
  function publicUnknown(owner: Owner, operationId: string, message = "Kết quả chưa rõ; cần kiểm tra kết quả. Không tự gửi lại.", correlationId?: string) {
    mark(owner, operationId, message);
    publish(owner.identity.module, owner.identity.sessionId, { checking: false, message, operationId, ...(correlationId ? { correlationId } : {}) });
    return unknown();
  }
  function resultFromProof(owner: Owner, proof: Web4CommittedResult): DomainValue {
    if (proof.operationKind === "Sales.Create" || proof.operationKind === "Sales.Update") {
      if (!("saleId" in owner.session) || !owner.session.mutationSnapshot) throw new DraftRepositoryError("invalid-record");
      return mapSavedDetail(proof.value, owner.session.mutationSnapshot);
    }
    if (proof.operationKind === "Receipt.Create" || proof.operationKind === "Receipt.Update") {
      if (!("receiptId" in owner.session) || !owner.session.mutationSnapshot) throw new DraftRepositoryError("invalid-record");
      return mapSavedGoodsReceiptDetail(proof.value, owner.session.mutationSnapshot);
    }
    if (proof.operationKind === "Sales.Post" || proof.operationKind === "Receipt.Post") return structuredClone(proof.value);
    throw new DraftRepositoryError("invalid-record");
  }
  function settledSnapshot(owner: Owner, value: DomainValue): FeatureDraftSnapshot {
    const clean = { rawBuffers: {}, lookupBuffers: {}, dirty: false, mutation: "idle" as const, localRecovery: undefined };
    let snapshot: FeatureDraftSnapshot | null;
    if ("saleId" in owner.session && "saleId" in value) {
      const next = "saved" in value ? { ...owner.session, ...clean, saleId: value.saleId, baseline: value, draft: structuredClone(value.saved), postAcknowledgement: undefined }
        : { ...owner.session, ...clean, postAcknowledgement: value };
      snapshot = captureFeatureDraft("sales", next);
    } else if ("receiptId" in owner.session && "receiptId" in value) {
      const next = "saved" in value ? { ...owner.session, ...clean, receiptId: value.receiptId, baseline: value, draft: structuredClone(value.saved), postAcknowledgement: undefined }
        : { ...owner.session, ...clean, postAcknowledgement: value };
      snapshot = captureFeatureDraft("goods-receipt", next);
    } else throw new DraftRepositoryError("invalid-record");
    if (!snapshot) throw new DraftRepositoryError("invalid-record");
    return snapshot;
  }
  function apply(owner: Owner, operationId: string, value: DomainValue) {
    if (owner.identity.module === "sales" && "saleId" in value) return workspace.applyProtectedResult(owner.identity, operationId, "saved" in value ? { kind: "save", value } : { kind: "post", value });
    if (owner.identity.module === "goods-receipt" && "receiptId" in value) return receipt.applyProtectedResult(owner.identity, operationId, "saved" in value ? { kind: "save", value } : { kind: "post", value });
    return false;
  }
  async function reject(owner: Owner, lease: Lease, checkpoint: OperationCheckpoint, rejection: Web4DirectRejection): Promise<boolean> {
    const operationId = checkpoint.operation.operationId;
    const documentKey = key(owner.identity.module, owner.identity.sessionId);
    known.set(documentKey, { checkpoint, rejection });
    if (!current(owner, operationId)) { publicUnknown(owner, operationId); return false; }
    try {
      const next = decodeDraftRecord({ ...checkpoint.draft, localPersistSequence: checkpoint.draft.localPersistSequence + 1,
        savedAt: new Date().toISOString(), unresolvedOperation: false, operationId: null });
      const committed = await repository.reject({ operationKey: { ...namespace, operationId }, expectedOperationSequence: checkpoint.operation.localPersistSequence,
        expectedDraftSequence: checkpoint.draft.localPersistSequence, rejectedDraft: next, proof: rejection });
      known.set(documentKey, { checkpoint, rejection, settled: committed });
      if (!current(owner, operationId)) throw new DraftRepositoryError("conflict");
      lease.accept(committed.draft);
      const reviewRequired = rejection.code !== "ValidationError";
      const change = { localRecovery: undefined, mutation: "idle" as const, mutationKind: undefined, mutationSnapshot: undefined,
        writeReviewRequired: reviewRequired || undefined, feedback: reviewRequired ? "Máy chủ từ chối thao tác; cần đọc và xác nhận phiên bản máy chủ trước khi ghi tiếp." : "Máy chủ từ chối thao tác. Nội dung nhập đã được giữ để sửa." };
      const id = owner.identity.sessionId;
      if (owner.identity.module === "sales") workspace.store.setState(previous => ({ sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], ...change } } }));
      else receipt.store.setState(previous => ({ sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], ...change } } }));
      publish(owner.identity.module, id, { checking: false, operationId, message: change.feedback });
      return true;
    } catch (error) {
      lease.fail(error);
      publicUnknown(owner, operationId, known.get(documentKey)?.settled ? "Kết quả từ chối đã lưu trên thiết bị. Tải lại để khôi phục bản đã lưu."
        : "Máy chủ từ chối nhưng chưa lưu được kết quả trên thiết bị. Kiểm tra kết quả để thử lưu cục bộ; không gửi lại chứng từ.");
      return false;
    }
  }
  async function settle(owner: Owner, lease: Lease, checkpoint: OperationCheckpoint, proof: Web4CommittedResult): Promise<WriteResult<DomainValue>> {
    const operationId = checkpoint.operation.operationId;
    const documentKey = key(owner.identity.module, owner.identity.sessionId);
    known.set(documentKey, { checkpoint, proof });
    if (!current(owner, operationId)) return publicUnknown(owner, operationId);
    try {
      const value = resultFromProof(owner, proof);
      const next = decodeDraftRecord({ ...checkpoint.draft, localPersistSequence: checkpoint.draft.localPersistSequence + 1,
        savedAt: new Date().toISOString(), unresolvedOperation: false, operationId: null, snapshot: settledSnapshot(owner, value) });
      const committed = await repository.settle({ operationKey: { ...namespace, operationId }, expectedOperationSequence: checkpoint.operation.localPersistSequence,
        expectedDraftSequence: checkpoint.draft.localPersistSequence, settledDraft: next, proof });
      // Retain this fact before any UI/queue work. Failure below must never send
      // the old unknown RAM snapshot over the newly committed clean checkpoint.
      known.set(documentKey, { checkpoint, proof, settled: committed });
      if (!current(owner, operationId)) throw new DraftRepositoryError("conflict");
      lease.accept(committed.draft);
      if (!current(owner, operationId) || !apply(owner, operationId, value)) throw new DraftRepositoryError("conflict");
      publish(owner.identity.module, owner.identity.sessionId, { checking: false, operationId, message: "Đã lưu kết quả đối soát trên thiết bị." });
      return { kind: "success", value };
    } catch (error) {
      lease.fail(error);
      return publicUnknown(owner, operationId, known.get(documentKey)?.settled
        ? "Kết quả đã lưu trên thiết bị nhưng chưa liên kết được phiên. Giữ khóa; tải lại để khôi phục bản đã lưu."
        : "Đã có kết quả nhưng chưa lưu được trên thiết bị. Kiểm tra kết quả để thử lưu cục bộ; không gửi lại chứng từ.");
    }
  }
  async function write(feature: DocumentModule, kind: "save" | "post", request: () => Web4WireIntent, context: PortContext): Promise<WriteResult<DomainValue>> {
    const owner = ownerFor(feature, context, kind);
    if (!owner || !current(owner)) return failed("Phiên hoặc quyền ghi không còn phù hợp.");
    const documentKey = key(feature, owner.identity.sessionId);
    if (pending.has(documentKey)) return failed("Đang xử lý thao tác của chứng từ.");
    pending.add(documentKey);
    let lease: Lease | undefined, checkpoint: OperationCheckpoint | undefined;
    try {
      const expected = request();
      const captured = captureFeatureDraft(feature, owner.session);
      if (!captured || canonicalizeWeb4Request(snapshotRequest(captured, kind)) !== canonicalizeWeb4Request(expected)) return failed("Snapshot ghi không khớp phiên đã chuẩn bị.");
      const frozen = await freezeWeb4Operation(expected, { ...namespace, operationId: crypto.randomUUID() });
      if (!current(owner)) return failed("Phiên đã đổi trước khi lưu thao tác.");
      drafts.capture();
      lease = await drafts.persistence.beginAtomic({ feature, localDocumentId: owner.identity.sessionId }, owner.identity.editRevision);
      if (!current(owner) || canonicalizeWeb4Request(snapshotRequest(lease.checkpoint.snapshot, kind)) !== canonicalizeWeb4Request(frozen.request)) return failed("Checkpoint không khớp snapshot ghi.");
      checkpoint = await repository.begin({ draft: { ...lease.checkpoint, localPersistSequence: lease.checkpoint.localPersistSequence + 1, savedAt: new Date().toISOString() }, operation: frozen, expectedDraftSequence: lease.checkpoint.localPersistSequence });
      known.set(documentKey, { checkpoint });
      mark(owner, frozen.operationId, "Đã lưu thao tác; đang chờ kết quả.", "pending");
      lease.accept(checkpoint.draft);
      if (!current(owner, frozen.operationId)) return publicUnknown(owner, frozen.operationId);
      let proof: Web4CommittedResult | undefined;
      let rejection: Web4DirectRejection | undefined;
      const settings = { operation: frozen, onCommitted: (value: Web4CommittedResult) => { proof = value; }, onRejected: (value: Web4DirectRejection) => { rejection = value; } };
      let result: WriteResult<DomainValue>;
      if (feature === "sales" && "saleId" in owner.session) {
        const port = createSalesHttpPort(transport, auth, settings);
        result = kind === "save" ? await port.save(owner.session.mutationSnapshot!, context)
          : await port.post({ saleId: owner.session.saleId!, expectedVersion: owner.session.baseline!.version }, context);
      } else if (feature === "goods-receipt" && "receiptId" in owner.session) {
        const port = createGoodsReceiptHttpPort(transport, auth, settings);
        result = kind === "save" ? await port.save(owner.session.mutationSnapshot!, context)
          : await port.post({ receiptId: owner.session.receiptId!, expectedVersion: owner.session.baseline!.version }, context);
      } else throw new DraftRepositoryError("invalid-record");
      // This proof comes only from this newly won first dispatch. Never use a
      // negative status response to retire an older unresolved attempt.
      if (result.kind === "failed" && rejection) return await reject(owner, lease, checkpoint, rejection) ? result : unknown();
      if (result.kind !== "success" || !proof) return publicUnknown(owner, frozen.operationId);
      return await settle(owner, lease, checkpoint, proof);
    } catch (error) {
      if (checkpoint) { lease?.fail(error); return publicUnknown(owner, checkpoint.operation.operationId); }
      lease?.fail(error);
      return failed("Chưa lưu được thao tác trên thiết bị; chưa gửi chứng từ. Bản nhập vẫn còn trong phiên.");
    } finally { lease?.release(); pending.delete(documentKey); }
  }
  async function validateRestore(value: DraftRecord): Promise<boolean> {
    if (!active()) return false;
    const documentKey = key(value.feature, value.localDocumentId);
    validated.delete(documentKey);
    try {
      const record = decodeDraftRecord(value, { ...namespace, feature: value.feature, localDocumentId: value.localDocumentId });
      const result = await repository.findForDraft(record);
      if (!active() || result.quarantined) return false;
      const operations: DurableOperationRecord[] = [];
      for (const item of result.operations) {
        const operation = await decodeDurableOperationRecord(item, { ...namespace, operationId: item.operationId });
        if (!active() || operation.feature !== record.feature || operation.localDocumentId !== record.localDocumentId) return false;
        operations.push(operation);
      }
      const unresolved = operations.filter(operation => operation.state === "DISPATCHED");
      if (record.operationId === null) {
        if (unresolved.length !== 0) return false;
        const reviewRequired = operations.some(operation => operation.state === "REJECTED" && operation.rejection.code !== "ValidationError" && operation.rejection.draftSequence === record.localPersistSequence);
        validated.set(documentKey, { record: JSON.stringify(record), reviewRequired }); return true;
      }
      if (unresolved.length !== 1 || !sourceMatches(record, unresolved[0])) return false;
      validated.set(documentKey, { record: JSON.stringify(record), operation: unresolved[0] }); return true;
    } catch { return false; }
  }
  function bindRestored(record: DraftRecord, id: string): void {
    const admitted = validated.get(key(record.feature, record.localDocumentId));
    if (!active() || id !== record.localDocumentId || !admitted || admitted.record !== JSON.stringify(decodeDraftRecord(record))) return;
    const live = session(record.feature, id);
    if (!live || !sameActorScope(scope, live) || live.editRevision !== record.editRevision || (live.localRecovery?.operationId ?? null) !== record.operationId) return;
    if (admitted.reviewRequired) {
      const change = { writeReviewRequired: true, feedback: "Cần đọc và xác nhận phiên bản máy chủ trước khi ghi tiếp." };
      if (record.feature === "sales") workspace.store.setState(previous => ({ sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], ...change } } }));
      else receipt.store.setState(previous => ({ sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], ...change } } }));
    }
    const operation = admitted.operation;
    if (!operation) return;
    if (record.snapshot.feature === "sales") {
      const snapshot = structuredClone(record.snapshot.draft);
      workspace.store.setState(previous => ({ sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], mutationSnapshot: snapshot, mutationKind: operationKind(operation), mutation: "outcome-unknown" } } }));
    } else {
      const snapshot = structuredClone(record.snapshot.draft);
      receipt.store.setState(previous => ({ sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], mutationSnapshot: snapshot, mutationKind: operationKind(operation), mutation: "outcome-unknown" } } }));
    }
    known.set(key(record.feature, id), { checkpoint: { draft: record, operation } });
    publish(record.feature, id, { checking: false, operationId: operation.operationId, message: "Đã khôi phục thao tác chưa rõ kết quả; cần kiểm tra kết quả. Không tự gửi lại." });
  }
  async function checkResult(feature: DocumentModule, id: string): Promise<void> {
    const live = session(feature, id), operationId = live?.localRecovery?.operationId;
    const documentKey = key(feature, id);
    if (!active() || !live || !operationId || !live.mutationKind || pending.has(documentKey)) return;
    const controller = new AbortController();
    const context = { ...namespace, actorGeneration: scope.actorGeneration, signal: controller.signal, document: { localDocumentId: id, generation: live.generation, editRevision: live.editRevision } };
    const owner = ownerFor(feature, context, live.mutationKind);
    if (!owner || !current(owner, operationId)) return;
    pending.add(documentKey);
    reads.add(controller);
    publish(feature, id, { checking: true, operationId, message: "Đang kiểm tra kết quả thao tác…" });
    let lease: Lease | undefined;
    try {
      const cached = known.get(documentKey);
      if (cached?.settled) { publicUnknown(owner, operationId, "Kết quả đã lưu trên thiết bị. Tải lại để khôi phục bản đã lưu; không gửi lại chứng từ."); return; }
      lease = await drafts.persistence.beginAtomic({ feature, localDocumentId: id }, owner.identity.editRevision, { retryOperationId: operationId });
      if (!current(owner, operationId)) return;
      repository.retryConnection?.();
      const read = await repository.read({ ...namespace, operationId });
      if (!current(owner, operationId)) return;
      if (read.kind !== "available") { publicUnknown(owner, operationId, "Không có bằng chứng thao tác cục bộ hợp lệ; tiếp tục giữ khóa."); return; }
      const operation = await decodeDurableOperationRecord(read.operation, { ...namespace, operationId });
      if (!current(owner, operationId) || !sourceMatches(lease.checkpoint, operation)) { publicUnknown(owner, operationId, "Checkpoint thao tác không khớp; tiếp tục giữ khóa."); return; }
      const checkpoint = { draft: lease.checkpoint, operation };
      if (cached?.checkpoint.operation.operationId === operationId && cached.checkpoint.operation.frozen.requestFingerprint === operation.frozen.requestFingerprint && cached.rejection) {
        await reject(owner, lease, checkpoint, cached.rejection); return;
      }
      let proof = cached?.checkpoint.operation.operationId === operationId && cached.checkpoint.operation.frozen.requestFingerprint === operation.frozen.requestFingerprint ? cached.proof : undefined;
      if (!proof) {
        const status = await statusPort.read(operation.frozen, context, () => current(owner, operationId));
        if (!current(owner, operationId)) return;
        if (status.kind !== "committed") { publicUnknown(owner, operationId, "Chưa có bằng chứng đã hoàn tất; tiếp tục giữ khóa. Không tự gửi lại.", status.correlationId); return; }
        proof = status;
      }
      await settle(owner, lease, checkpoint, proof);
    } catch (error) { lease?.fail(error); publicUnknown(owner, operationId, "Không thể kiểm tra hoặc lưu kết quả; tiếp tục giữ khóa."); }
    finally {
      lease?.release(); pending.delete(documentKey); reads.delete(controller);
      const previous = state.getState().documents[documentKey];
      if (previous?.checking) publish(feature, id, { ...previous, checking: false });
    }
  }
  return {
    state, validateRestore, bindRestored, checkResult,
    saveSales: (snapshot: SalesSaveSnapshot, context: PortContext) => write("sales", "save", () => salesSaveOperationRequest(snapshot), context) as Promise<WriteResult<SalesDocument>>,
    postSales: (input: { saleId: string; expectedVersion: string }, context: PortContext) => write("sales", "post", () => salesPostOperationRequest(input), context) as Promise<WriteResult<PostAcknowledgement>>,
    saveReceipt: (snapshot: GoodsReceiptSaveSnapshot, context: PortContext) => write("goods-receipt", "save", () => receiptSaveOperationRequest(snapshot), context) as Promise<WriteResult<GoodsReceiptDocument>>,
    postReceipt: (input: { receiptId: string; expectedVersion: string }, context: PortContext) => write("goods-receipt", "post", () => receiptPostOperationRequest(input), context) as Promise<WriteResult<GoodsReceiptPostAcknowledgement>>,
    dispose() { disposed = true; reads.forEach(controller => controller.abort()); reads.clear(); validated.clear(); known.clear(); state.setState({ documents: {} }); repository.close(); },
  };
}
export type Web4MutationRuntime = ReturnType<typeof createWeb4MutationRuntime>;
