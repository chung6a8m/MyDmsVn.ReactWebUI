import {
  canEdit,
  identityMatches,
  sessionDirty,
  type SalesSessionStore,
  type SessionIdentity,
} from "./salesSessionStore";
import type { SalesSaveSnapshot } from "./contracts";
export function editDraft(
  store: SalesSessionStore,
  identity: SessionIdentity,
  change: (draft: SalesSaveSnapshot) => SalesSaveSnapshot,
) {
  const session = store.getState().sessions[identity.sessionId];
  if (!identityMatches(session, identity) || !canEdit(session)) return false;
  const next = {
    ...session,
    draft: change(structuredClone(session.draft!)),
    editRevision: session.editRevision + 1,
  };
  next.dirty = sessionDirty(next);
  store.setState((s) => ({
    sessions: { ...s.sessions, [identity.sessionId]: next },
  }));
  return true;
}
export function restoreRaw(
  store: SalesSessionStore,
  identity: SessionIdentity,
  field: string,
  buffer: { raw: string; composing: boolean } | undefined,
) {
  const session = store.getState().sessions[identity.sessionId];
  if (!identityMatches(session, identity) || !canEdit(session)) return;
  const rawBuffers = { ...session.rawBuffers };
  if (buffer) rawBuffers[field] = buffer;
  else delete rawBuffers[field];
  const next = {
    ...session,
    rawBuffers,
    editRevision: session.editRevision + 1,
  };
  next.dirty = sessionDirty(next);
  store.setState((s) => ({
    sessions: { ...s.sessions, [identity.sessionId]: next },
  }));
}
