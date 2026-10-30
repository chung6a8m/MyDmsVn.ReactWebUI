import {
  identityMatches,
  canEdit,
  sessionDirty,
  type SalesSessionStore,
  type SessionIdentity,
} from "../../features/sales/salesSessionStore";
import { emptyLookup, type LookupValue } from "./lookupTypes";
export function restoreLookup(
  store: SalesSessionStore,
  identity: SessionIdentity,
  field: string,
  value: LookupValue | undefined,
) {
  const session = store.getState().sessions[identity.sessionId];
  if (!identityMatches(session, identity) || !canEdit(session)) return false;
  // WEB-04 publishes lookup intent/raw immediately. WEB-05 consumes confirmed
  // selections into the full Sales draft with its editor barrier.
  const rawBuffers = { ...session.rawBuffers };
  const lookupBuffers = { ...session.lookupBuffers };
  if (value === undefined) {
    delete rawBuffers[field];
    delete lookupBuffers[field];
  } else {
    rawBuffers[field] = { raw: value.query, composing: value.composing };
    lookupBuffers[field] = value;
  }
  const dirty = sessionDirty({ ...session, rawBuffers, lookupBuffers });
  store.setState((state) => ({
    sessions: {
      ...state.sessions,
      [identity.sessionId]: {
        ...session,
        lookupBuffers,
        rawBuffers,
        dirty,
        editRevision: session.editRevision + 1,
      },
    },
  }));
  return true;
}
export function readLookup(
  store: SalesSessionStore,
  id: string,
  field: string,
) {
  return store.getState().sessions[id]?.lookupBuffers?.[field] ?? emptyLookup;
}

export function publishLookup(
  store: SalesSessionStore,
  identity: SessionIdentity,
  field: string,
  value: LookupValue,
) {
  return restoreLookup(store, identity, field, value);
}
