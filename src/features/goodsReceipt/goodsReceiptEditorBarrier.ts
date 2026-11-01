import { canEdit, identityMatches, sessionDirty, type GoodsReceiptSession, type GoodsReceiptSessionStore } from "./goodsReceiptSessionStore";
import type { GoodsReceiptSaveSnapshot } from "./contracts";
import type { ValidationIssue } from "../../ports/portContracts";
import { parseReceiptDecimal, validateGoodsReceipt } from "./validation";
import { lookupIssue, lookupKindForField } from "../../shared/lookup/lookupTypes";

export type PrepareSaveResult = { kind: "ready"; snapshot: GoodsReceiptSaveSnapshot; editRevision: number } | { kind: "blocked"; issues: ValidationIssue[] };
const blocked = (message: string): PrepareSaveResult => ({ kind: "blocked", issues: [{ code: "barrier", field: "", message }] });
function normalize(session: GoodsReceiptSession): PrepareSaveResult {
  const snapshot = structuredClone(session.draft!);
  const issues: ValidationIssue[] = [];
  for (const [field, buffer] of Object.entries(session.rawBuffers)) {
    if (buffer.composing) { issues.push({ code: "composition", field, message: "Hoàn tất nhập liệu trước khi lưu." }); continue; }
    if (session.lookupBuffers?.[field]) continue;
    if (field === "note" || field === "receiptDate") snapshot[field] = buffer.raw;
    else {
      const separator = field.indexOf(":"); const kind = field.slice(0, separator); const id = field.slice(separator + 1);
      const line = snapshot.lines.find(l => l.clientLineId === id);
      if (line && (kind === "quantity" || kind === "unitCost")) {
        try { line[kind] = parseReceiptDecimal(buffer.raw, kind); }
        catch (e) { issues.push({ code: "decimal", field, clientLineId: id, message: (e as Error).message }); }
      } else issues.push({ code: "unknown-field", field, message: "Buffer không thuộc chứng từ hiện tại." });
    }
  }
  for (const [field, value] of Object.entries(session.lookupBuffers ?? {})) {
    const message = lookupIssue(value, true, lookupKindForField(field));
    if (message) { issues.push({ code: "lookup", field, message }); continue; }
    if (field === "warehouseId" || field === "employeeId") snapshot[field] = value.selectedId!;
    else {
      const line = snapshot.lines.find(l => field === `product:${l.clientLineId}`);
      if (line) line.productId = value.selectedId;
      else issues.push({ code: "lookup-scope", field, message: "Lookup không thuộc dòng hiện tại." });
    }
  }
  issues.push(...validateGoodsReceipt(snapshot));
  if (issues.length) return { kind: "blocked", issues };
  for (const line of snapshot.lines) { line.quantity = parseReceiptDecimal(line.quantity, "quantity"); line.unitCost = parseReceiptDecimal(line.unitCost, "unitCost"); }
  return { kind: "ready", snapshot, editRevision: session.editRevision };
}
export function freezeSnapshot(snapshot: GoodsReceiptSaveSnapshot) {
  snapshot.lines.forEach(Object.freeze); Object.freeze(snapshot.lines); return Object.freeze(snapshot);
}
export function createGoodsReceiptEditorBarrier(store: GoodsReceiptSessionStore) {
  const pending = new Map<string, Promise<PrepareSaveResult>>();
  const editors = new Map<string, Set<() => Promise<void>>>();
  function prepare(id: string, hold: boolean, post: boolean): Promise<PrepareSaveResult> {
    const existing = pending.get(id); if (existing) return existing;
    const session = store.getState().sessions[id];
    const postReady = session?.status === "ready" && session.mutation === "idle" && !session.preparing && !session.postAcknowledgement && session.baseline?.status === "Draft" && session.capabilities?.post === true;
    if (!(post ? postReady : canEdit(session)) || !session.draft) return Promise.resolve(blocked("Phiên chưa sẵn sàng hoặc đang khóa."));
    const patchPreparing = (preparing: boolean) => store.setState(s => identityMatches(s.sessions[id], session) ? { sessions: { ...s.sessions, [id]: { ...s.sessions[id], preparing } } } : s);
    patchPreparing(true);
    const task = (async (): Promise<PrepareSaveResult> => {
      let ready = false;
      try {
        // Raw buffers are already published by editors. Flush even clean/Post-only documents.
        await Promise.all([...(editors.get(id) ?? [])].map(flush => flush()));
        const current = store.getState().sessions[id];
        if (!identityMatches(current, session) || current.editRevision !== session.editRevision || current.mutation !== "idle") return blocked("Phiên hoặc revision đã đổi trong lúc chuẩn bị.");
        const result = normalize(current);
        if (result.kind !== "ready") return result;
        const next = { ...current, draft: structuredClone(result.snapshot) };
        next.dirty = sessionDirty(next);
        if (post && next.dirty) return blocked("Post cần Draft đã lưu và sạch. Hãy lưu riêng trước khi Post.");
        ready = true;
        store.setState(s => ({ sessions: { ...s.sessions, [id]: { ...next, preparing: hold } } }));
        return { ...result, snapshot: freezeSnapshot(result.snapshot) };
      } catch (e) { return blocked(e instanceof Error ? e.message : "Không kết thúc được editor."); }
      finally { if (!ready || !hold) patchPreparing(false); }
    })();
    pending.set(id, task); void task.then(() => { if (pending.get(id) === task) pending.delete(id); });
    return task;
  }
  return {
    register(id: string, flush: () => Promise<void>) {
      const group = editors.get(id) ?? new Set(); group.add(flush); editors.set(id, group);
      return () => { group.delete(flush); if (!group.size) editors.delete(id); };
    },
    prepareSave: (id: string, holdForMutation = false) => prepare(id, holdForMutation, false),
    preparePost: (id: string, holdForMutation = false) => prepare(id, holdForMutation, true),
  };
}
