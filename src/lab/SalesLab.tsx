import { EditingHarnessControls } from "./EditingHarnessControls";
import { useSearch } from "@tanstack/react-router";
import { FoundationWorkspace } from "../features/sales/FoundationWorkspace";
import { CloseHarnessControls } from "./CloseHarnessControls";
export function SalesLab() {
  const { scenario } = useSearch({ from: "/lab/sales" });
  return (
    <>
      <p className="px-4 py-2">
        Sales Lab · Sales pilot sẽ được triển khai ở WEB-06.
      </p>
      <p className="px-4 pb-2">Scenario: {scenario}</p>
      <CloseHarnessControls />
      <EditingHarnessControls />
      <FoundationWorkspace scenario={scenario} />
    </>
  );
}
