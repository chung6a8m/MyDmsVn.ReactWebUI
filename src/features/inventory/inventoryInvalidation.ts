import type { QueryClient } from "@tanstack/react-query";
import type { ActorScope } from "../../app/workspace/documentContracts";
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
  return store.subscribe((state, previous) => {
    for (const [id, session] of Object.entries(state.sessions)) {
      const before = previous.sessions[id];
      if (!before || before.generation !== session.generation || before.actorKey !== session.actorKey || before.actorGeneration !== session.actorGeneration || !isCurrentScope(session)) continue;
      const wasPosted = !!before.postAcknowledgement || before.baseline?.status === "Posted";
      const posted = !!session.postAcknowledgement || session.baseline?.status === "Posted";
      if (wasPosted || !posted) continue;
      // Ack may precede a failed detail read: the saved pre-Post baseline remains authoritative.
      const saved = session.baseline?.saved ?? before.baseline?.saved;
      if (!saved) continue;
      const products = new Set(saved.lines.map(line => line.productId).filter(Boolean));
      void client.invalidateQueries({ predicate(query) {
        const [namespace, actorKey, generation, kind, filters] = query.queryKey;
        if (namespace !== "inventory" || actorKey !== session.actorKey || generation !== session.actorGeneration || (kind !== "balances" && kind !== "stock-card") || !filters || typeof filters !== "object") return false;
        const value = filters as { warehouseId?: string; productId?: string };
        return (!value.warehouseId || value.warehouseId === saved.warehouseId) && (!value.productId || products.has(value.productId));
      } });
    }
  });
}
