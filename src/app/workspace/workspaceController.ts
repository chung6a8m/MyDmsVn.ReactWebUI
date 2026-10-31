import { createStore } from "zustand/vanilla";
import type {
  CloseReason,
  SaveOutcome,
  ValidationIssue,
} from "../../features/sales/contracts";
import {
  identityMatches,
  type SalesSessionStore,
  type SessionIdentity,
} from "../../features/sales/salesSessionStore";

export type CloseResult = "closed" | "cancelled" | "blocked";
export type CloseChoice = "save" | "discard" | "cancel";
interface Decision extends SessionIdentity {
  reason: CloseReason;
  title: string;
}
export function createWorkspaceController(deps: {
  store: SalesSessionStore;
  save: (id: string) => Promise<SaveOutcome>;
  finalise: (id: string) => boolean;
}) {
  const state = createStore<{
    decisions: Decision[];
    feedback: Record<string, string>;
    issues: Record<string, ValidationIssue[]>;
  }>(() => ({ decisions: [], feedback: {}, issues: {} }));
  const intents = new Map<
    string,
    {
      identity: Decision;
      promise: Promise<CloseResult>;
      resolve: (result: CloseResult) => void;
      processing: boolean;
    }
  >();
  let closingAll: Promise<CloseResult> | undefined;
  function feedback(id: string, message: string) {
    state.setState((current) => ({
      feedback: { ...current.feedback, [id]: message },
    }));
  }
  function busy(id: string) {
    const session = deps.store.getState().sessions[id];
    if (!session || session.mutation === "idle") return false;
    feedback(
      id,
      session.mutation === "pending"
        ? "Đang lưu; chưa thể đóng hoặc bỏ thay đổi."
        : "Kết quả lưu chưa rõ; cần đối soát trước khi đóng hoặc bỏ thay đổi.",
    );
    return true;
  }
  function finish(id: string, result: CloseResult) {
    const intent = intents.get(id);
    intents.delete(id);
    state.setState((current) => {
      const nextFeedback = { ...current.feedback };
      const issues = { ...current.issues };
      if (result === "closed") {
        delete nextFeedback[id];
        delete issues[id];
      }
      return {
        decisions: current.decisions.filter((item) => item.sessionId !== id),
        feedback: nextFeedback,
        issues,
      };
    });
    intent?.resolve(result);
  }
  function finalise(identity: SessionIdentity): CloseResult {
    const session = deps.store.getState().sessions[identity.sessionId];
    if (!identityMatches(session, identity) || busy(identity.sessionId))
      return "blocked";
    return deps.finalise(identity.sessionId) ? "closed" : "blocked";
  }
  function requestClose(id: string, reason: CloseReason): Promise<CloseResult> {
    const session = deps.store.getState().sessions[id];
    if (!session) return Promise.resolve("closed");
    const existing = intents.get(id);
    if (existing) {
      busy(id);
      return existing.promise;
    }
    if (busy(id)) return Promise.resolve("blocked");
    const identity: Decision = {
      sessionId: id,
      generation: session.generation,
      actorKey: session.actorKey,
      actorGeneration: session.actorGeneration,
      reason,
      title: session.saleId ? `Sales ${session.saleId}` : "Sales mới",
    };
    if (!session.dirty) return Promise.resolve(finalise(identity));
    let resolve!: (result: CloseResult) => void;
    const promise = new Promise<CloseResult>((done) => {
      resolve = done;
    });
    intents.set(id, { identity, promise, resolve, processing: false });
    state.setState((current) => ({
      decisions: [...current.decisions, identity],
    }));
    return promise;
  }
  return {
    state,
    requestClose,
    acknowledgeIssues(id: string, issues: ValidationIssue[]) {
      if (state.getState().issues[id] !== issues) return;
      state.setState((value) => {
        const remaining = { ...value.issues };
        delete remaining[id];
        return { issues: remaining };
      });
    },
    closeAll(reason: CloseReason): Promise<CloseResult> {
      if (closingAll) return closingAll;
      const identities = Object.values(deps.store.getState().sessions).map(
        ({ sessionId, generation, actorKey, actorGeneration }) => ({
          sessionId,
          generation,
          actorKey,
          actorGeneration,
        }),
      );
      closingAll = (async () => {
        for (const identity of identities) {
          const current = deps.store.getState().sessions[identity.sessionId];
          if (!current) continue;
          if (!identityMatches(current, identity)) return "blocked";
          const result = await requestClose(identity.sessionId, reason);
          if (result !== "closed") return result;
        }
        return "closed";
      })();
      const result = closingAll;
      void result.finally(() => {
        if (closingAll === result) closingAll = undefined;
      });
      return result;
    },
    async respond(id: string, choice: CloseChoice) {
      const intent = intents.get(id);
      if (!intent || intent.processing) return;
      if (choice === "cancel") {
        finish(id, "cancelled");
        return;
      }
      const session = deps.store.getState().sessions[id];
      if (!identityMatches(session, intent.identity) || busy(id)) {
        finish(id, "blocked");
        return;
      }
      if (choice === "discard") {
        finish(id, finalise(intent.identity));
        return;
      }
      intent.processing = true;
      const revision = session.editRevision;
      // Close the decision UI while save runs, so other documents and explicit
      // fake scenario controls stay usable. The intent remains deduplicated.
      state.setState((current) => ({
        decisions: current.decisions.filter((item) => item.sessionId !== id),
      }));
      let outcome: SaveOutcome;
      try {
        outcome = await deps.save(id);
      } catch {
        if (
          identityMatches(deps.store.getState().sessions[id], intent.identity)
        )
          deps.store.setState((current) => ({
            sessions: {
              ...current.sessions,
              [id]: { ...current.sessions[id], mutation: "outcome-unknown" },
            },
          }));
        outcome = { kind: "outcome-unknown" };
      }
      const current = deps.store.getState().sessions[id];
      if (!identityMatches(current, intent.identity)) {
        finish(id, "blocked");
        return;
      }
      if (
        outcome.kind === "outcome-unknown" &&
        current.mutation !== "outcome-unknown"
      )
        deps.store.setState((value) => ({
          sessions: {
            ...value.sessions,
            [id]: { ...current, mutation: "outcome-unknown" },
          },
        }));
      if (
        outcome.kind === "saved" &&
        current.editRevision === revision &&
        !current.dirty &&
        current.mutation === "idle"
      ) {
        finish(id, finalise(intent.identity));
        return;
      }
      if (outcome.kind === "blocked")
        state.setState((value) => ({
          issues: { ...value.issues, [id]: outcome.issues },
        }));
      feedback(
        id,
        outcome.kind === "failed"
          ? outcome.error.message
          : outcome.kind === "blocked"
            ? outcome.issues.map((issue) => issue.message).join(" ")
            : outcome.kind === "outcome-unknown"
              ? "Kết quả lưu chưa rõ; giữ nguyên phiên để đối soát."
              : "Có thay đổi mới sau snapshot; tài liệu vẫn mở.",
      );
      finish(id, "blocked");
    },
  };
}
