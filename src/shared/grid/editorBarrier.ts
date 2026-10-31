import {
  canEdit,
  identityMatches,
  sessionDirty,
  type SalesSessionStore,
  type SalesSession,
} from "../../features/sales/salesSessionStore";
import type {
  PrepareSaveResult,
  ValidationIssue,
  SalesSaveSnapshot,
} from "../../features/sales/contracts";
import { parseDecimal } from "../../features/sales/decimal";
import { validateSales } from "../../features/sales/validation";
import { lookupIssue, lookupKindForField } from "../lookup/lookupTypes";
function normalize(session: SalesSession): PrepareSaveResult {
  const snapshot = structuredClone(session.draft!);
  const issues: ValidationIssue[] = [];
  for (const [field, buffer] of Object.entries(session.rawBuffers)) {
    if (buffer.composing) {
      issues.push({
        code: "composition",
        field,
        message: "Hoàn tất nhập liệu trước khi lưu.",
      });
      continue;
    }
    if (session.lookupBuffers?.[field]) continue;
    if (field === "note" || field === "saleDate") snapshot[field] = buffer.raw;
    else {
      const [kind, id] = field.split(":");
      const line = snapshot.lines.find((l) => l.clientLineId === id);
      if (line && (kind === "qty" || kind === "unitPrice"))
        try {
          line[kind] = parseDecimal(buffer.raw, kind);
        } catch (e) {
          issues.push({
            code: "decimal",
            field,
            clientLineId: id,
            message: (e as Error).message,
          });
        }
      else
        issues.push({
          code: "unknown-field",
          field,
          message: "Buffer không thuộc trường chứng từ hiện tại.",
        });
    }
  }
  for (const [field, value] of Object.entries(session.lookupBuffers ?? {})) {
    const error = lookupIssue(value, true, lookupKindForField(field));
    if (error) {
      issues.push({ code: "lookup", field, message: error });
      continue;
    }
    if (
      field === "customerId" ||
      field === "warehouseId" ||
      field === "employeeId"
    )
      snapshot[field] = value.selectedId!;
    else {
      const line = snapshot.lines.find(
        (l) => field === `product:${l.clientLineId}`,
      );
      if (line) line.productId = value.selectedId;
      else
        issues.push({
          code: "lookup-scope",
          field,
          message: "Lookup harness chưa thuộc dòng chứng từ.",
        });
    }
  }
  issues.push(...validateSales(snapshot));
  if (issues.length) return { kind: "blocked", issues };
  // Canonical inputs can also come from adapters without a mounted editor.
  for (const line of snapshot.lines) {
    line.qty = parseDecimal(line.qty, "qty");
    line.unitPrice = parseDecimal(line.unitPrice, "unitPrice");
  }
  return { kind: "ready", snapshot, editRevision: session.editRevision };
}
function freeze(snapshot: SalesSaveSnapshot) {
  snapshot.lines.forEach(Object.freeze);
  Object.freeze(snapshot.lines);
  return Object.freeze(snapshot);
}
export function createEditorBarrier(store: SalesSessionStore) {
  const pending = new Map<string, Promise<PrepareSaveResult>>();
  const editors = new Map<string, Set<() => Promise<void>>>();
  return {
    register(id: string, flush: () => Promise<void>) {
      let group = editors.get(id);
      if (!group) {
        group = new Set();
        editors.set(id, group);
      }
      group.add(flush);
      return () => {
        group!.delete(flush);
        if (!group!.size) editors.delete(id);
      };
    },
    prepareSave(
      id: string,
      holdForMutation = false,
    ): Promise<PrepareSaveResult> {
      const existing = pending.get(id);
      if (existing) return existing;
      const session = store.getState().sessions[id];
      const blocked = (message: string): PrepareSaveResult => ({
        kind: "blocked",
        issues: [{ code: "barrier", field: "", message }],
      });
      if (!canEdit(session) || !session.draft)
        return Promise.resolve(blocked("Phiên chưa sẵn sàng hoặc đang khóa."));
      store.setState((s) => ({
        sessions: { ...s.sessions, [id]: { ...session, preparing: true } },
      }));
      const task = (async (): Promise<PrepareSaveResult> => {
        try {
          const first = normalize(session);
          if (first.kind === "blocked") return first;
          await Promise.all(
            [...(editors.get(id) ?? [])].map((flush) => flush()),
          );
          const current = store.getState().sessions[id];
          if (
            !identityMatches(current, session) ||
            current.editRevision !== session.editRevision ||
            current.mutation !== "idle"
          )
            return blocked("Phiên hoặc revision đã đổi trong lúc chuẩn bị.");
          const result = normalize(current);
          if (result.kind !== "ready") return result;
          const next = { ...current, draft: structuredClone(result.snapshot) };
          next.dirty = sessionDirty(next);
          store.setState((s) => ({
            sessions: {
              ...s.sessions,
              [id]: { ...next, preparing: holdForMutation },
            },
          }));
          return { ...result, snapshot: freeze(result.snapshot) };
        } catch (error) {
          return blocked(
            error instanceof Error
              ? error.message
              : "Không kết thúc được editor.",
          );
        } finally {
          const current = store.getState().sessions[id];
          if (
            identityMatches(current, session) &&
            current.preparing &&
            !holdForMutation
          )
            store.setState((s) => ({
              sessions: {
                ...s.sessions,
                [id]: { ...current, preparing: false },
              },
            }));
        }
      })();
      pending.set(id, task);
      void task.then((result) => {
        pending.delete(id);
        if (result.kind === "blocked") {
          const current = store.getState().sessions[id];
          if (identityMatches(current, session) && current.preparing)
            store.setState((s) => ({
              sessions: {
                ...s.sessions,
                [id]: { ...current, preparing: false },
              },
            }));
        }
      });
      return task;
    },
  };
}
