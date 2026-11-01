import type { QueryClient, QueryFilters } from "@tanstack/react-query";
import { sameActorScope, type ActorScope } from "../../app/workspace/documentContracts";
interface SavedStock { warehouseId: string; lines: readonly { productId: string | null }[] }
interface PostSession extends ActorScope {
  generation: number;
  baseline: { status: string; saved: SavedStock } | null;
  postAcknowledgement?: unknown;
}
// Observe authoritative positive transitions only. Never write session or stock data.
export function observeInventoryPosts<S extends PostSession>(client: QueryClient, store: {
  getState(): { sessions: Record<string, S> };
  subscribe(listener: (state: { sessions: Record<string, S> }, previous: { sessions: Record<string, S> }) => void): () => void;
}, isCurrentScope: (scope: ActorScope) => boolean) {
  let disposed = false;
  const unsubscribe = store.subscribe((state, previous) => {
    for (const [id, session] of Object.entries(state.sessions)) {
      const before = previous.sessions[id];
      if (!before || before.generation !== session.generation || !sameActorScope(before, session) || !isCurrentScope(session)) continue;
      const wasPosted = !!before.postAcknowledgement || before.baseline?.status === "Posted";
      const posted = !!session.postAcknowledgement || session.baseline?.status === "Posted";
      if (wasPosted || !posted) continue;
      // Ack may precede a failed detail read: the saved pre-Post baseline remains authoritative.
      const saved = session.baseline?.saved ?? before.baseline?.saved;
      if (!saved) continue;
      const products = new Set(saved.lines.map(line => line.productId).filter(Boolean));
      const filters: QueryFilters = { predicate(query) {
        if (disposed || !isCurrentScope(session)) return false;
        const [namespace, actorKey, generation, kind, filters, deploymentEpoch] = query.queryKey;
        if (namespace !== "inventory" || actorKey !== session.actorKey || generation !== session.actorGeneration || deploymentEpoch !== session.deploymentEpoch || (kind !== "balances" && kind !== "stock-card") || !filters || typeof filters !== "object") return false;
        const value = filters as { warehouseId?: string; productId?: string };
        return (!value.warehouseId || value.warehouseId === saved.warehouseId) && (!value.productId || products.has(value.productId));
      } };
      // Initial reads have no cached data: invalidation alone deduplicates them.
      // Cancel first so a pre-Post response cannot become the current stock data.
      const cancelled = client.cancelQueries(filters);
      void client.invalidateQueries({ ...filters, refetchType: "none" });
      void cancelled.then(() => {
        if (!disposed && isCurrentScope(session)) return client.refetchQueries({ ...filters, type: "active" });
      });
    }
  });
  return () => { disposed = true; unsubscribe(); };
}
