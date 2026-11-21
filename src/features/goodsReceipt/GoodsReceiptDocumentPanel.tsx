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
import type { ValidationIssue } from "../../ports/portContracts";
import { focusValidationIssue } from "../../shared/forms/focusValidationIssue";
import { identityMatches } from "./goodsReceiptSessionStore";
ModuleRegistry.registerModules([AllCommunityModule]);
export function GoodsReceiptDocumentPanel({ params, api }: IDockviewPanelProps<{ sessionId: string }>) {
  const runtime = useGoodsReceipt(), workspace = useWorkspace();
  const session = useStore(runtime.store, s => s.sessions[params.sessionId]);
  const closeIssues = useStore(workspace.close.state, s => s.issues[params.sessionId]);
  // A direct Save and a close-dialog Save both publish a fresh issue list on
  // failure. The list reference stays unchanged while typing raw buffers.
  const validationIssues = closeIssues ?? session?.issues;
  const [visible, setVisible] = useState(api.isVisible), [currentLine, setCurrentLine] = useState<string>();
  const grid = useRef<AgGridReact<GoodsReceiptLineDraft>>(null), root = useRef<HTMLElement>(null);
  useEffect(() => { const sub = api.onDidVisibilityChange(e => setVisible(e.isVisible)); return () => sub.dispose(); }, [api]);
  function navigateIssue(issue: ValidationIssue, onDone?: () => void) {
    if (!session || !identityMatches(runtime.store.getState().sessions[params.sessionId], session)) return;
    api.setActive();
    requestAnimationFrame(() => {
      if (identityMatches(runtime.store.getState().sessions[params.sessionId], session) && api.isVisible) {
        focusValidationIssue({ module: "goods-receipt", sessionId: params.sessionId, issue,
          root: root.current, grid: grid.current?.api, canEdit: canEdit(runtime.store.getState().sessions[params.sessionId]) });
      }
      onDone?.();
    });
  }
  useEffect(() => {
    const issue = validationIssues?.[0];
    if (!issue) return;
    navigateIssue(issue, closeIssues ? () => workspace.close.acknowledgeIssues(params.sessionId, closeIssues) : undefined);
    // New validation results focus once; raw keystrokes retain the same issues
    // reference and cannot steal focus. Summary links always remain navigable.
  }, [api, closeIssues, validationIssues, params.sessionId, workspace]);
  if (!session) return null;
  const selected = session.draft?.lines.find(l => l.clientLineId === currentLine) ?? session.draft?.lines[0];
  const selectedIndex = session.draft?.lines.findIndex(l => l === selected) ?? -1;
  const postable = session.status === "ready" && session.mutation === "idle" && !session.localRecovery && !session.writeReviewRequired && !session.preparing && !!session.receiptId && !session.dirty && !session.postAcknowledgement && session.baseline?.status === "Draft" && session.capabilities?.post === true;
  return <LookupOverlayHost visible={visible}><section ref={root} aria-label={`Phiếu nhập ${session.receiptId ?? "mới"}`} data-session-id={session.sessionId} data-generation={session.generation}
    className="flex h-full min-h-0 flex-col overflow-auto" onFocusCapture={() => { api.setActive(); workspace.commands.activate(session.sessionId); }}>
    {session.mutation !== "idle" && session.status !== "ready" && <p role="status" className="px-4 py-2">{session.mutation === "pending" ? "Đang ghi phiếu nhập…" : "Kết quả chưa rõ; phiên đang khóa để đối soát."}</p>}
    {session.status === "loading" ? <p role="status">Đang đọc phiếu nhập…</p> : session.status === "failed" ? <div><p role="alert">{session.error?.message}</p><Button variant="outline" onClick={() => void runtime.retryFailed(session.sessionId)}>Thử đọc lại phiếu nhập</Button></div> : <>
      <GoodsReceiptFeedback sessionId={session.sessionId} onIssueSelect={navigateIssue} />
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
