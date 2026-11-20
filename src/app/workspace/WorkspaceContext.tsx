import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from "react";
import type { WorkspaceRuntime } from "./panelRegistry";
import { CloseDocumentDialog } from "./CloseDocumentDialog";
const WorkspaceContext = createContext<WorkspaceRuntime | null>(null);
const WorkspaceCloseReturnFocusContext = createContext<RefObject<HTMLButtonElement | null> | null>(null);
export function WorkspaceProvider({
  workspace,
  children,
}: {
  workspace: WorkspaceRuntime;
  children: ReactNode;
}) {
  useEffect(() => workspace.connectAuth(), [workspace]);
  const closeReturnFocus = useRef<HTMLButtonElement | null>(null);
  return (
    <WorkspaceContext.Provider value={workspace}>
      <WorkspaceCloseReturnFocusContext.Provider value={closeReturnFocus}>
        {children}
        <CloseDocumentDialog />
      </WorkspaceCloseReturnFocusContext.Provider>
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("WorkspaceProvider is required");
  return workspace;
}
export function useWorkspaceCloseReturnFocus() {
  const focus = useContext(WorkspaceCloseReturnFocusContext);
  if (!focus) throw new Error("WorkspaceProvider is required");
  return focus;
}
