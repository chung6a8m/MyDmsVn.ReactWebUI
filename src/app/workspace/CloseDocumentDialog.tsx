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
import { useWorkspace } from "./WorkspaceContext";

export function CloseDocumentDialog() {
  const workspace = useWorkspace();
  const decision = useStore(
    workspace.close.state,
    (state) => state.decisions[0],
  );
  const cancel = useRef<HTMLButtonElement>(null);
  if (!decision) return null;
  const id = decision.sessionId;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void workspace.close.respond(id, "cancel");
      }}
    >
      <DialogContent showCloseButton={false} initialFocus={cancel}>
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
            onClick={() => void workspace.close.respond(id, "cancel")}
          >
            Tiếp tục sửa
          </Button>
          <Button
            variant="destructive"
            onClick={() => void workspace.close.respond(id, "discard")}
          >
            Bỏ thay đổi
          </Button>
          <Button onClick={() => void workspace.close.respond(id, "save")}>
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
