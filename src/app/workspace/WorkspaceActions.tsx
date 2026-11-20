import { useRef, useState } from "react";
import { ChevronDown, PanelsTopLeft } from "lucide-react";
import { useStore } from "zustand";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal,
  DropdownMenuPositioner, DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { sameActorScope, type ActorScope } from "./documentContracts";
import type { WorkspacePanel } from "./featurePanels";
import type { WorkspaceRuntime } from "./panelRegistry";
import { useWorkspace, useWorkspaceCloseReturnFocus } from "./WorkspaceContext";

type WorkspaceAction = "split" | "close" | "close-all" | "restore" | "reset";
type PanelTarget = Pick<WorkspacePanel, "id" | "module" | "kind" | "ready"> & ActorScope;
export interface WorkspaceActionTarget {
  scope: ActorScope;
  panel: PanelTarget | null;
}

// Snapshot on menu OPEN, not on item click: switching Dockview group, actor or
// session while the popup is open must never retarget a destructive command.
export function captureWorkspaceActionTarget(workspace: WorkspaceRuntime): WorkspaceActionTarget {
  const { activeId, panels } = workspace.panelState.getState();
  const current = activeId ? panels[activeId] : undefined;
  return {
    scope: workspace.portContext(),
    panel: current ? {
      id: current.id, module: current.module, kind: current.kind, ready: current.ready,
      actorKey: current.actorKey, actorGeneration: current.actorGeneration, deploymentEpoch: current.deploymentEpoch,
    } : null,
  };
}

export function admitWorkspaceAction(workspace: WorkspaceRuntime, captured: WorkspaceActionTarget, action: WorkspaceAction): boolean {
  if (!workspace.isCurrentScope(captured.scope) ||
      workspace.close.state.getState().busy || workspace.layouts.state.getState().busy) return false;
  if (action === "close-all" || action === "restore" || action === "reset") return true;
  const { activeId, panels } = workspace.panelState.getState();
  const original = captured.panel;
  const current = original && panels[original.id];
  return !!original?.ready && activeId === original.id && !!current?.ready &&
    current.id === original.id && current.module === original.module && current.kind === original.kind &&
    sameActorScope(original, captured.scope) && sameActorScope(current, original) &&
    workspace.isCurrentScope(current);
}

/** Product-only workspace commands. Lab retains its independent pilot toolbar. */
export function WorkspaceActions() {
  const workspace = useWorkspace();
  const closeReturnFocus = useWorkspaceCloseReturnFocus();
  const panels = useStore(workspace.panelState);
  const layoutBusy = useStore(workspace.layouts.state, state => state.busy);
  const closeBusy = useStore(workspace.close.state, state => state.busy);
  const [open, setOpen] = useState(false);
  const captured = useRef<WorkspaceActionTarget | null>(null);
  const dispatched = useRef(false);
  const active = panels.activeId ? panels.panels[panels.activeId] : undefined;
  const commandBusy = layoutBusy || closeBusy;
  const available = !!active?.ready && workspace.isCurrentScope(active);

  const execute = (action: WorkspaceAction) => {
    const target = captured.current;
    if (dispatched.current || !target || !admitWorkspaceAction(workspace, target, action)) return;
    dispatched.current = true; // One activation per menu opening (click, Enter or Space).
    switch (action) {
      case "split": workspace.splitActive(); break;
      case "close":
        if (target.panel) void workspace.closePanel(target.panel.id, "command");
        break;
      case "close-all": void workspace.close.closeAll("close-all"); break;
      case "restore": void workspace.layouts.restore(); break;
      case "reset": void workspace.layouts.reset(); break;
    }
  };
  const preventComposedRepeat = (event: React.KeyboardEvent) => {
    if ((event.nativeEvent.isComposing || event.repeat) &&
        (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={(next) => {
      if (next) {
        captured.current = captureWorkspaceActionTarget(workspace);
        dispatched.current = false;
      }
      setOpen(next);
    }}>
      <DropdownMenuTrigger render={
        <Button ref={closeReturnFocus} variant="outline" size="sm" aria-label="Tác vụ Workspace" disabled={commandBusy} />
      }>
        <PanelsTopLeft aria-hidden="true" /> Tác vụ Workspace <ChevronDown aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPositioner sideOffset={5} align="start">
          <DropdownMenuContent onKeyDown={preventComposedRepeat}>
            <DropdownMenuItem disabled={commandBusy || !available} onClick={() => execute("split")}>Tách sang phải</DropdownMenuItem>
            <DropdownMenuItem disabled={commandBusy || !available} onClick={() => execute("close")}>
              {active?.kind === "document" ? "Đóng tài liệu" : "Đóng tab hiện tại"}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={commandBusy} onClick={() => execute("close-all")}>Đóng tất cả</DropdownMenuItem>
            <div role="separator" className="my-1 h-px bg-border" />
            <DropdownMenuItem disabled={commandBusy} onClick={() => execute("restore")}>Khôi phục bố cục</DropdownMenuItem>
            <DropdownMenuItem disabled={commandBusy} onClick={() => execute("reset")}>Đặt lại bố cục</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPositioner>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
