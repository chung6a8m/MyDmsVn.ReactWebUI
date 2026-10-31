import { useEffect } from "react";
import { useWorkspace } from "../app/workspace/WorkspaceContext";
import { EditingHarnessControls } from "./EditingHarnessControls";
import { useSearch } from "@tanstack/react-router";
import { SalesWorkspace } from "../features/sales/SalesWorkspace";
import { SalesScenarioControls } from "./SalesScenarioControls";
export function SalesLab() {
  const { scenario } = useSearch({ from: "/lab/sales" });
  const workspace = useWorkspace();
  useEffect(
    () =>
      workspace.scenarios.setMode(
        scenario === "default" ? "success" : scenario,
      ),
    [workspace, scenario],
  );
  return (
    <>
      <p className="px-4 py-2">
        Sales Lab · Create / Save / Post và recovery qua fake ports.
      </p>
      <p className="px-4 pb-2">Scenario: {scenario}</p>
      <SalesScenarioControls />
      <EditingHarnessControls />
      <SalesWorkspace />
    </>
  );
}
