import { createStore } from "zustand/vanilla";
import type {
  SaveOutcome,
  SalesDocument,
} from "../../features/sales/contracts";
import type { SaveExecutor } from "../../features/sales/salesCommands";
export type CloseSaveMode =
  "success" | "failure" | "deferred" | "outcome-unknown";
export function createCloseSaveHarness() {
  const state = createStore<{
    mode: CloseSaveMode;
    pending: { sessionId: string; title: string }[];
  }>(() => ({ mode: "success", pending: [] }));
  const deferred = new Map<
    string,
    { resolve: (outcome: SaveOutcome) => void; document: SalesDocument }
  >();
  let version = 0;
  function result(
    mode: Exclude<CloseSaveMode, "deferred">,
    document: SalesDocument,
  ): SaveOutcome {
    if (mode === "failure")
      return {
        kind: "failed",
        error: {
          kind: "unavailable",
          code: "harness-failed",
          message: "Save stub thất bại; bản nháp vẫn được giữ.",
        },
      };
    if (mode === "outcome-unknown") return { kind: "outcome-unknown" };
    const saved = structuredClone(document);
    saved.version = `close-harness-${++version}`;
    saved.saved.expectedVersion = saved.version;
    return { kind: "saved", document: saved };
  }
  const execute: SaveExecutor = async (identity, document) => {
    const mode = state.getState().mode;
    if (mode !== "deferred") return result(mode, document);
    return new Promise((resolve) => {
      deferred.set(identity.sessionId, { resolve, document });
      state.setState((current) => ({
        pending: [
          ...current.pending,
          { sessionId: identity.sessionId, title: document.saleNumber },
        ],
      }));
    });
  };
  return {
    state,
    execute,
    setMode(mode: CloseSaveMode) {
      state.setState({ mode });
    },
    complete(id: string, mode: Exclude<CloseSaveMode, "deferred">) {
      const item = deferred.get(id);
      if (!item) return;
      deferred.delete(id);
      state.setState((current) => ({
        pending: current.pending.filter((item) => item.sessionId !== id),
      }));
      item.resolve(result(mode, item.document));
    },
  };
}
