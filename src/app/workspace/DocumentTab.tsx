import { useRef } from "react";
import { DockviewDefaultTab } from "dockview-react";
import type { IDockviewPanelHeaderProps } from "dockview";
import { useWorkspace } from "./WorkspaceContext";

export function DocumentTab(props: IDockviewPanelHeaderProps) {
  const workspace = useWorkspace();
  const reason = useRef<"tab" | "middle-click">("tab");
  const isDocument = typeof props.params.sessionId === "string";
  return (
    <DockviewDefaultTab
      {...props}
      hideClose={false}
      data-workspace-panel-id={props.api.id}
      data-document-session-id={isDocument ? props.params.sessionId : undefined}
      onPointerDownCapture={(event) => {
        reason.current = event.button === 1 ? "middle-click" : "tab";
      }}
      closeActionOverride={() => {
        void workspace.closePanel(
            props.api.id,
            reason.current,
          );
        reason.current = "tab";
      }}
    />
  );
}
