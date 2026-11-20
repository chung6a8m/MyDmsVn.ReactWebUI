import { useStore } from "zustand";
import { Button } from "../components/ui/button";
import { useWorkspace } from "../app/workspace/WorkspaceContext";
import type { WorkspaceRuntime } from "../app/workspace/panelRegistry";

// Registered only by LabProvider. WorkspaceHost owns Ctrl+Alt+W for both modes.
export function markLabShortcut(event: KeyboardEvent, workspace: WorkspaceRuntime) {
  if (event.code !== "KeyM") return;
  const captured = workspace.commands.capture();
  if (!captured) return;
  event.preventDefault();
  workspace.commands.mark(captured);
}

export function WorkspaceDiagnostics() {
  const workspace = useWorkspace();
  const target = useStore(workspace.panelState, (state) =>
    state.activeId ? state.panels[state.activeId] : undefined,
  );
  return (
    <Button
      variant="outline"
      disabled={!target?.ready || target.kind !== "document"}
      onClick={() => {
        const captured = workspace.commands.capture();
        if (captured) workspace.commands.mark(captured);
      }}
    >
      Đánh dấu phiên
    </Button>
  );
}
