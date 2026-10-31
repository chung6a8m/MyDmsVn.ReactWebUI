import { vi } from "vitest";
import type {
  RuntimeDependencies,
  RuntimeAuthSnapshot,
} from "../../../src/app/runtime/runtimeDependencies";
import type { SalesPort } from "../../../src/ports/salesPort";
import type { CatalogPort } from "../../../src/ports/catalogPort";
import { createWorkspaceDocument } from "../../../src/infrastructure/fake/workspaceFixtures";

export function injectedRuntimeFixture() {
  let snapshot: RuntimeAuthSnapshot = {
    actorKey: "authenticated-user-42/session-A",
    actorGeneration: 7,
    capabilities: { read: true, write: true, post: false },
  };
  const listeners = new Set<() => void>();
  const auth = {
    getSnapshot: () => snapshot,
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }),
  };
  const sales: SalesPort = {
    list: vi.fn(async () => ({
      kind: "success" as const,
      value: { items: [], nextCursor: null, previousCursor: null },
    })),
    get: vi.fn(async (id) => ({ kind: "success" as const, value: createWorkspaceDocument(id) })),
    save: vi.fn(async () => ({ kind: "outcome-unknown" as const })),
    post: vi.fn(async () => ({ kind: "outcome-unknown" as const })),
  };
  const catalog: CatalogPort = { search: vi.fn(async () => ({ kind: "success" as const, value: [] })) };
  const dependencies: RuntimeDependencies = {
    sales, catalog, auth, today: vi.fn(() => "2031-02-28"), storage: null,
  };
  return {
    dependencies, auth, sales, catalog,
    observerCount: () => listeners.size,
    publish(next: RuntimeAuthSnapshot) {
      snapshot = next;
      for (const listener of [...listeners]) listener();
    },
  };
}
