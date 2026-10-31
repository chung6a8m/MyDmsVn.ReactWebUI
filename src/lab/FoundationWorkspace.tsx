import { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
} from "ag-grid-community";
import { WorkspaceHost } from "../app/workspace/WorkspaceHost";
import {
  createFakeCatalogPort,
  type FoundationScenario,
} from "../infrastructure/fake/fakeCatalogPort";
import type { LookupOption } from "../features/sales/contracts";

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

export function FoundationWorkspace({
  scenario = "default",
}: {
  scenario?: FoundationScenario;
}) {
  return (
    <ScenarioContext.Provider value={scenario}>
      <WorkspaceHost catalogComponent={CatalogGrid} />
    </ScenarioContext.Provider>
  );
}
