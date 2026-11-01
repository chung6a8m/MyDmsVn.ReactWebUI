import {
  canEdit,
  identityMatches,
  sessionDirty,
  type GoodsReceiptSessionStore,
  type SessionIdentity,
} from "./goodsReceiptSessionStore";
import type { GoodsReceiptSaveSnapshot } from "./contracts";
import { restoreSelection, type LookupValue } from "../../shared/lookup/lookupTypes";
function update(store: GoodsReceiptSessionStore, identity: SessionIdentity, change: (session: import("./goodsReceiptSessionStore").GoodsReceiptSession) => import("./goodsReceiptSessionStore").GoodsReceiptSession) {
  const session = store.getState().sessions[identity.sessionId];
  if (!identityMatches(session, identity) || !canEdit(session)) return false;
  const next = change(session);
  next.editRevision = session.editRevision + 1;
  next.dirty = sessionDirty(next);
  store.setState(s => ({ sessions: { ...s.sessions, [identity.sessionId]: next } }));
  return true;
}
export function writeRaw(store: GoodsReceiptSessionStore, identity: SessionIdentity, field: string, raw: string, composing = false) {
  return update(store, identity, s => ({ ...s, rawBuffers: { ...s.rawBuffers, [field]: { raw, composing } } }));
}
export function writeLookup(store: GoodsReceiptSessionStore, identity: SessionIdentity, field: string, value: LookupValue) {
  return update(store, identity, s => ({ ...s, lookupBuffers: { ...s.lookupBuffers, [field]: { ...value } } }));
}
export function restoreLookup(store: GoodsReceiptSessionStore, identity: SessionIdentity, field: string, original?: LookupValue) {
  const s = store.getState().sessions[identity.sessionId];
  const value = original ?? s?.lookupBuffers?.[field];
  return value ? writeLookup(store, identity, field, restoreSelection(value)) : false;
}
export function addLine(store: GoodsReceiptSessionStore, identity: SessionIdentity): string | undefined {
  const s = store.getState().sessions[identity.sessionId];
  if (!s?.draft || s.draft.lines.length >= 200) return;
  const id = crypto.randomUUID();
  return editDraft(store, identity, draft => ({ ...draft, lines: [...draft.lines, { clientLineId: id, receiptLineId: null, productId: null, quantity: "1.0000", unitCost: "0.0000" }] })) ? id : undefined;
}
export function removeLine(store: GoodsReceiptSessionStore, identity: SessionIdentity, clientLineId: string) {
  return update(store, identity, s => {
    const belongs = (field: string) => ["product", "quantity", "unitCost"].some(kind => field === `${kind}:${clientLineId}`);
    return { ...s, draft: { ...s.draft!, lines: s.draft!.lines.filter(line => line.clientLineId !== clientLineId) },
      rawBuffers: Object.fromEntries(Object.entries(s.rawBuffers).filter(([key]) => !belongs(key))),
      lookupBuffers: Object.fromEntries(Object.entries(s.lookupBuffers ?? {}).filter(([key]) => !belongs(key))) };
  });
}
export function editDraft(
  store: GoodsReceiptSessionStore,
  identity: SessionIdentity,
  change: (draft: GoodsReceiptSaveSnapshot) => GoodsReceiptSaveSnapshot,
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
  store: GoodsReceiptSessionStore,
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
