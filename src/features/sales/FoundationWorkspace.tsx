import { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DockviewDefaultTab, DockviewReact } from "dockview-react";
import {
  themeDark,
  themeLight,
  type IDockviewPanelHeaderProps,
} from "dockview";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
} from "ag-grid-community";
import { useTheme } from "../../app/theme";
import {
  createFakeCatalogPort,
  type FoundationScenario,
} from "../../infrastructure/fake/fakeCatalogPort";
import type { LookupOption } from "./contracts";

ModuleRegistry.registerModules([AllCommunityModule]);
const ScenarioContext = createContext<FoundationScenario>("default");
const columns: ColDef<LookupOption>[] = [
  { field: "code", headerName: "Mã sản phẩm", width: 160 },
  { field: "name", headerName: "Sản phẩm", flex: 1, minWidth: 220 },
  { field: "unit", headerName: "Đơn vị tính", width: 140 },
];
const emptyRows: LookupOption[] = [];
function CatalogGrid() {
  const scenario = useContext(ScenarioContext);
  const port = useMemo(() => createFakeCatalogPort(scenario), [scenario]);
  // Fake actor identity is captured in both the cache key and request context.
  const actorKey = "foundation-demo";
  const actorGeneration = 1;
  const query = useQuery({
    queryKey: ["catalog", actorKey, actorGeneration, scenario, "product"],
    queryFn: async ({ signal }) => {
      const result = await port.search(
        { kind: "product", search: "", limit: 25 },
        { actorKey, actorGeneration, signal },
      );
      if (result.kind === "failed") throw new Error(result.error.message);
      return [...result.value];
    },
  });
  if (query.isError) return <p role="alert">{query.error.message}</p>;
  return (
    <div className="h-full min-h-0" data-testid="foundation-grid">
      <AgGridReact<LookupOption>
        theme={themeQuartz}
        columnDefs={columns}
        rowData={query.data ?? emptyRows}
        loading={query.isPending}
        getRowId={({ data }) => data.id}
      />
    </div>
  );
}

const components = { catalog: CatalogGrid };
function FoundationTab(props: IDockviewPanelHeaderProps) {
  // This read-only integration panel has no document session or close command.
  // WEB-03 replaces this with admitted document close behavior.
  return (
    <DockviewDefaultTab {...props} hideClose closeActionOverride={() => {}} />
  );
}

export function FoundationWorkspace({
  scenario = "default",
}: {
  scenario?: FoundationScenario;
}) {
  const { mode } = useTheme();
  return (
    <ScenarioContext.Provider value={scenario}>
      <div className="min-h-0 flex-1" aria-label="Workspace mẫu">
        <DockviewReact
          components={components}
          theme={mode === "dark" ? themeDark : themeLight}
          defaultTabComponent={FoundationTab}
          disableFloatingGroups
          disableDnd
          getTabContextMenuItems={() => []}
          onReady={({ api }) => {
            api.addPanel({
              id: "foundation-catalog",
              component: "catalog",
              title: "Danh mục mẫu",
              renderer: "always",
            });
          }}
        />
      </div>
    </ScenarioContext.Provider>
  );
}
