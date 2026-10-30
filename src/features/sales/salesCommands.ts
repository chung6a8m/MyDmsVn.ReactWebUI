import { lookupIssue } from "../../shared/lookup/lookupTypes";
import type { SalesDocument, SaveOutcome, ValidationIssue } from "./contracts";
import {
  identityMatches,
  type SalesSessionStore,
  type SessionIdentity,
} from "./salesSessionStore";
export type SaveExecutor = (
  identity: SessionIdentity,
  document: SalesDocument,
) => Promise<SaveOutcome>;
export function createSalesCommands(
  store: SalesSessionStore,
  execute: SaveExecutor,
) {
  const pending = new Map<string, Promise<SaveOutcome>>();
  return {
    requestSave(id: string): Promise<SaveOutcome> {
      const existing = pending.get(id);
      if (existing) return existing;
      const session = store.getState().sessions[id];
      if (!session || session.status !== "ready")
        return Promise.resolve({
          kind: "blocked",
          issues: [
            { code: "not-ready", field: "", message: "Phiên chưa sẵn sàng." },
          ],
        });
      if (session.mutation === "outcome-unknown")
        return Promise.resolve({ kind: "outcome-unknown" });
      if (session.mutation === "pending")
        return Promise.resolve({
          kind: "blocked",
          issues: [{ code: "busy", field: "", message: "Đang lưu." }],
        });
      // WEB-03 exercises admission using a note-only stub. WEB-05 replaces this
      // preparation with the full editor barrier, decimal and field validation.
      const issues: ValidationIssue[] = [];
      if (!session.baseline)
        issues.push({
          code: "harness-existing-only",
          field: "",
          message: "Save stub chỉ hỗ trợ chứng từ mẫu đã đọc.",
        });
      for (const [field, value] of Object.entries(
        session.lookupBuffers ?? {},
      )) {
        const message =
          lookupIssue(value) ??
          "Lookup đã xác nhận; nối Sales draft/barrier ở WEB-05.";
        issues.push({ code: "lookup", field, message });
      }
      for (const [field, buffer] of Object.entries(session.rawBuffers)) {
        if (field.startsWith("product:")) continue;
        if (buffer.composing)
          issues.push({
            code: "composition",
            field,
            message: "Hoàn tất nhập liệu trước khi lưu.",
          });
        if (
          field !== "note" &&
          buffer.raw !==
            session.draft!.lines.find(
              (line) => field === `qty:${line.clientLineId}`,
            )?.qty
        )
          issues.push({
            code: "harness-raw-quantity",
            field,
            message:
              "Raw số lượng chưa được chuẩn hóa; khôi phục giá trị ban đầu hoặc bỏ thay đổi. Decimal/barrier thuộc WEB-05.",
          });
      }
      const note = session.rawBuffers.note?.raw ?? session.draft!.note;
      if (note.length > 1000 || note.includes("\0"))
        issues.push({
          code: "note",
          field: "note",
          message: "Ghi chú tối đa 1.000 ký tự và không chứa NUL.",
        });
      if (issues.length) return Promise.resolve({ kind: "blocked", issues });
      const { sessionId, generation, actorKey, actorGeneration } = session;
      const identity = { sessionId, generation, actorKey, actorGeneration };
      const revision = session.editRevision;
      const document = structuredClone(session.baseline!);
      document.saved = { ...structuredClone(session.draft!), note };
      store.setState((current) => ({
        sessions: {
          ...current.sessions,
          [id]: {
            ...session,
            mutation: "pending",
            mutationSnapshot: structuredClone(document.saved),
          },
        },
      }));
      const task = (async (): Promise<SaveOutcome> => {
        let result: SaveOutcome;
        try {
          result = await execute(identity, document);
        } catch {
          result = { kind: "outcome-unknown" };
        }
        const current = store.getState().sessions[id];
        if (!identityMatches(current, identity))
          return { kind: "outcome-unknown" };
        if (result.kind === "saved" && current.editRevision === revision) {
          store.setState((state) => ({
            sessions: {
              ...state.sessions,
              [id]: {
                ...current,
                baseline: structuredClone(result.document),
                draft: structuredClone(result.document.saved),
                rawBuffers: {},
                dirty: false,
                mutation: "idle",
                mutationSnapshot: undefined,
              },
            },
          }));
        } else {
          store.setState((state) => ({
            sessions: {
              ...state.sessions,
              [id]: {
                ...current,
                mutation:
                  result.kind === "outcome-unknown"
                    ? "outcome-unknown"
                    : "idle",
                mutationSnapshot:
                  result.kind === "outcome-unknown"
                    ? current.mutationSnapshot
                    : undefined,
              },
            },
          }));
        }
        return result;
      })();
      pending.set(id, task);
      void task.finally(() => {
        if (pending.get(id) === task) pending.delete(id);
      });
      return task;
    },
  };
}
