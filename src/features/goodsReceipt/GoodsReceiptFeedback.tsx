import { useRef, useState, useEffect } from "react";
import { useStore } from "zustand";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useWorkspace } from "../../app/workspace/WorkspaceContext";
import { useGoodsReceipt } from "./GoodsReceiptContext";
import { identityMatches } from "./goodsReceiptSessionStore";
import type { GoodsReceiptPage } from "./contracts";
import { receiptErrorId } from "./fieldErrors";
export function GoodsReceiptFeedback({ sessionId }: { sessionId: string }) {
  const runtime = useGoodsReceipt(), workspace = useWorkspace(), session = useStore(runtime.store, s => s.sessions[sessionId]);
  const [search, setSearch] = useState(""), [candidateId, setCandidate] = useState(""), [candidates, setCandidates] = useState<GoodsReceiptPage>();
  const [message, setMessage] = useState(""), [listing, setListing] = useState(false), queryGeneration = useRef(0);
  useEffect(() => () => { queryGeneration.current++; }, []);
  if (!session) return null;
  const recovery = session.recovery, unknown = session.mutation === "outcome-unknown";
  async function findCandidates() {
    const captured = session, generation = ++queryGeneration.current;
    setListing(true); setCandidates(undefined); setMessage("");
    try {
      const result = await runtime.port.list({ search: search || undefined, pageNumber: 1, pageSize: 25 }, workspace.portContext());
      if (generation !== queryGeneration.current || !workspace.isCurrentScope(captured) || !identityMatches(runtime.store.getState().sessions[sessionId], captured)) return;
      if (result.kind === "failed") setMessage(result.error.message);
      else { setCandidates(result.value); setMessage(result.value.items.length ? "Chọn ứng viên để đọc và đối chiếu; không tự liên kết." : "Không tìm thấy ứng viên; tiếp tục giữ khóa."); }
    } catch { if (generation === queryGeneration.current) setMessage("Không đọc được danh sách; tiếp tục giữ khóa."); }
    finally { if (generation === queryGeneration.current) setListing(false); }
  }
  return <div className="flex flex-col gap-2 px-4">
    {session.feedback && <p role="alert" tabIndex={-1}>{session.feedback}</p>}
    {!!session.issues?.length && <ul aria-label="Lỗi phiếu nhập">{session.issues.map((issue, i) => <li key={receiptErrorId(sessionId, issue, i)} id={receiptErrorId(sessionId, issue, i)} data-line-id={issue.clientLineId}>{issue.message}</li>)}</ul>}
    {session.baseline && <p>{session.baseline.receiptNumber} · {session.postAcknowledgement?.status ?? session.baseline.status} · {session.postAcknowledgement && session.baseline.status !== "Posted" ? "version chưa có · Chi tiết Posted chưa có" : `version ${session.baseline.version}`}
      {(session.postAcknowledgement?.postedAtUtc ?? session.baseline.postedAtUtc) && ` · Post lúc ${session.postAcknowledgement?.postedAtUtc ?? session.baseline.postedAtUtc}`}</p>}
    {session.receiptId && session.mutation === "idle" && <details className="py-2"><summary>Đọc lại / review conflict</summary>
      <Button variant="outline" disabled={session.preparing || recovery?.loading} onClick={() => void runtime.commands.inspectReload(sessionId)}>Đọc lại để review</Button>
      {recovery && <p role="status">{recovery.message}</p>}
      {recovery?.document && <pre className="max-h-48 overflow-auto whitespace-pre-wrap">{JSON.stringify(recovery.document.saved, null, 2)}</pre>}
      <Button variant="outline" disabled={!recovery?.eligible || recovery.loading || recovery.editRevision !== session.editRevision} onClick={() => runtime.commands.confirmReload(sessionId)}>Xác nhận bỏ bản sửa và dùng bản đọc</Button>
    </details>}
    {unknown && <section aria-label="Đối soát kết quả" className="flex flex-col gap-2 py-2">
      <p>Snapshot gốc chỉ nằm trong bộ nhớ. Tải lại hoặc đóng trang sẽ mất snapshot; không tự gửi lại thao tác ghi.</p>
      {!session.receiptId && <>
        <div className="flex flex-wrap gap-2"><Input aria-label="Tìm ứng viên" value={search} onChange={e => { queryGeneration.current++; setListing(false); setSearch(e.target.value); setCandidates(undefined); }} />
          <Button disabled={listing} onClick={() => void findCandidates()}>Tìm ứng viên qua list</Button></div>
        {message && <p role="status">{message}</p>}
        <div className="flex flex-wrap gap-2">{candidates?.items.map(c => <Button key={c.receiptId} variant="outline" onClick={() => { setCandidate(c.receiptId); void runtime.commands.inspectRecovery(sessionId, c.receiptId); }}>Đối chiếu {c.receiptId}</Button>)}</div>
        <label>ID ứng viên<Input aria-label="ID ứng viên" value={candidateId} onChange={e => setCandidate(e.target.value)} /></label>
      </>}
      <Button variant="outline" disabled={recovery?.loading} onClick={() => void runtime.commands.inspectRecovery(sessionId, candidateId)}>Đọc lại để đối soát</Button>
      {recovery && <p role="status">{recovery.message}</p>}
      <details><summary>Snapshot gốc đã gửi</summary><pre data-testid="mutation-snapshot" className="max-h-48 overflow-auto whitespace-pre-wrap">{JSON.stringify(session.mutationSnapshot, null, 2)}</pre></details>
      {recovery?.document && <details open><summary>Bản đọc authoritative · {recovery.document.receiptId} · {recovery.document.status}</summary><pre data-testid="recovery-document" className="max-h-48 overflow-auto whitespace-pre-wrap">{JSON.stringify(recovery.document.saved, null, 2)}</pre></details>}
      <Button disabled={!recovery?.eligible || recovery.loading || (!session.receiptId && candidateId !== recovery.document?.receiptId)} onClick={() => runtime.commands.confirmRecovery(sessionId)}>Xác nhận dùng bản authoritative</Button>
    </section>}
  </div>;
}
