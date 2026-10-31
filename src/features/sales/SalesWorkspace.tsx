import { WorkspaceHost } from "../../app/workspace/WorkspaceHost";
import { SalesListPanel } from "./SalesListPanel";
export function SalesWorkspace() {
  return (
    <WorkspaceHost
      catalogComponent={SalesListPanel}
      catalogTitle="Danh sách Sales"
    />
  );
}
