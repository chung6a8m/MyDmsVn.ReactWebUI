import { canEdit, identityMatches, sessionDirty, type SalesSessionStore, type SessionIdentity } from "../features/sales/salesSessionStore";

// Explicit Lab replacement: discard buffers only for lines being replaced.
// Header edits and unrelated buffers retain their existing validation semantics.
export function seedEditingFixture(store: SalesSessionStore, identity: SessionIdentity) {
  const session = store.getState().sessions[identity.sessionId];
  if (!identityMatches(session, identity) || !canEdit(session) || !session.draft?.lines.length) return false;
  const removed = new Set(session.draft.lines.flatMap((line) =>
    ["qty", "unitPrice", "product"].map((field) => `${field}:${line.clientLineId}`)));
  const next = {
    ...session,
    draft: { ...session.draft, lines: Array.from({ length: 200 }, () => ({
      ...session.draft!.lines[0], clientLineId: crypto.randomUUID(), saleLineId: null,
    })) },
    rawBuffers: Object.fromEntries(Object.entries(session.rawBuffers).filter(([field]) => !removed.has(field))),
    lookupBuffers: Object.fromEntries(Object.entries(session.lookupBuffers ?? {}).filter(([field]) => !removed.has(field))),
    editRevision: session.editRevision + 1,
  };
  next.dirty = sessionDirty(next);
  store.setState((s) => ({ sessions: { ...s.sessions, [identity.sessionId]: next } }));
  return true;
}
