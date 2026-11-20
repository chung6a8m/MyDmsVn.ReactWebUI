import { useRef } from "react";
import { useStore } from "zustand";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { useWorkspace, useWorkspaceCloseReturnFocus } from "./WorkspaceContext";
import type { CloseChoice } from "./workspaceController";

export function CloseDocumentDialog() {
  const workspace = useWorkspace();
  const workspaceMenuTrigger = useWorkspaceCloseReturnFocus();
  const decision = useStore(
    workspace.close.state,
    (state) => state.decisions[0],
  );
  const cancel = useRef<HTMLButtonElement>(null);
  if (!decision) return null;
  const id = decision.sessionId;
  // The menu item unmounts before close confirmation ends; return to a mounted trigger.
  const menuClose = decision.reason === "command" || decision.reason === "close-all" || decision.reason === "layout-reset";
  const returnFocus = menuClose && workspaceMenuTrigger.current?.isConnected ? workspaceMenuTrigger : undefined;
  const respond = (choice: CloseChoice) => {
    void workspace.close.respond(id, choice).then(() => {
      if (!menuClose) return;
      // Close-all/reset holds close.busy until the awaiting controller settles.
      // A native-disabled trigger cannot receive Dialog's immediate finalFocus;
      // restore focus after admission releases, never over the next dialog.
      window.requestAnimationFrame(() => {
        const state = workspace.close.state.getState();
        const trigger = workspaceMenuTrigger.current;
        if (!state.busy && !state.decisions.length && trigger?.isConnected && !trigger.disabled)
          trigger.focus();
      });
    });
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) respond("cancel");
      }}
    >
      <DialogContent showCloseButton={false} initialFocus={cancel} finalFocus={returnFocus}>
        <DialogHeader>
          <DialogTitle>Đóng {decision.title}?</DialogTitle>
          <DialogDescription>
            Chứng từ có thay đổi chưa lưu, kể cả text chưa hợp lệ. Chọn Lưu để cập nhật chứng từ hoặc Bỏ thay đổi để đóng.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            ref={cancel}
            variant="outline"
            onClick={() => respond("cancel")}
          >
            Tiếp tục sửa
          </Button>
          <Button
            variant="destructive"
            onClick={() => respond("discard")}
          >
            Bỏ thay đổi
          </Button>
          <Button onClick={() => respond("save")}>
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
