import type { CatalogPort } from "../../ports/catalogPort";
import type { SalesPort } from "../../ports/salesPort";
import type { LayoutStorage } from "../workspace/workspaceLayouts";

export interface SalesCapabilities {
  readonly read: boolean;
  readonly write: boolean;
  readonly post: boolean;
}

export interface RuntimeAuthSnapshot {
  readonly actorKey: string;
  readonly actorGeneration: number;
  readonly capabilities: SalesCapabilities;
}

// Scope and UI capability hints come from composition. HTTP authorization remains server-owned.
export interface AuthSessionReader {
  getSnapshot(): RuntimeAuthSnapshot;
  subscribe(listener: () => void): () => void;
}

export interface RuntimeDependencies {
  sales: SalesPort;
  catalog: CatalogPort;
  auth: AuthSessionReader;
  today: () => string;
  storage: LayoutStorage | null;
}
