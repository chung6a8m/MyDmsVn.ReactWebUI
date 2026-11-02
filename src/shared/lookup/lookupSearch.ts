import { createStore } from "zustand/vanilla";
import type { CatalogPort } from "../../ports/catalogPort";
import type { LookupOption } from "../../features/sales/contracts";
import type { LookupScope } from "./lookupTypes";
export function createLookupSearch(port: CatalogPort) {
  const state = createStore<{
    options: readonly LookupOption[];
    status: "idle" | "loading" | "ready" | "error";
    error: string;
    key: string;
    generation: number;
  }>(() => ({
    options: [],
    status: "idle",
    error: "",
    key: "",
    generation: 0,
  }));
  let generation = 0;
  let controller: AbortController | undefined;
  function invalidate() {
    controller?.abort();
    generation++;
    state.setState({
      options: [],
      status: "idle",
      error: "",
      key: "",
      generation,
    });
  }
  return {
    state,
    invalidate,
    async search(scope: LookupScope, query: string) {
      invalidate();
      const current = ++generation;
      controller = new AbortController();
      const key = lookupRequestKey(scope, query);
      state.setState({ status: "loading", key, generation: current });
      try {
        const result = await port.search(
          { kind: scope.catalogKind ?? "product", search: query, limit: 25 },
          {
            actorKey: scope.actorKey,
            actorGeneration: scope.actorGeneration,
            deploymentEpoch: scope.deploymentEpoch,
            signal: controller.signal,
          },
        );
        if (current !== generation) return;
        state.setState(
          result.kind === "success"
            ? {
                options: result.value.filter((o) => o.isActive),
                status: "ready",
              }
            : { status: "error", error: result.error.message },
        );
      } catch (error) {
        if (current === generation)
          state.setState({
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "Không đọc được danh mục.",
          });
      }
    },
  };
}
export function lookupRequestKey(scope: LookupScope, query: string) {
  return JSON.stringify([
    scope.sessionId,
    scope.generation,
    scope.actorKey,
    scope.actorGeneration,
    scope.clientLineId,
    scope.catalogContext,
    scope.catalogKind ?? "product",
    query,
    scope.deploymentEpoch,
  ]);
}
