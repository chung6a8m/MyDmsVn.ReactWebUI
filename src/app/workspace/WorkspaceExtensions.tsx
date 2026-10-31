import { createContext, useContext, type ComponentType, type ReactNode } from "react";
import type { IDockviewPanelProps } from "dockview";

// Optional development tools are supplied by the Lab composition, never imported
// by the production workspace or document components.
export interface WorkspaceExtensions {
  toolbar?: ReactNode;
  lookupHarness?: ComponentType<{
    sessionId: string;
    api: IDockviewPanelProps["api"];
  }>;
}
export const WorkspaceExtensionsContext = createContext<WorkspaceExtensions>({});
export const useWorkspaceExtensions = () => useContext(WorkspaceExtensionsContext);
