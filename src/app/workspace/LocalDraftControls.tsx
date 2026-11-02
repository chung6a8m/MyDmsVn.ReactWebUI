import { useRef, useState, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import type { ProductionDrafts } from "../runtime/productionDrafts";
import { localDraftStateKey } from "../../infrastructure/drafts/localDraftPersistence";
import type { DraftRecord } from "../../infrastructure/drafts/draftRecord";
import { useWorkspace } from "./WorkspaceContext";
import type { Web4MutationRuntime } from "../runtime/web4MutationRuntime";
import { RecoverySupport } from "./RecoverySupport";

export function LocalDraftControls({ drafts, operations }: { drafts: ProductionDrafts; operations: Web4MutationRuntime }) {
  const workspace = useWorkspace();
  useSyncExternalStore(workspace.auth.subscribe, workspace.auth.getSnapshot);
  const panels = useStore(workspace.panelState);
  const documents = useStore(drafts.persistence.state, value => value.documents);
  const operationStates = useStore(operations.state, value => value.documents);
  const review = useStore(drafts.recovery.state);
  const closing = useStore(workspace.close.state, value => value.busy);
  const layoutBusy = useStore(workspace.layouts.state, value => value.busy);
  const [open, setOpen] = useState(false), [copyConsent, setCopyConsent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DraftRecord | null>(null);
  const [working, setWorking] = useState(false), [message, setMessage] = useState("");
  const panel = panels.activeId ? panels.panels[panels.activeId] : undefined;
  const feature = panel?.kind === "document" ? panel.module as "sales" | "goods-receipt" : undefined;
  const key = feature && panel ? { feature, localDocumentId: panel.id } : undefined;
  const rawStatus = key ? documents[localDraftStateKey(key.feature, key.localDocumentId)] : undefined;
  const recovery = key ? operations.recoveryInfo(key.feature, key.localDocumentId) : undefined;
  const status = key && (rawStatus?.unresolvedOperation ? recovery : operations.canReviewFeature(key.feature)) ? rawStatus : undefined;
  const operation = status && key ? operationStates[localDraftStateKey(key.feature, key.localDocumentId)] : undefined;
  const records = review.records.filter(record => operations.canReviewRecord(record));
  const quarantined = review.quarantined.filter(item => item.key ? operations.canReviewFeature(item.key.feature, true) &&
    item.key.deploymentEpoch === drafts.persistence.namespace.deploymentEpoch && item.key.actorKey === drafts.persistence.namespace.actorKey :
    operations.canReviewFeature("sales", true) || operations.canReviewFeature("goods-receipt", true));
  const opener = useRef<HTMLButtonElement | null>(null);
  const busy = closing || layoutBusy || working;
  const label = status?.phase === "durable" ? "Đã lưu bản nháp trên thiết bị" : status?.phase === "pending" ? "Đang lưu bản nháp trên thiết bị…"
    : status?.phase === "conflict" ? "Bản nháp xung đột với phiên khác" : status?.phase === "failed" ? "Chưa lưu được bản nháp trên thiết bị" : "";
  async function retry(localOnly = false) {
    if (!key) return;
    setWorking(true); setMessage("");
    try { if (status?.unresolvedOperation) { if (localOnly) await operations.retryLocalResult(key.feature, key.localDocumentId); else await operations.checkResult(key.feature, key.localDocumentId); } else { drafts.capture(); await drafts.persistence.retry(key); } }
    catch { setMessage("Chưa lưu được. Giữ trang đang mở, kiểm tra dung lượng/quyền lưu của trình duyệt và thử lại. Không xóa dữ liệu trình duyệt khi còn thao tác chưa đối soát."); }
    finally { setWorking(false); }
  }
  return <>
    {label && <span role="status" className="text-sm text-muted-foreground">{label}</span>}
    {status?.unresolvedOperation && <Button variant="outline" disabled={busy || operation?.checking} onClick={event => { opener.current = event.currentTarget; setOpen(true); setMessage(""); }}>Đối soát thao tác</Button>}
    <Button variant="outline" disabled={busy} onClick={event => { opener.current = event.currentTarget; setOpen(true); setCopyConsent(false); setConfirmDelete(null); setMessage(""); void drafts.recovery.review(); }}>Bản nháp trên thiết bị</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent finalFocus={opener} className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Bản nháp trên thiết bị</DialogTitle><DialogDescription>Chỉ hiển thị dữ liệu thuộc tài khoản và cơ sở dữ liệu hiện tại. Bản nháp cục bộ chưa chứng minh chứng từ đã được lưu lên máy chủ.</DialogDescription></DialogHeader>
        <p className="text-sm text-muted-foreground">Chỉ nội dung đã hoàn tất lưu cục bộ được khôi phục sau tải lại. Những phím vừa gõ có thể chưa được lưu.</p>
        {status && <section className="space-y-2" aria-label="Bản nháp đang mở">
          <p>{label}</p>
          {!status.unresolvedOperation && operation?.message && <p role="status">{operation.message}</p>}
          {(status.phase === "failed" || status.phase === "conflict") && <p role="alert">Giữ nguyên trang để bảo toàn nội dung đang nhập. {status.unresolvedOperation ? "Thao tác chưa được đối soát; lỗi lưu cục bộ không chứng minh máy chủ đã hủy thao tác." : "Save/Post chưa được gửi khi lưu cục bộ thất bại."}{status.errorCode === "quota" ? " Thiết bị không đủ dung lượng lưu." : ""}</p>}
          {status.unresolvedOperation ? <section className="space-y-2" aria-label="Đối soát thao tác">
            <p role="status">{operation?.message || "Kết quả chưa rõ; giữ khóa chứng từ. Chỉ kiểm tra kết quả khi bạn yêu cầu, không tự gửi lại."}</p>
            <p className="text-sm">Loại chứng từ: {key?.feature === "sales" ? "Sales" : "Phiếu nhập"}</p>
            <RecoverySupport metadata={{ ...recovery, correlationId: operation?.correlationId }} current={() => {
              const admitted = key && operations.recoveryInfo(key.feature, key.localDocumentId);
              return admitted ? { ...admitted, correlationId: operation?.correlationId } : null;
            }} />
            {recovery?.localRetry ? <Button variant="outline" disabled={busy || operation?.checking} onClick={() => void retry(true)}>Thử lại lưu cục bộ</Button>
              : <Button disabled={busy || operation?.checking || !key} onClick={() => void retry()}>{operation?.checking ? "Đang kiểm tra…" : "Kiểm tra kết quả"}</Button>}
            <p className="text-sm text-muted-foreground">Nếu không có kết quả, hết hạn hoặc không đủ quyền, giữ bản nháp và liên hệ người phụ trách với mã thao tác. Chức năng gửi lại chưa được bật.</p>
          </section> : <Button variant="outline" disabled={busy} onClick={() => void retry()}>Thử lại lưu cục bộ</Button>}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={copyConsent} onChange={event => setCopyConsent(event.target.checked)} />Tôi hiểu bản sao có dữ liệu kinh doanh nhạy cảm; chỉ dán ở nơi được phép.</label>
          <Button variant="outline" disabled={!copyConsent || busy || !key} onClick={() => {
            if (!key) return; const text = drafts.copySnapshot(key.feature, key.localDocumentId);
            if (!text) { setMessage("Không thể tạo bản sao hợp lệ. Có thể chọn và sao chép riêng nội dung trong ô đang nhập."); return; }
            void navigator.clipboard.writeText(text).then(() => setMessage("Đã sao chép bản nháp đang mở."), () => setMessage("Trình duyệt không cho phép sao chép. Chọn nội dung cần giữ trực tiếp trong ô đang nhập."));
          }}>Sao chép bản nháp đang mở</Button>
        </section>}
        <Button variant="outline" disabled={busy || review.loading} onClick={() => void drafts.recovery.retryReview()}>Đọc lại danh sách</Button>
        {review.loading && <p role="status">Đang đọc bản nháp…</p>}
        {quarantined.length > 0 && <p role="alert">Có {quarantined.length} bản ghi không hợp lệ đã được cách ly. Dữ liệu gốc được giữ để hỗ trợ kiểm tra.</p>}
        {quarantined.map((item, index) => <section key={index} className="space-y-2 rounded-lg border p-3" aria-label="Bản ghi cách ly chưa xác minh">
          <p>Bản ghi chưa xác minh — {item.reason === "unsupported-version" ? "phiên bản chưa được hỗ trợ" : "dữ liệu không hợp lệ"}.</p>
          <RecoverySupport metadata={item.key ? { deploymentEpoch: item.key.deploymentEpoch, localDocumentId: item.key.localDocumentId } : {}} current={() => item.key && operations.canReviewFeature(item.key.feature, true) ? { deploymentEpoch: item.key.deploymentEpoch, localDocumentId: item.key.localDocumentId } : null} />
        </section>)}
        {review.conflicts.some(item => operations.canReviewFeature(item.feature)) && <p role="alert">Có nhiều bản nháp cho cùng chứng từ. Mở từng bản để đối chiếu; ứng dụng không tự gộp hoặc ghi đè.</p>}
        {!review.loading && records.length === 0 && <p className="text-sm">Không có bản nháp khác để mở.</p>}
        <ul className="space-y-3">{records.map(record => <li key={localDraftStateKey(record.feature, record.localDocumentId)} className="space-y-2 rounded-lg border p-3">
          <p>{record.feature === "sales" ? "Sales" : "Phiếu nhập"} · {record.unresolvedOperation ? "Chứng từ được bảo vệ" : record.snapshot.serverId ?? "Chứng từ mới"}</p>
          {!record.unresolvedOperation && <p className="text-sm text-muted-foreground">Lưu lúc {record.savedAt} · {record.snapshot.dirty ? "Có nội dung chưa lưu máy chủ" : "Bản lưu cục bộ"}</p>}
          {record.unresolvedOperation && <p role="status">Kết quả thao tác chưa xác định; giữ khóa cho đến khi đối soát được kết quả.</p>}
          {record.unresolvedOperation && <RecoverySupport metadata={{ operationId: record.operationId, deploymentEpoch: record.deploymentEpoch }} current={() => operations.canReviewRecord(record) ? { operationId: record.operationId, deploymentEpoch: record.deploymentEpoch } : null} />}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => { setWorking(true); void drafts.recovery.restore(record, record.localPersistSequence).then(id => { if (id) setOpen(false); }).finally(() => setWorking(false)); }}>Mở bản nháp</Button>
            <Button variant="outline" disabled={busy || record.unresolvedOperation} onClick={() => setConfirmDelete(record)}>Xóa bản nháp này</Button>
          </div>
        </li>)}</ul>
        {confirmDelete && records.some(record => record.feature === confirmDelete.feature && record.localDocumentId === confirmDelete.localDocumentId && record.localPersistSequence === confirmDelete.localPersistSequence) && <section className="space-y-2 rounded-lg border p-3" aria-label="Xác nhận xóa bản nháp">
          <p>Xóa bản nháp {confirmDelete.feature === "sales" ? "Sales" : "phiếu nhập"} {confirmDelete.snapshot.serverId ?? "mới"} trên thiết bị? Nội dung chưa gửi máy chủ sẽ bị mất.</p>
          <div className="flex gap-2"><Button variant="destructive" disabled={busy} onClick={() => { setWorking(true); void drafts.recovery.discard(confirmDelete, confirmDelete.localPersistSequence).then(done => { if (done) setConfirmDelete(null); }).finally(() => setWorking(false)); }}>Xác nhận xóa</Button><Button variant="outline" disabled={busy} onClick={() => setConfirmDelete(null)}>Giữ bản nháp</Button></div>
        </section>}
        {(message || review.message) && <p role="status">{message || review.message}</p>}
      </DialogContent>
    </Dialog>
  </>;
}
