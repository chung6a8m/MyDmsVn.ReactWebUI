import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import type { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import type { IDockviewPanelProps } from "dockview";
import { Button } from "../../components/ui/button";
import { useWorkspace } from "../../app/workspace/WorkspaceContext";
import { LookupOverlayHost } from "../../shared/lookup/LookupOverlayHost";
import { useGoodsReceipt } from "./GoodsReceiptContext";
import { canEdit } from "./goodsReceiptSessionStore";
import { addLine, removeLine } from "./sessionEditing";
import type { GoodsReceiptLineDraft } from "./contracts";
import { GoodsReceiptHeaderForm } from "./GoodsReceiptHeaderForm";
import { GoodsReceiptFeedback } from "./GoodsReceiptFeedback";
import { GoodsReceiptLinesGrid } from "./GoodsReceiptLinesGrid";
ModuleRegistry.registerModules([AllCommunityModule]);
export function GoodsReceiptDocumentPanel({ params, api }: IDockviewPanelProps<{ sessionId: string }>) {
  const runtime = useGoodsReceipt(), workspace = useWorkspace();
  const session = useStore(runtime.store, s => s.sessions[params.sessionId]);
  const closeIssues = useStore(workspace.close.state, s => s.issues[params.sessionId]);
  const [visible, setVisible] = useState(api.isVisible), [currentLine, setCurrentLine] = useState<string>();
  const grid = useRef<AgGridReact<GoodsReceiptLineDraft>>(null), root = useRef<HTMLElement>(null);
  useEffect(() => { const sub = api.onDidVisibilityChange(e => setVisible(e.isVisible)); return () => sub.dispose(); }, [api]);
  const issues = closeIssues ?? session?.issues;
  useEffect(() => {
    const issue = issues?.[0]; if (!issue) return;
    api.setActive();
    const frame = requestAnimationFrame(() => {
      const [column, lineId] = issue.field.split(":"), gridApi = grid.current?.api;
      const index = lineId ? gridApi?.getRowNode(lineId)?.rowIndex : null;
      if (["product", "quantity", "unitCost"].includes(column) && index != null && index >= 0) {
        gridApi?.ensureIndexVisible(index, "middle"); gridApi?.ensureColumnVisible(column); gridApi?.setFocusedCell(index, column);
        if (!gridApi?.getEditingCells().some(cell => cell.rowIndex === index && cell.column?.getColId() === column)) gridApi?.startEditingCell({ rowIndex: index, colKey: column });
      } else {
        const field = issue.field === "warehouseId" || issue.field === "employeeId"
          ? root.current?.querySelector<HTMLElement>(`[data-receipt-field="${issue.field}"] input`)
          : document.getElementById(`${issue.field}-${params.sessionId}`);
        (field ?? root.current?.querySelector<HTMLElement>('[role="alert"]'))?.focus();
      }
      if (closeIssues) workspace.close.acknowledgeIssues(params.sessionId, closeIssues);
    });
    return () => cancelAnimationFrame(frame);
  }, [issues, closeIssues, api, params.sessionId, workspace]);
  if (!session) return null;
  const selected = session.draft?.lines.find(l => l.clientLineId === currentLine) ?? session.draft?.lines[0];
  const selectedIndex = session.draft?.lines.findIndex(l => l === selected) ?? -1;
  const postable = session.status === "ready" && session.mutation === "idle" && !session.preparing && !!session.receiptId && !session.dirty && !session.postAcknowledgement && session.baseline?.status === "Draft" && session.capabilities?.post === true;
  return <LookupOverlayHost visible={visible}><section ref={root} aria-label={`Phiếu nhập ${session.receiptId ?? "mới"}`} data-session-id={session.sessionId} data-generation={session.generation}
    className="flex h-full min-h-0 flex-col overflow-auto" onFocusCapture={() => { api.setActive(); workspace.commands.activate(session.sessionId); }}>
    {session.mutation !== "idle" && <p role="status" className="px-4 py-2">{session.mutation === "pending" ? "Đang ghi phiếu nhập…" : "Kết quả chưa rõ; phiên đang khóa để đối soát."}</p>}
    {session.status === "loading" ? <p role="status">Đang đọc phiếu nhập…</p> : session.status === "failed" ? <div><p role="alert">{session.error?.message}</p><Button variant="outline" onClick={() => void runtime.retryFailed(session.sessionId)}>Thử đọc lại phiếu nhập</Button></div> : <>
      <GoodsReceiptFeedback sessionId={session.sessionId} />
      <GoodsReceiptHeaderForm sessionId={session.sessionId} />
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <Button disabled={!canEdit(session)} onClick={() => void runtime.commands.requestSave(session.sessionId)}>Lưu phiếu nhập</Button>
        <Button disabled={!postable} onClick={() => void runtime.commands.requestPost(session.sessionId)}>Post phiếu nhập</Button>
        <Button variant="outline" disabled={!canEdit(session) || session.draft!.lines.length >= 200} onClick={() => { const id = addLine(runtime.store, session); if (id) setCurrentLine(id); }}>Thêm dòng</Button>
        <Button variant="outline" disabled={!canEdit(session) || !selected} onClick={() => { if (selected) removeLine(runtime.store, session, selected.clientLineId); }}>Xóa dòng {selectedIndex + 1}</Button>
        <span>{session.draft!.lines.length} dòng · {session.dirty ? "Chưa lưu" : "Chưa thay đổi"}</span>
      </div>
      <div className="min-h-64 flex-1"><GoodsReceiptLinesGrid sessionId={session.sessionId} api={api} gridRef={grid} onCurrentLine={setCurrentLine} /></div>
    </>}
  </section></LookupOverlayHost>;
}
