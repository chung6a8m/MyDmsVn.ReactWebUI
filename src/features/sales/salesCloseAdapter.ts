import { salesPanelTitle } from "./salesPanelTitle";
import {
  sameActorScope, sameDocumentIdentity,
  type ActorScope, type DocumentCloseAdapter, type DocumentIdentity, type CloseSaveResult,
} from "../../app/workspace/documentContracts";
import type { SaveOutcome, ValidationIssue } from "./contracts";
import { identityMatches, sessionDirty, type SalesSessionStore } from "./salesSessionStore";
import type { LocalDraftHooks } from "../../app/workspace/featurePanels";

// Only the feature translates command outcomes and writes business state.
export function createSalesCloseRegistry(deps: {
  store: SalesSessionStore;
  save(id: string): Promise<SaveOutcome>;
  finalise(id: string): boolean;
  scope(): ActorScope;
  isCurrentScope(scope: ActorScope): boolean;
  localDraftHooks?(): LocalDraftHooks | undefined;
}) {
  const adapters = new Map<string, DocumentCloseAdapter>();
  function getAdapter(id: string): DocumentCloseAdapter | undefined {
    if (!deps.store.getState().sessions[id]) {
      adapters.delete(id);
      return;
    }
    const cached = adapters.get(id);
    if (cached) return cached;
    let feedback: { message?: string; issues?: readonly ValidationIssue[] } = {};
    function setFeedback(identity: DocumentIdentity, message: string, issues?: readonly ValidationIssue[]) {
      feedback = { message, issues };
      deps.store.setState((state) => {
        const session = state.sessions[id];
        return identityMatches(session, identity) && deps.isCurrentScope(identity)
          ? { sessions: { ...state.sessions, [id]: { ...session, feedback: message, ...(issues ? { issues } : {}) } } }
          : state;
      });
    }
    const adapter: DocumentCloseAdapter = {
      captureIdentity() {
        const { sessionId, generation, actorKey, actorGeneration, deploymentEpoch, editRevision } = deps.store.getState().sessions[id];
        return { sessionId, module: "sales", generation, actorKey, actorGeneration, deploymentEpoch, editRevision };
      },
      title() {
        const session = deps.store.getState().sessions[id];
        return salesPanelTitle(session);
      },
      isCloseBlocked() {
        const session = deps.store.getState().sessions[id];
        return !session || !!session.preparing || session.mutation !== "idle";
      },
      isDirtyIncludingRaw() {
        const session = deps.store.getState().sessions[id];
        return !!session && (session.dirty || sessionDirty(session));
      },
      mayFinalise(identity) {
        return !!deps.store.getState().sessions[id] && !adapter.isCloseBlocked() &&
          sameDocumentIdentity(adapter.captureIdentity(), identity) &&
          sameActorScope(deps.scope(), identity) && deps.isCurrentScope(identity);
      },
      finaliseAfterAdmission(identity) {
        if (!adapter.mayFinalise(identity)) return false;
        const finalise = () => {
          if (!adapter.mayFinalise(identity)) return false;
          const result = deps.finalise(id);
          if (result) adapters.delete(id);
          return result;
        };
        const hooks = deps.localDraftHooks?.();
        if (!hooks) return finalise();
        return (async () => {
          let removed = false;
          try { removed = await hooks.beforeClose(identity, () => adapter.mayFinalise(identity)); } catch { /* Keep the RAM owner and allow explicit local retry. */ }
          if (!adapter.mayFinalise(identity)) return false;
          if (!removed) {
            setFeedback(identity, "Chưa xóa được bản nháp trên thiết bị; giữ phiên để thử lại.");
            return false;
          }
          return finalise();
        })();
      },
      reportBlocked() {
        const session = deps.store.getState().sessions[id];
        if (!session) return;
        setFeedback(adapter.captureIdentity(), session.mutation === "outcome-unknown"
          ? "Kết quả lưu chưa rõ; cần đối soát trước khi đóng hoặc bỏ thay đổi."
          : "Đang lưu; chưa thể đóng hoặc bỏ thay đổi.");
      },
      closeFeedback: () => feedback,
      async prepareAndSave(identity): Promise<CloseSaveResult> {
        if (!adapter.mayFinalise(identity)) return "blocked";
        feedback = {};
        let outcome: SaveOutcome;
        try {
          outcome = await deps.save(id);
        } catch {
          outcome = { kind: "outcome-unknown" };
        }
        const live = deps.store.getState().sessions[id];
        if (!identityMatches(live, identity) || !deps.isCurrentScope(identity)) return "blocked";
        if (outcome.kind === "outcome-unknown") {
          deps.store.setState((state) => ({ sessions: { ...state.sessions, [id]: { ...state.sessions[id], mutation: "outcome-unknown" } } }));
          setFeedback(identity, "Kết quả lưu chưa rõ; giữ nguyên phiên để đối soát.");
          return "unknown";
        }
        if (outcome.kind === "saved" && adapter.mayFinalise(identity) && !adapter.isDirtyIncludingRaw()) return "saved-clean";
        if (outcome.kind === "blocked") {
          setFeedback(identity, outcome.issues.map((issue) => issue.message).join(" "), outcome.issues);
          return "blocked";
        }
        if (outcome.kind === "failed") {
          setFeedback(identity, outcome.error.message);
          return "failed";
        }
        setFeedback(identity, "Có thay đổi mới sau snapshot; tài liệu vẫn mở.");
        return "blocked";
      },
    };
    adapters.set(id, adapter);
    return adapter;
  }
  return {
    scope: deps.scope,
    isCurrentScope: deps.isCurrentScope,
    getAdapter,
    documents(scope: ActorScope) {
      return Object.values(deps.store.getState().sessions)
        .filter((session) => sameActorScope(session, scope))
        .map((session) => getAdapter(session.sessionId)!);
    },
  };
}
