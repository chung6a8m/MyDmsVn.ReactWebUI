import { createWorkspaceRuntime, type WorkspaceRuntime } from "../../app/workspace/panelRegistry";
import type { LayoutStorage } from "../../app/workspace/workspaceLayouts";
import type { SalesPort } from "../../ports/salesPort";
import { createFakeSalesPort } from "../../infrastructure/fake/fakeSalesPort";
import { createFakeCatalogPort } from "../../infrastructure/fake/fakeCatalogPort";
import { createScenarioController } from "../../infrastructure/fake/scenarioController";
export function createLabWorkspaceRuntime(
  read?: SalesPort["get"],
  initialActor = { actorKey: "workspace-demo", actorGeneration: 1 },
  storage?: LayoutStorage | null,
) {
  const scenarios = createScenarioController();
  const fake = createFakeSalesPort(scenarios);
  let workspace: WorkspaceRuntime | undefined;
  workspace = createWorkspaceRuntime({
    sales: read ? { ...fake, get: read } : fake,
    catalog: createFakeCatalogPort(),
    auth: {
      getSnapshot: () => ({
        ...(workspace ? workspace.portContext() : initialActor),
        capabilities: scenarios.state.getState().capabilities,
      }),
      subscribe: (listener) => scenarios.state.subscribe(listener),
    },
    today: () => "2026-10-31",
    storage: storage === undefined ? browserStorage() : storage,
  });
  workspace.connectAuth();
  return { ...workspace, scenarios };
}
function browserStorage(): LayoutStorage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}
export type LabWorkspaceRuntime = ReturnType<typeof createLabWorkspaceRuntime>;
