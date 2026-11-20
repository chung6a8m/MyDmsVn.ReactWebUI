import { createContext, useContext, type ComponentType, type ReactNode } from "react";
import type { IDockviewPanelProps } from "dockview";
import type { WorkspaceRuntime } from "./panelRegistry";

// Optional development tools are supplied by the Lab composition, never imported
// by the production workspace or document components.
export interface WorkspaceExtensions {
  toolbar?: ReactNode;
  // DEV-only diagnostic UI is injected by Lab, not imported by product features.
  salesDiagnostics?: ComponentType<{ sessionId: string; onFeedback: (message: string) => void }>;
  // Optional keyboard registration for Lab commands; product has no handler.
  onShortcut?: (event: KeyboardEvent, workspace: WorkspaceRuntime) => void;
  panelComponents?: import("./featurePanels").PanelComponents;
  lookupHarness?: ComponentType<{
    sessionId: string;
    api: IDockviewPanelProps["api"];
  }>;
}
export const WorkspaceExtensionsContext = createContext<WorkspaceExtensions>({});
export const useWorkspaceExtensions = () => useContext(WorkspaceExtensionsContext);
