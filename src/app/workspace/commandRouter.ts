import {
  identityMatches,
  type SalesSessionStore,
  type SessionIdentity,
} from "../../features/sales/salesSessionStore";

export function createCommandRouter(store: SalesSessionStore) {
  return {
    activate(sessionId: string | null) {
      if (sessionId && !store.getState().sessions[sessionId]) return;
      store.setState({ activeSessionId: sessionId });
    },
    capture(): SessionIdentity | null {
      const { activeSessionId, sessions } = store.getState();
      const session = activeSessionId ? sessions[activeSessionId] : undefined;
      if (!session || session.status !== "ready") return null;
      const { sessionId, generation, actorKey, actorGeneration } = session;
      return { sessionId, generation, actorKey, actorGeneration };
    },
    // An explicit edit-harness command, not Save/Post or mutation authority.
    mark(identity: SessionIdentity) {
      const session = store.getState().sessions[identity.sessionId];
      if (!identityMatches(session, identity)) return false;
      store.setState((state) => ({
        sessions: {
          ...state.sessions,
          [session.sessionId]: {
            ...session,
            commandCount: session.commandCount + 1,
          },
        },
      }));
      return true;
    },
  };
}
