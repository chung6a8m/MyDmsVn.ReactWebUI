import { useRef } from "react";
import { useStore } from "zustand";
import { Input } from "../../components/ui/input";
import type { WorkspaceRuntime } from "../../app/workspace/panelRegistry";
import {
  canEdit,
  type SessionIdentity,
} from "../../features/sales/salesSessionStore";
import { restoreRaw } from "../../features/sales/sessionEditing";
export function DecimalCellEditor({
  workspace,
  identity,
  lineId,
  kind,
  row,
  activate,
}: {
  workspace: WorkspaceRuntime;
  identity: SessionIdentity;
  lineId: string;
  kind: "qty" | "unitPrice";
  row: number;
  activate: (input: HTMLInputElement) => void;
}) {
  const session = useStore(
    workspace.store,
    (s) => s.sessions[identity.sessionId],
  );
  const field = `${kind}:${lineId}`;
  const original = useRef(session?.rawBuffers[field]);
  const composing = useRef(false);
  const line = session?.draft?.lines.find((l) => l.clientLineId === lineId);
  if (!session || !line) return null;
  return (
    <Input
      id={`${kind}-${identity.sessionId}-${lineId}`}
      aria-label={`${kind === "qty" ? "Số lượng" : "Đơn giá"} dòng ${row + 1}`}
      data-line-id={lineId}
      disabled={!canEdit(session)}
      inputMode="decimal"
      tabIndex={-1}
      data-composing={session.rawBuffers[field]?.composing ?? false}
      value={session.rawBuffers[field]?.raw ?? line[kind]}
      onFocus={(e) => {
        activate(e.currentTarget);
        original.current =
          workspace.store.getState().sessions[identity.sessionId].rawBuffers[
            field
          ];
      }}
      onChange={(e) =>
        workspace.writeBuffer(
          identity.sessionId,
          field,
          e.target.value,
          composing.current,
        )
      }
      onCompositionStart={(e) => {
        composing.current = true;
        workspace.writeBuffer(
          identity.sessionId,
          field,
          e.currentTarget.value,
          true,
        );
      }}
      onCompositionEnd={(e) => {
        composing.current = false;
        workspace.writeBuffer(
          identity.sessionId,
          field,
          e.currentTarget.value,
          false,
        );
      }}
      onKeyDown={(e) => {
        if (
          e.key === "Escape" &&
          !composing.current &&
          !e.nativeEvent.isComposing
        ) {
          e.preventDefault();
          e.stopPropagation();
          restoreRaw(workspace.store, identity, field, original.current);
        }
      }}
    />
  );
}
