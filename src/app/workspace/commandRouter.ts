import type { ActorScope, DocumentIdentity } from "./documentContracts";
import type { DocumentFeatureAdapter, WorkspacePanel } from "./featurePanels";
// Commands capture feature ownership; read-only activation never falls back to Sales.
export function createCommandRouter(deps: {
  panel(id: string): WorkspacePanel | undefined;
  active(): string | null;
  activate(id: string | null): void;
  feature(module: string): DocumentFeatureAdapter | undefined;
  isCurrentScope(scope: ActorScope): boolean;
}) {
  return {
    activate(id: string | null) { deps.activate(id); },
    capture(): DocumentIdentity | null {
      const id = deps.active();
      const panel = id ? deps.panel(id) : undefined;
      if (!panel || panel.kind !== "document" || !panel.ready || !deps.isCurrentScope(panel)) return null;
      return deps.feature(panel.module)?.getAdapter(panel.id)?.captureIdentity() ?? null;
    },
    mark(identity: DocumentIdentity) {
      if (!deps.isCurrentScope(identity)) return false;
      return deps.feature(identity.module)?.mark(identity) ?? false;
    },
  };
}
