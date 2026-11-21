import type { CustomCellEditorProps } from "ag-grid-react";
import { useLayoutEffect, useRef } from "react";
import { useStore } from "zustand";
import { DecimalInput } from "../inputs/DecimalInput";
import { documentFieldId, validationIssueId } from "../forms/fieldIdentity";
import type { WorkspaceRuntime } from "../../app/workspace/panelRegistry";
import {
  canEdit,
  type SessionIdentity,
} from "../../features/sales/salesSessionStore";
import { restoreRaw } from "../../features/sales/sessionEditing";
export function DecimalCellEditor(props: {
  workspace: WorkspaceRuntime;
  identity: SessionIdentity;
  lineId: string;
  kind: "qty" | "unitPrice";
  row: number;
} & CustomCellEditorProps) {
  // AG Grid 36.2 can refresh an already open editor with core params only.
  // Keep its session/line binding and initial key for this editor's lifetime.
  const { workspace, identity, lineId, kind, row, eventKey } = useRef(props).current;
  const session = useStore(
    workspace.store,
    (s) => s.sessions[identity.sessionId],
  );
  const field = `${kind}:${lineId}`;
  const original = useRef(session?.rawBuffers[field]);
  const line = session?.draft?.lines.find((l) => l.clientLineId === lineId);
  const issueIds = session?.issues?.flatMap((issue, index) => issue.field === field
    ? [validationIssueId("sales", identity.sessionId, issue, index)] : []) ?? [];
  function publish(raw: string, isComposing = false) {
    workspace.writeBuffer(identity.sessionId, field, raw, isComposing);
    props.onValueChange(raw);
  }
  const started = useRef(false);
  useLayoutEffect(() => {
    if (started.current) return;
    started.current = true;
    if (eventKey && eventKey.length === 1)
      publish(eventKey);
  }, [eventKey, workspace, identity.sessionId, field]);
  if (!session || !line) return null;
  return (
    <DecimalInput
      id={documentFieldId("sales", identity.sessionId, field)}
      aria-label={`${kind === "qty" ? "Số lượng" : "Đơn giá"} dòng ${row + 1}`}
      data-line-id={lineId}
      aria-invalid={issueIds.length ? true : undefined}
      aria-describedby={issueIds.join(" ") || undefined}
      disabled={!canEdit(session)}
      tabIndex={-1}
      composing={session.rawBuffers[field]?.composing ?? false}
      value={session.rawBuffers[field]?.raw ?? line[kind]}
      autoFocus
      onRawChange={publish}
      onEscape={() => restoreRaw(workspace.store, identity, field, original.current)}
    />
  );
}
