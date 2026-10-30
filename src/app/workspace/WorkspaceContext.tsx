import { createContext, useContext, useState, type ReactNode } from "react";
import { createWorkspaceRuntime, type WorkspaceRuntime } from "./panelRegistry";
const WorkspaceContext = createContext<WorkspaceRuntime | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace] = useState(() => createWorkspaceRuntime());
  return (
    <WorkspaceContext.Provider value={workspace}>
      {children}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("WorkspaceProvider is required");
  return workspace;
}
