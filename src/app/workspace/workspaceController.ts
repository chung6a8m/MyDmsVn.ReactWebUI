import { createStore } from "zustand/vanilla";
import {
  sameActorScope, sameDocumentIdentity,
  type ActorScope, type CloseIssue, type CloseReason, type CloseSaveResult,
  type DocumentCloseAdapter, type DocumentIdentity, type DocumentRegistry,
} from "./documentContracts";

export type CloseResult = "closed" | "cancelled" | "blocked";
export type CloseChoice = "save" | "discard" | "cancel";
interface Decision extends DocumentIdentity {
  reason: CloseReason;
  title: string;
}
export function createWorkspaceController(deps: DocumentRegistry & {
  scope(): ActorScope;
  isCurrentScope(scope: ActorScope): boolean;
  finalisePanels?(scope: ActorScope): boolean;
}) {
  const state = createStore<{
    decisions: Decision[];
    feedback: Record<string, string>;
    issues: Record<string, readonly CloseIssue[]>;
    busy: boolean;
  }>(() => ({ decisions: [], feedback: {}, issues: {}, busy: false }));
  const intents = new Map<string, {
    identity: Decision;
    promise: Promise<CloseResult>;
    resolve: (result: CloseResult) => void;
    processing: boolean;
  }>();
  let closingAll: Promise<CloseResult> | undefined;

  function current(identity: DocumentIdentity): DocumentCloseAdapter | undefined {
    if (!deps.isCurrentScope(identity) || !sameActorScope(deps.scope(), identity)) return;
    const adapter = deps.getAdapter(identity.sessionId);
    return adapter && sameDocumentIdentity(adapter.captureIdentity(), identity) ? adapter : undefined;
  }
  function publishFeedback(id: string, adapter: DocumentCloseAdapter, fallback?: string) {
    const result = adapter.closeFeedback?.();
    const message = result?.message ?? fallback;
    state.setState((value) => ({
      feedback: message ? { ...value.feedback, [id]: message } : value.feedback,
      issues: result?.issues ? { ...value.issues, [id]: result.issues } : value.issues,
    }));
  }
  function blocked(id: string, adapter: DocumentCloseAdapter) {
    if (!adapter.isCloseBlocked()) return false;
    adapter.reportBlocked?.();
    publishFeedback(id, adapter, "Tài liệu chưa thể đóng; cần hoàn tất lưu hoặc đối soát.");
    return true;
  }
  function finish(id: string, result: CloseResult) {
    const intent = intents.get(id);
    intents.delete(id);
    state.setState((value) => {
      const feedback = { ...value.feedback };
      const issues = { ...value.issues };
      if (result === "closed") {
        delete feedback[id];
        delete issues[id];
      }
      return { decisions: value.decisions.filter((item) => item.sessionId !== id), feedback, issues };
    });
    intent?.resolve(result);
  }
  function finalise(identity: DocumentIdentity): CloseResult {
    const adapter = current(identity);
    if (!adapter || blocked(identity.sessionId, adapter) || !adapter.mayFinalise(identity)) return "blocked";
    return adapter.finaliseAfterAdmission(identity) ? "closed" : "blocked";
  }
  function requestClose(id: string, reason: CloseReason): Promise<CloseResult> {
    const existing = intents.get(id);
    if (existing) {
      const live = current(existing.identity);
      if (live) blocked(id, live);
      return existing.promise;
    }
    const adapter = deps.getAdapter(id);
    if (!adapter) return Promise.resolve("closed");
    // Capture revision as well as ownership before displaying a confirmation.
    const identity: Decision = { ...adapter.captureIdentity(), reason, title: adapter.title() };
    if (!current(identity) || blocked(id, adapter)) return Promise.resolve("blocked");
    if (!adapter.isDirtyIncludingRaw()) return Promise.resolve(finalise(identity));
    let resolve!: (result: CloseResult) => void;
    const promise = new Promise<CloseResult>((done) => { resolve = done; });
    intents.set(id, { identity, promise, resolve, processing: false });
    state.setState((value) => ({ decisions: [...value.decisions, identity] }));
    return promise;
  }

  return {
    state,
    requestClose,
    acknowledgeIssues(id: string, issues: readonly CloseIssue[]) {
      if (state.getState().issues[id] !== issues) return;
      state.setState((value) => {
        const remaining = { ...value.issues };
        delete remaining[id];
        return { issues: remaining };
      });
    },
    closeAll(reason: CloseReason): Promise<CloseResult> {
      if (closingAll) return closingAll;
      const scope = { ...deps.scope() };
      if (!deps.isCurrentScope(scope)) return Promise.resolve("blocked");
      // Entry points observe busy synchronously, before any confirmation await.
      state.setState({ busy: true });
      const identities = deps.documents(scope).map((adapter) => adapter.captureIdentity());
      const operation = (async (): Promise<CloseResult> => {
        for (const identity of identities) {
          if (!deps.isCurrentScope(scope) || !sameActorScope(deps.scope(), scope)) return "blocked";
          const adapter = deps.getAdapter(identity.sessionId);
          if (!adapter) continue; // Already admitted by an individual close.
          if (!current(identity)) return "blocked";
          const result = await requestClose(identity.sessionId, reason);
          if (result !== "closed") return result;
        }
        if (!deps.isCurrentScope(scope) || !sameActorScope(deps.scope(), scope) || deps.documents(scope).length) return "blocked";
        // Simple panels close only after every document admits, under the same
        // synchronous entry lock. Cancel/block leaves their current state intact.
        if (deps.finalisePanels && !deps.finalisePanels(scope)) return "blocked";
        return deps.isCurrentScope(scope) && sameActorScope(deps.scope(), scope) &&
          deps.documents(scope).length === 0 ? "closed" : "blocked";
      })();
      closingAll = operation.finally(() => {
        closingAll = undefined;
        state.setState({ busy: false });
      });
      return closingAll;
    },
    async respond(id: string, choice: CloseChoice) {
      const intent = intents.get(id);
      if (!intent || intent.processing) return;
      if (choice === "cancel") {
        finish(id, "cancelled");
        return;
      }
      const adapter = current(intent.identity);
      if (!adapter || blocked(id, adapter)) {
        finish(id, "blocked");
        return;
      }
      if (choice === "discard") {
        finish(id, finalise(intent.identity));
        return;
      }
      intent.processing = true;
      state.setState((value) => ({ decisions: value.decisions.filter((item) => item.sessionId !== id) }));
      let outcome: CloseSaveResult;
      try {
        outcome = await adapter.prepareAndSave(intent.identity);
      } catch {
        // The feature owns mutation uncertainty; never alter its store here.
        outcome = "failed";
      }
      const live = current(intent.identity);
      if (!live) {
        finish(id, "blocked");
        return;
      }
      if (outcome === "saved-clean" && !live.isDirtyIncludingRaw()) {
        finish(id, finalise(intent.identity));
        return;
      }
      publishFeedback(id, live, "Chưa thể đóng tài liệu; giữ nguyên phiên để kiểm tra.");
      finish(id, "blocked");
    },
  };
}
