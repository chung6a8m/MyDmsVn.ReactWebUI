import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { WorkspaceRuntime } from "./panelRegistry";
import { CloseDocumentDialog } from "./CloseDocumentDialog";
const WorkspaceContext = createContext<WorkspaceRuntime | null>(null);
export function WorkspaceProvider({
  workspace,
  children,
}: {
  workspace: WorkspaceRuntime;
  children: ReactNode;
}) {
  useEffect(() => workspace.connectAuth(), [workspace]);
  return (
    <WorkspaceContext.Provider value={workspace}>
      {children}
      <CloseDocumentDialog />
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("WorkspaceProvider is required");
  return workspace;
}
