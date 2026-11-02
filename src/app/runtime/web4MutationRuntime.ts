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
import { createOperationResolutionPort, decodeOperationResolution, type Web5NotExecutedCertificate } from "../../infrastructure/http/operationResolutionPort";
import { createNegativeLineageAdmission, type NegativeLineageAdmission } from "../../infrastructure/drafts/negativeLineageAdmission";

type Session = SalesSession | GoodsReceiptSession;
type DomainValue = SalesDocument | PostAcknowledgement | GoodsReceiptDocument | GoodsReceiptPostAcknowledgement;
type Lease = Awaited<ReturnType<ProductionDrafts["persistence"]["beginAtomic"]>>;
interface Owner { identity: DocumentIdentity; session: Session; kind: "save" | "post"; signal: AbortSignal; authorityRevision: number }
interface KnownResult { checkpoint: OperationCheckpoint; proof?: Web4CommittedResult; rejection?: Web4DirectRejection; negative?: Web5NotExecutedCertificate; settled?: OperationCheckpoint }
export interface Web4DocumentOperationState { checking: boolean; message: string; operationId?: string; correlationId?: string }
export interface Web4MutationRuntimeOptions {
  auth: AuthSession;
  workspace: Pick<WorkspaceRuntime, "store" | "applyProtectedResult">;
  receipt: Pick<GoodsReceiptRuntime, "store" | "applyProtectedResult">;
  drafts: Pick<ProductionDrafts, "capture" | "persistence">;
  repository: Web4OperationRepository;
  transport: HttpTransport;
  negativeAdmission?: NegativeLineageAdmission;
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
  const negativeLineages = new Map<string, DurableOperationRecord[]>();
  const reads = new Set<AbortController>();
  const owners = new Map<string, DocumentIdentity>();
  const statusPort = createOperationStatusPort(transport, auth);
  const resolutionPort = createOperationResolutionPort(transport, auth);
  const negativeAdmission = options.negativeAdmission ?? createNegativeLineageAdmission();
  let disposed = false, authorityRevision = 0;
  const key = (feature: DocumentModule, id: string) => localDraftStateKey(feature, id);
  const active = () => !disposed && auth.getSnapshot().status === "authenticated" && sameActorScope(scope, auth.getSnapshot());
  const session = (feature: DocumentModule, id: string): Session | undefined => feature === "sales" ? workspace.store.getState().sessions[id] : receipt.store.getState().sessions[id];
  const originalGrant = (operation: DurableOperationRecord) => active() && operation.actorKey === scope.actorKey && operation.deploymentEpoch === scope.deploymentEpoch &&
    hasModuleCapability(auth.getSnapshot(), scope, operation.feature, operationKind(operation) === "post" ? "post" : "write");
  function canReviewLiveRecord(feature: DocumentModule, id: string) {
    const live = session(feature, id), lineage = negativeLineages.get(key(feature, id)), identity = owners.get(key(feature, id));
    return !!live && active() && sameActorScope(scope, live) && (lineage?.length ? !!identity && live.generation === identity.generation && lineage.every(originalGrant) : live.localRecovery ? !!recoveryInfo(feature, id) : canReviewFeature(feature));
  }
  function canReviewNegativeBaseline(feature: DocumentModule, id: string) {
    const lineage = negativeLineages.get(key(feature, id));
    if (!lineage?.length) return true;
    const live = session(feature, id), identity = owners.get(key(feature, id));
    return !!live && !!identity && live.generation === identity.generation && sameActorScope(live, identity) && !live.localRecovery && live.mutation === "idle" &&
      lineage.every(operation => originalGrant(operation) && negativeAdmission.allows(operation)) &&
      (!serverId(live) || hasModuleCapability(auth.getSnapshot(), scope, feature, "read"));
  }
  function negativeReviewInfo(feature: DocumentModule, id: string) {
    const lineage = negativeLineages.get(key(feature, id)), live = session(feature, id);
    if (!lineage?.length || !live || !canReviewLiveRecord(feature, id)) return;
    const operation = lineage[lineage.length - 1];
    if (operation.state !== "NOT_EXECUTED") return;
    const proof = decodeOperationResolution(operation.negative.certificate, operation.frozen);
    if (proof.kind !== "not-executed") return;
    return { operationId: operation.operationId, ...proof.certificate.terminal, create: serverId(live) === null, reviewRequired: !!live.writeReviewRequired,
      verified: lineage.every(item => originalGrant(item) && negativeAdmission.allows(item)) };
  }
  function confirmCreateReintent(feature: DocumentModule, id: string): boolean {
    const live = session(feature, id), identity = owners.get(key(feature, id));
    if (!live || !identity || serverId(live) !== null || !live.writeReviewRequired || live.preparing || live.editRevision !== identity.editRevision ||
      !negativeReviewInfo(feature, id) || !canReviewNegativeBaseline(feature, id) || !hasModuleCapability(auth.getSnapshot(), scope, feature, "write")) return false;
    const change = { writeReviewRequired: undefined, feedback: "Đã xác nhận bản nháp mới. Chọn Lưu để bắt đầu một thao tác mới." };
    if (feature === "sales") workspace.store.setState(previous => ({ sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], ...change } } }));
    else receipt.store.setState(previous => ({ sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], ...change } } }));
    return true;
  }
  function canReviewFeature(feature: DocumentModule, protectedUnknown = false) {
    if (!active()) return false;
    const grant = (action: "read" | "write" | "post") => hasModuleCapability(auth.getSnapshot(), scope, feature, action);
    return protectedUnknown ? grant("write") && grant("post") : grant("read") || grant("write") || grant("post");
  }
  function canReviewRecord(record: DraftRecord) {
    if (!active() || record.actorKey !== scope.actorKey || record.deploymentEpoch !== scope.deploymentEpoch) return false;
    const lineage = negativeLineages.get(key(record.feature, record.localDocumentId));
    const item = validated.get(key(record.feature, record.localDocumentId));
    if (lineage?.length && (item?.record !== JSON.stringify(record) || !lineage.every(originalGrant))) return false;
    if (!record.unresolvedOperation) return item?.record === JSON.stringify(record) && canReviewFeature(record.feature);
    const operation = item?.record === JSON.stringify(record) ? item.operation : undefined;
    return operation ? hasModuleCapability(auth.getSnapshot(), scope, record.feature, operationKind(operation) === "post" ? "post" : "write")
      : canReviewFeature(record.feature, true);
  }
  function recoveryInfo(feature: DocumentModule, id: string) {
    const live = session(feature, id), cached = known.get(key(feature, id)), identity = owners.get(key(feature, id));
    if (!active() || !live || !cached || !identity || !sameActorScope(scope, live) || live.generation !== identity.generation ||
      live.editRevision !== identity.editRevision || live.localRecovery?.operationId !== cached.checkpoint.operation.operationId ||
      live.mutationKind !== operationKind(cached.checkpoint.operation) ||
      !hasModuleCapability(auth.getSnapshot(), scope, feature, operationKind(cached.checkpoint.operation) === "post" ? "post" : "write")) return;
    return { operationId: cached.checkpoint.operation.operationId, deploymentEpoch: namespace.deploymentEpoch,
      localRetry: !!(cached.proof || cached.rejection || cached.negative) && !cached.settled };
  }
  function publish(feature: DocumentModule, id: string, value: Web4DocumentOperationState) {
    if (active()) state.setState(previous => ({ documents: { ...previous.documents, [key(feature, id)]: value } }));
  }
  function sameOwner(owner: Owner, current = session(owner.identity.module, owner.identity.sessionId)): current is Session {
    return !!current && sameActorScope(current, owner.identity) && current.sessionId === owner.identity.sessionId && current.generation === owner.identity.generation;
  }
  function current(owner: Owner, operationId?: string) {
    const live = session(owner.identity.module, owner.identity.sessionId);
    return active() && owner.authorityRevision === authorityRevision && !owner.signal.aborted && sameOwner(owner, live) && live.editRevision === owner.identity.editRevision &&
      live.status === "ready" && !live.preparing && live.baseline === owner.session.baseline && live.draft === owner.session.draft &&
      serverId(live) === serverId(owner.session) && live.mutationSnapshot === owner.session.mutationSnapshot && live.mutationKind === owner.kind &&
      (operationId ? live.localRecovery?.operationId === operationId && (live.mutation === "pending" || live.mutation === "outcome-unknown") : !live.localRecovery && live.mutation === "pending" && !live.writeReviewRequired &&
        (!(negativeLineages.get(key(owner.identity.module, owner.identity.sessionId))?.length) || owners.get(key(owner.identity.module, owner.identity.sessionId))?.generation === live.generation) &&
        (negativeLineages.get(key(owner.identity.module, owner.identity.sessionId)) ?? []).every(operation => originalGrant(operation) && negativeAdmission.allows(operation))) &&
      hasModuleCapability(auth.getSnapshot(), owner.identity, owner.identity.module, owner.kind === "post" ? "post" : "write");
  }
  function ownerFor(feature: DocumentModule, context: PortContext, kind: "save" | "post"): Owner | null {
    const document = context.document;
    if (!document || !sameActorScope(scope, context)) return null;
    const live = session(feature, document.localDocumentId);
    if (!live || !live.draft || !live.mutationSnapshot || !Number.isSafeInteger(document.editRevision) || !Number.isSafeInteger(document.generation)) return null;
    return { identity: { deploymentEpoch: context.deploymentEpoch, actorKey: context.actorKey, actorGeneration: context.actorGeneration,
      module: feature, sessionId: document.localDocumentId, generation: document.generation, editRevision: document.editRevision }, session: live, kind, signal: context.signal, authorityRevision };
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
  async function resolveNegative(owner: Owner, lease: Lease, checkpoint: OperationCheckpoint, certificate: Web5NotExecutedCertificate): Promise<void> {
    const operationId = checkpoint.operation.operationId, documentKey = key(owner.identity.module, owner.identity.sessionId);
    const proof = decodeOperationResolution(certificate, checkpoint.operation.frozen);
    if (proof.kind !== "not-executed" || !repository.resolveNegative) throw new DraftRepositoryError("protected");
    known.set(documentKey, { checkpoint, negative: proof.certificate });
    if (!current(owner, operationId)) { publicUnknown(owner, operationId); return; }
    try {
      const next = decodeDraftRecord({ ...checkpoint.draft, localPersistSequence: checkpoint.draft.localPersistSequence + 1,
        savedAt: new Date().toISOString(), unresolvedOperation: false, operationId: null });
      const committed = await repository.resolveNegative({ operationKey: { ...namespace, operationId }, expectedOperationSequence: checkpoint.operation.localPersistSequence,
        expectedDraftSequence: checkpoint.draft.localPersistSequence, resolvedDraft: next, certificate: proof.certificate, isCurrent: () => current(owner, operationId) });
      known.set(documentKey, { checkpoint, negative: proof.certificate, settled: committed });
      if (!current(owner, operationId)) throw new DraftRepositoryError("conflict");
      const terminal = await decodeDurableOperationRecord(committed.operation, { ...namespace, operationId });
      if (!current(owner, operationId)) throw new DraftRepositoryError("conflict");
      negativeAdmission.admit(terminal, () => active() && owner.authorityRevision === authorityRevision && originalGrant(terminal));
      negativeLineages.set(documentKey, [...(negativeLineages.get(documentKey) ?? []).filter(item => item.operationId !== operationId), terminal]);
      lease.accept(committed.draft);
      const change = { localRecovery: undefined, mutation: "idle" as const, mutationKind: undefined, mutationSnapshot: undefined, writeReviewRequired: true,
        feedback: "Máy chủ đã xác nhận thao tác gốc không được thực hiện. Nội dung được giữ; cần xem lại trước khi tạo thao tác mới." };
      const id = owner.identity.sessionId;
      if (owner.identity.module === "sales") workspace.store.setState(previous => ({ sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], ...change } } }));
      else receipt.store.setState(previous => ({ sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], ...change } } }));
      publish(owner.identity.module, id, { checking: false, operationId, message: change.feedback });
    } catch (error) {
      lease.fail(error);
      publicUnknown(owner, operationId, known.get(documentKey)?.settled ? "Kết quả đã lưu trên thiết bị. Tải lại để xác minh và khôi phục."
        : "Chưa lưu được xác nhận trên thiết bị; tiếp tục giữ khóa. Chọn thử lại lưu cục bộ, không gửi lại chứng từ.");
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
      owners.set(documentKey, owner.identity);
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
  async function inspect(value: DraftRecord): Promise<boolean> {
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
      const negatives = operations.filter(operation => operation.state === "NOT_EXECUTED");
      if (negatives.some(operation => operation.state === "NOT_EXECUTED" && (operation.negative.draftSequence > record.localPersistSequence || operation.draftCheckpointEditRevision > record.editRevision))) return false;
      negativeLineages.set(documentKey, negatives);
      if (record.operationId === null) {
        if (unresolved.length !== 0) return false;
        const reviewRequired = negatives.length > 0 || operations.some(operation => operation.state === "REJECTED" && operation.rejection.code !== "ValidationError" && operation.rejection.draftSequence === record.localPersistSequence);
        validated.set(documentKey, { record: JSON.stringify(record), reviewRequired }); return true;
      }
      if (unresolved.length !== 1 || !sourceMatches(record, unresolved[0])) return false;
      validated.set(documentKey, { record: JSON.stringify(record), operation: unresolved[0] }); return true;
    } catch { return false; }
  }
  async function refreshNegativeLineage(record: DraftRecord, isCurrent: () => boolean): Promise<boolean> {
    const documentKey = key(record.feature, record.localDocumentId), lineage = negativeLineages.get(documentKey) ?? [];
    if (!lineage.length) return active() && isCurrent();
    // An explicit recheck replaces its earlier session authority. A denial or
    // unavailable read must not leave an older certificate usable for editing.
    for (const operation of lineage) negativeAdmission.revoke(operation);
    const live = session(record.feature, record.localDocumentId), identity = owners.get(documentKey);
    if (live && identity && sameActorScope(scope, live) && live.generation === identity.generation) {
      const id = record.localDocumentId, change = { writeReviewRequired: true };
      if (record.feature === "sales") workspace.store.setState(previous => previous.sessions[id] === live ? { sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], ...change } } } : previous);
      else receipt.store.setState(previous => previous.sessions[id] === live ? { sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], ...change } } } : previous);
    }
    const revision = authorityRevision, controller = new AbortController();
    let refreshedAuthority = false;
    reads.add(controller);
    const admitted = () => active() && revision === authorityRevision && !controller.signal.aborted && isCurrent() && lineage.every(originalGrant);
    try {
      if (!admitted()) return false;
      const refreshed: DurableOperationRecord[] = [];
      for (const operation of lineage) {
        const result = await resolutionPort.read(operation.frozen, { ...namespace, actorGeneration: scope.actorGeneration, signal: controller.signal }, admitted);
        if (!admitted() || result.kind !== "not-executed" || operation.state !== "NOT_EXECUTED" ||
          JSON.stringify(result.certificate) !== JSON.stringify(operation.negative.certificate)) return false;
        refreshed.push(operation);
      }
      const after = await repository.findForDraft(record);
      if (!admitted() || after.quarantined) return false;
      const decoded = await Promise.all(after.operations.map(operation => decodeDurableOperationRecord(operation, { ...namespace, operationId: operation.operationId })));
      if (!admitted()) return false;
      const currentNegatives = decoded.filter(operation => operation.state === "NOT_EXECUTED");
      if (JSON.stringify(currentNegatives) !== JSON.stringify(lineage)) return false;
      for (const operation of refreshed) negativeAdmission.admit(operation, () => active() && revision === authorityRevision && originalGrant(operation));
      refreshedAuthority = true;
      return true;
    } catch { return false; }
    finally {
      if (!refreshedAuthority) for (const operation of lineage) negativeAdmission.revoke(operation);
      reads.delete(controller);
    }
  }
  async function inspectRecord(record: DraftRecord): Promise<void> { await inspect(record); }
  async function validateRestore(record: DraftRecord): Promise<boolean> {
    if (!await inspect(record) || !canReviewRecord(record)) return false;
    // Legacy pending restore remains entirely local and protected. Negative
    // lineage is never made editable from its persisted certificate alone.
    if (record.unresolvedOperation) return true;
    const bytes = JSON.stringify(record);
    return refreshNegativeLineage(record, () => validated.get(key(record.feature, record.localDocumentId))?.record === bytes && canReviewRecord(record));
  }
  function validateAdoption(value: DraftRecord): boolean {
    try {
      const record = decodeDraftRecord(value, { ...namespace, feature: value.feature, localDocumentId: value.localDocumentId });
      if (!active() || validated.get(key(record.feature, record.localDocumentId))?.record !== JSON.stringify(record) || !canReviewRecord(record)) return false;
      return record.unresolvedOperation || (negativeLineages.get(key(record.feature, record.localDocumentId)) ?? [])
        .every(operation => originalGrant(operation) && negativeAdmission.allows(operation));
    } catch { return false; }
  }
  function bindRestored(record: DraftRecord, id: string): void {
    const admitted = validated.get(key(record.feature, record.localDocumentId));
    if (!active() || id !== record.localDocumentId || record.actorKey !== scope.actorKey || record.deploymentEpoch !== scope.deploymentEpoch) return;
    const live = session(record.feature, id);
    if (!live || !sameActorScope(scope, live) || live.editRevision !== record.editRevision || (live.localRecovery?.operationId ?? null) !== record.operationId) return;
    // Restore publishes synchronously. A store subscriber can invalidate the
    // inspection cache during that publication; retain the negative review lock
    // before returning, and never grant an unbound session write admission.
    if (admitted?.reviewRequired || negativeLineages.get(key(record.feature, id))?.length) {
      const change = { writeReviewRequired: true, feedback: "Cần đọc và xác nhận phiên bản máy chủ trước khi ghi tiếp." };
      if (record.feature === "sales") workspace.store.setState(previous => previous.sessions[id] === live ? { sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], ...change } } } : previous);
      else receipt.store.setState(previous => previous.sessions[id] === live ? { sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], ...change } } } : previous);
    }
    if (!admitted || !validateAdoption(record) || session(record.feature, id)?.generation !== live.generation) return;
    owners.set(key(record.feature, id), { ...scope, module: record.feature, sessionId: id, generation: live.generation, editRevision: live.editRevision });
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
    owners.set(key(record.feature, id), { ...scope, module: record.feature, sessionId: id, generation: live.generation, editRevision: live.editRevision });
    publish(record.feature, id, { checking: false, operationId: operation.operationId, message: "Đã khôi phục thao tác chưa rõ kết quả; cần kiểm tra kết quả. Không tự gửi lại." });
  }
  async function checkResult(feature: DocumentModule, id: string, localOnly = false, resolution = false): Promise<void> {
    const live = session(feature, id), operationId = live?.localRecovery?.operationId;
    const documentKey = key(feature, id);
    const admission = recoveryInfo(feature, id);
    if (!admission || !live || !operationId || !live.mutationKind || pending.has(documentKey) || (localOnly && !admission.localRetry)) return;
    const controller = new AbortController();
    const context = { ...namespace, actorGeneration: scope.actorGeneration, signal: controller.signal, document: { localDocumentId: id, generation: live.generation, editRevision: live.editRevision } };
    const owner = ownerFor(feature, context, live.mutationKind);
    if (!owner || !current(owner, operationId)) return;
    pending.add(documentKey);
    reads.add(controller);
    publish(feature, id, { checking: true, operationId, message: localOnly ? "Đang lưu kết quả trên thiết bị…" : "Đang kiểm tra kết quả thao tác…" });
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
      if (cached?.checkpoint.operation.operationId === operationId && cached.checkpoint.operation.frozen.requestFingerprint === operation.frozen.requestFingerprint && cached.negative) {
        await resolveNegative(owner, lease, checkpoint, cached.negative); return;
      }
      let proof = cached?.checkpoint.operation.operationId === operationId && cached.checkpoint.operation.frozen.requestFingerprint === operation.frozen.requestFingerprint ? cached.proof : undefined;
      if (!proof) {
        if (localOnly) return;
        let status = resolution ? await resolutionPort.read(operation.frozen, context, () => current(owner, operationId)) : await statusPort.read(operation.frozen, context, () => current(owner, operationId));
        if (!current(owner, operationId)) return;
        if (status.kind === "not-executed") { await resolveNegative(owner, lease, checkpoint, status.certificate); return; }
        // Additive old-host compatibility: only explicit unsupported-extension
        // discovery permits the unchanged protected positive v1 read.
        if (status.kind === "unknown" && status.reason === "unsupported-host") status = await statusPort.read(operation.frozen, context, () => current(owner, operationId));
        if (!current(owner, operationId)) return;
        if (status.kind !== "committed") { publicUnknown(owner, operationId,
          status.reason === "result-expired" || status.reason === "result-unavailable" ? "Máy chủ đã ghi nhận thao tác nhưng kết quả gốc không còn dùng được. Giữ khóa và liên hệ người phụ trách; không tạo lại chứng từ."
            : "Chưa có bằng chứng đã hoàn tất; tiếp tục giữ khóa. Không tự gửi lại.", status.correlationId); return; }
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
  async function checkResolution(feature: DocumentModule, id: string): Promise<void> {
    const live = session(feature, id), documentKey = key(feature, id);
    if (live?.localRecovery) { await checkResult(feature, id, false, true); return; }
    const lineage = negativeLineages.get(documentKey), identity = owners.get(documentKey);
    if (!live || !identity || !lineage?.length || pending.has(documentKey) || !canReviewLiveRecord(feature, id)) return;
    const cached = known.get(documentKey)?.settled?.draft, inspected = validated.get(documentKey);
    const record: DraftRecord | undefined = cached ?? (inspected ? decodeDraftRecord(JSON.parse(inspected.record)) : undefined);
    if (!record) return;
    const currentSession = () => {
      const latest = session(feature, id);
      return !!latest && active() && sameActorScope(latest, identity) && latest.generation === identity.generation &&
        latest.editRevision === live.editRevision && latest.baseline === live.baseline && latest.draft === live.draft && !latest.localRecovery && canReviewLiveRecord(feature, id);
    };
    pending.add(documentKey);
    publish(feature, id, { checking: true, operationId: lineage[lineage.length - 1].operationId, message: "Đang xác minh lại xác nhận máy chủ…" });
    try {
      const fresh = await refreshNegativeLineage(record, currentSession);
      if (fresh && currentSession()) owners.set(documentKey, { ...identity, editRevision: live.editRevision });
      if (currentSession()) publish(feature, id, { checking: false, operationId: lineage[lineage.length - 1].operationId,
        message: fresh ? "Đã xác minh xác nhận máy chủ; cần xem lại trước khi tạo thao tác mới." : "Chưa xác minh được xác nhận máy chủ; tiếp tục giữ khóa." });
    } finally {
      pending.delete(documentKey);
      const previous = state.getState().documents[documentKey];
      if (previous?.checking) publish(feature, id, { ...previous, checking: false });
    }
  }
  const unsubscribeAuthority = auth.subscribe?.(() => {
    const revoked = !active() || [...known.values()].some(item => !originalGrant(item.checkpoint.operation)) ||
      [...negativeLineages.values()].some(lineage => lineage.some(operation => !originalGrant(operation)));
    if (!revoked) return;
    authorityRevision++; negativeAdmission.clear(); reads.forEach(controller => controller.abort());
    for (const [documentKey, item] of known) if (item.negative) known.set(documentKey, { ...item, negative: undefined });
    for (const lineage of negativeLineages.values()) {
      const operation = lineage[0]; if (!operation) continue;
      const live = session(operation.feature, operation.localDocumentId);
      if (!live || !sameActorScope(scope, live)) continue;
      const id = operation.localDocumentId, change = { writeReviewRequired: true };
      if (operation.feature === "sales") workspace.store.setState(previous => ({ sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], ...change } } }));
      else receipt.store.setState(previous => ({ sessions: { ...previous.sessions, [id]: { ...previous.sessions[id], ...change } } }));
    }
  });
  return {
    state, inspectRecord, validateRestore, validateAdoption, bindRestored, checkResult, checkResolution, recoveryInfo, canReviewFeature, canReviewRecord,
    canReviewLiveRecord, negativeReviewInfo, canReviewNegativeBaseline, confirmCreateReintent,
    retryLocalResult: (feature: DocumentModule, id: string) => checkResult(feature, id, true),
    saveSales: (snapshot: SalesSaveSnapshot, context: PortContext) => write("sales", "save", () => salesSaveOperationRequest(snapshot), context) as Promise<WriteResult<SalesDocument>>,
    postSales: (input: { saleId: string; expectedVersion: string }, context: PortContext) => write("sales", "post", () => salesPostOperationRequest(input), context) as Promise<WriteResult<PostAcknowledgement>>,
    saveReceipt: (snapshot: GoodsReceiptSaveSnapshot, context: PortContext) => write("goods-receipt", "save", () => receiptSaveOperationRequest(snapshot), context) as Promise<WriteResult<GoodsReceiptDocument>>,
    postReceipt: (input: { receiptId: string; expectedVersion: string }, context: PortContext) => write("goods-receipt", "post", () => receiptPostOperationRequest(input), context) as Promise<WriteResult<GoodsReceiptPostAcknowledgement>>,
    dispose() { disposed = true; unsubscribeAuthority?.(); negativeAdmission.clear(); reads.forEach(controller => controller.abort()); reads.clear(); validated.clear(); negativeLineages.clear(); known.clear(); owners.clear(); state.setState({ documents: {} }); repository.close(); },
  };
}
export type Web4MutationRuntime = ReturnType<typeof createWeb4MutationRuntime>;
