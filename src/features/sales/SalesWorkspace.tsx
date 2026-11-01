import { SalesDocumentPanel } from "./SalesDocumentPanel";
const documentComponents = { sales: SalesDocumentPanel };
import { WorkspaceHost } from "../../app/workspace/WorkspaceHost";
import { SalesListPanel } from "./SalesListPanel";
export function SalesWorkspace() {
  return (
    <WorkspaceHost documentComponents={documentComponents}
      catalogComponent={SalesListPanel}
      catalogTitle="Danh sách Sales"
    />
  );
}
