import { createEditorBarrier } from "../../shared/grid/editorBarrier";
import { lineAmount, totalAmount } from "./decimal";
import type { SalesDocument, SaveOutcome } from "./contracts";
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
  barrier = createEditorBarrier(store),
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
      const { sessionId, generation, actorKey, actorGeneration } = session;
      const identity = { sessionId, generation, actorKey, actorGeneration };
      const task = (async (): Promise<SaveOutcome> => {
        const prepared = await barrier.prepareSave(id, true);
        if (prepared.kind === "blocked") return prepared;
        const live = store.getState().sessions[id];
        if (
          !identityMatches(live, identity) ||
          live.editRevision !== prepared.editRevision ||
          live.mutation !== "idle"
        )
          return {
            kind: "blocked",
            issues: [
              {
                code: "stale",
                field: "",
                message: "Snapshot không còn thuộc phiên hiện tại.",
              },
            ],
          };
        if (!live.baseline) {
          store.setState((s) => ({
            sessions: { ...s.sessions, [id]: { ...live, preparing: false } },
          }));
          return {
            kind: "blocked",
            issues: [
              {
                code: "stub-create",
                field: "",
                message:
                  "Snapshot sẵn sàng; lưu chứng từ mới thuộc fake port WEB-06.",
              },
            ],
          };
        }
        const revision = prepared.editRevision;
        const document = structuredClone(live.baseline);
        document.saved = structuredClone(prepared.snapshot);
        // Read labels are kept for the stub display, never business payload fields.
        for (const key of ["customer", "warehouse", "employee"] as const) {
          const v = live.lookupBuffers?.[`${key}Id`];
          if (v)
            document.references[key] = {
              id: v.selectedId!,
              name: v.displayText,
              code: "",
              isActive: true,
            };
        }
        document.lines = prepared.snapshot.lines.map((line) => {
          const old = live.baseline!.lines.find(
            (l) => l.clientLineId === line.clientLineId,
          );
          const v = live.lookupBuffers?.[`product:${line.clientLineId}`];
          return {
            ...line,
            product: v
              ? {
                  id: v.selectedId!,
                  name: v.displayText,
                  code: "",
                  isActive: true,
                }
              : (old?.product ?? {
                  id: line.productId!,
                  name: line.productId!,
                  code: "",
                  isActive: null,
                }),
            unit: old?.productId === line.productId ? old.unit : "",
            lineAmount: lineAmount(line.qty, line.unitPrice, line.isGift),
            costAmount: null,
          };
        });
        document.totalAmount = totalAmount(
          document.lines.map((l) => l.lineAmount),
        );
        store.setState((s) => ({
          sessions: {
            ...s.sessions,
            [id]: {
              ...live,
              preparing: false,
              mutation: "pending",
              mutationSnapshot: prepared.snapshot,
            },
          },
        }));
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
                lookupBuffers: {},
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
