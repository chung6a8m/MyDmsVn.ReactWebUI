import { useState } from "react";
import { useStore } from "zustand";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import type { ProductionDrafts } from "../runtime/productionDrafts";
import { localDraftStateKey } from "../../infrastructure/drafts/localDraftPersistence";
import type { DraftRecord } from "../../infrastructure/drafts/draftRecord";
import { useWorkspace } from "./WorkspaceContext";

export function LocalDraftControls({ drafts }: { drafts: ProductionDrafts }) {
  const workspace = useWorkspace();
  const panels = useStore(workspace.panelState);
  const documents = useStore(drafts.persistence.state, value => value.documents);
  const review = useStore(drafts.recovery.state);
  const closing = useStore(workspace.close.state, value => value.busy);
  const layoutBusy = useStore(workspace.layouts.state, value => value.busy);
  const [open, setOpen] = useState(false), [copyConsent, setCopyConsent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DraftRecord | null>(null);
  const [working, setWorking] = useState(false), [message, setMessage] = useState("");
  const panel = panels.activeId ? panels.panels[panels.activeId] : undefined;
  const feature = panel?.kind === "document" ? panel.module as "sales" | "goods-receipt" : undefined;
  const key = feature && panel ? { feature, localDocumentId: panel.id } : undefined;
  const status = key ? documents[localDraftStateKey(key.feature, key.localDocumentId)] : undefined;
  const busy = closing || layoutBusy || working;
  const label = status?.phase === "durable" ? "Đã lưu bản nháp trên thiết bị" : status?.phase === "pending" ? "Đang lưu bản nháp trên thiết bị…"
    : status?.phase === "conflict" ? "Bản nháp xung đột với phiên khác" : status?.phase === "failed" ? "Chưa lưu được bản nháp trên thiết bị" : "";
  async function retry() {
    if (!key) return;
    setWorking(true); setMessage("");
    try { drafts.capture(); await drafts.persistence.retry(key); }
    catch { setMessage("Chưa lưu được. Giữ trang đang mở, kiểm tra dung lượng/quyền lưu của trình duyệt và thử lại. Không xóa dữ liệu trình duyệt khi còn thao tác chưa đối soát."); }
    finally { setWorking(false); }
  }
  return <>
    {label && <span role="status" className="text-sm text-muted-foreground">{label}</span>}
    <Button variant="outline" disabled={busy} onClick={() => { setOpen(true); setCopyConsent(false); setConfirmDelete(null); setMessage(""); void drafts.recovery.review(); }}>Bản nháp trên thiết bị</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Bản nháp trên thiết bị</DialogTitle><DialogDescription>Chỉ hiển thị dữ liệu thuộc tài khoản và cơ sở dữ liệu hiện tại. Bản nháp cục bộ chưa chứng minh chứng từ đã được lưu lên máy chủ.</DialogDescription></DialogHeader>
        <p className="text-sm text-muted-foreground">Chỉ nội dung đã hoàn tất lưu cục bộ được khôi phục sau tải lại. Những phím vừa gõ có thể chưa được lưu.</p>
        {status && <section className="space-y-2" aria-label="Bản nháp đang mở">
          <p>{label}</p>
          {(status.phase === "failed" || status.phase === "conflict") && <p role="alert">Giữ nguyên trang để bảo toàn nội dung đang nhập. Save/Post chưa được gửi khi lưu cục bộ thất bại.{status.errorCode === "quota" ? " Thiết bị không đủ dung lượng lưu." : ""}</p>}
          <Button variant="outline" disabled={busy} onClick={() => void retry()}>Thử lại lưu cục bộ</Button>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={copyConsent} onChange={event => setCopyConsent(event.target.checked)} />Tôi hiểu bản sao có dữ liệu kinh doanh nhạy cảm; chỉ dán ở nơi được phép.</label>
          <Button variant="outline" disabled={!copyConsent || busy || !key} onClick={() => {
            if (!key) return; const text = drafts.copySnapshot(key.feature, key.localDocumentId);
            if (!text) { setMessage("Không thể tạo bản sao hợp lệ. Có thể chọn và sao chép riêng nội dung trong ô đang nhập."); return; }
            void navigator.clipboard.writeText(text).then(() => setMessage("Đã sao chép bản nháp đang mở."), () => setMessage("Trình duyệt không cho phép sao chép. Chọn nội dung cần giữ trực tiếp trong ô đang nhập."));
          }}>Sao chép bản nháp đang mở</Button>
        </section>}
        <Button variant="outline" disabled={busy || review.loading} onClick={() => void drafts.recovery.retryReview()}>Đọc lại danh sách</Button>
        {review.loading && <p role="status">Đang đọc bản nháp…</p>}
        {review.quarantined.length > 0 && <p role="alert">Có {review.quarantined.length} bản ghi không hợp lệ đã được cách ly. Dữ liệu gốc được giữ để hỗ trợ kiểm tra.</p>}
        {review.conflicts.length > 0 && <p role="alert">Có nhiều bản nháp cho cùng chứng từ. Mở từng bản để đối chiếu; ứng dụng không tự gộp hoặc ghi đè.</p>}
        {!review.loading && review.records.length === 0 && <p className="text-sm">Không có bản nháp khác để mở.</p>}
        <ul className="space-y-3">{review.records.map(record => <li key={localDraftStateKey(record.feature, record.localDocumentId)} className="space-y-2 rounded-lg border p-3">
          <p>{record.feature === "sales" ? "Sales" : "Phiếu nhập"} · {record.snapshot.serverId ?? "Chứng từ mới"}</p>
          <p className="text-sm text-muted-foreground">Lưu lúc {record.savedAt} · {record.snapshot.dirty ? "Có nội dung chưa lưu máy chủ" : "Bản lưu cục bộ"}</p>
          {record.unresolvedOperation && <p role="status">Kết quả thao tác chưa xác định; giữ khóa cho đến khi đối soát được kết quả.</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => { setWorking(true); void drafts.recovery.restore(record, record.localPersistSequence).then(id => { if (id) setOpen(false); }).finally(() => setWorking(false)); }}>Mở bản nháp</Button>
            <Button variant="outline" disabled={busy || record.unresolvedOperation} onClick={() => setConfirmDelete(record)}>Xóa bản nháp này</Button>
          </div>
        </li>)}</ul>
        {confirmDelete && review.records.some(record => record.feature === confirmDelete.feature && record.localDocumentId === confirmDelete.localDocumentId && record.localPersistSequence === confirmDelete.localPersistSequence) && <section className="space-y-2 rounded-lg border p-3" aria-label="Xác nhận xóa bản nháp">
          <p>Xóa bản nháp {confirmDelete.feature === "sales" ? "Sales" : "phiếu nhập"} {confirmDelete.snapshot.serverId ?? "mới"} trên thiết bị? Nội dung chưa gửi máy chủ sẽ bị mất.</p>
          <div className="flex gap-2"><Button variant="destructive" disabled={busy} onClick={() => { setWorking(true); void drafts.recovery.discard(confirmDelete, confirmDelete.localPersistSequence).then(done => { if (done) setConfirmDelete(null); }).finally(() => setWorking(false)); }}>Xác nhận xóa</Button><Button variant="outline" disabled={busy} onClick={() => setConfirmDelete(null)}>Giữ bản nháp</Button></div>
        </section>}
        {(message || review.message) && <p role="status">{message || review.message}</p>}
      </DialogContent>
    </Dialog>
  </>;
}
