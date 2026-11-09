import { useId, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { operatorMetadata } from "./operatorMetadata";
import type { ManualResendInfo } from "../runtime/web4MutationRuntime";

export function RecoverySupport({ metadata, current, resend }: { metadata: Record<string, unknown>; current(): Record<string, unknown> | null;
  resend?: { prepare(): Promise<ManualResendInfo | null>; confirm(consentId: string): Promise<unknown> } }) {
  const reasonId = useId(), summaryId = useId();
  const [message, setMessage] = useState("");
  const [resendInfo, setResendInfo] = useState<ManualResendInfo | null>(null), [checking, setChecking] = useState(false), [consumed, setConsumed] = useState(false);
  const cancel = useRef<HTMLButtonElement | null>(null), resendButton = useRef<HTMLButtonElement | null>(null), confirming = useRef(false), composing = useRef(false);
  const safe = operatorMetadata(metadata);
  return <section className="space-y-2" aria-label="Thông tin hỗ trợ đối soát">
    <p className="text-sm">Thông tin đã lưu, chưa xác minh kết quả. UNKNOWN — chứng từ vẫn được bảo vệ.</p>
    {safe.summary ? <div id={summaryId} tabIndex={0} className="whitespace-pre-wrap break-all rounded-lg border p-3 text-sm select-text" aria-label="Thông tin hỗ trợ chỉ gồm mã định danh">{safe.summary}</div>
      : <p className="text-sm">Không có mã định danh an toàn để hiển thị.</p>}
    <p className="text-sm text-muted-foreground">Mã tương quan chỉ giúp tra cứu yêu cầu; chưa có xác nhận đã tạo phiếu hỗ trợ. Bản sao này chỉ gồm mã định danh.</p>
    <Button variant="outline" disabled={!safe.summary} aria-describedby={safe.summary ? summaryId : undefined} onClick={async () => {
      const admitted = current(); if (!admitted) return;
      const summary = operatorMetadata(admitted).summary; if (!summary) return;
      try { await navigator.clipboard.writeText(summary); if (current()) setMessage("Đã sao chép thông tin hỗ trợ."); } catch {
        if (current()) setMessage("Chưa sao chép được. Chọn và sao chép các mã định danh ở trên.");
      }
    }}>Sao chép thông tin hỗ trợ</Button>
    <p id={reasonId} className="text-sm text-muted-foreground">Chưa có xác nhận có thẩm quyền rằng thao tác gốc không được thực hiện. Tiếp tục giữ khóa. Không có kết quả, hết hạn hoặc lỗi kiểm tra không chứng minh thao tác đã bị hủy.</p>
    <div className="flex flex-wrap gap-2">
      <Button ref={resendButton} variant="outline" disabled={!resend || checking || consumed} aria-describedby={reasonId} onClick={() => {
        if (!resend || checking || consumed) return;
        setChecking(true); setMessage("");
        void resend.prepare().then(info => { if (info && current()) setResendInfo(info); else setMessage("Thao tác này hiện không đủ điều kiện gửi lại. Tiếp tục giữ khóa và chỉ kiểm tra kết quả."); })
          .catch(() => setMessage("Không thể xác minh điều kiện gửi lại. Không có yêu cầu ghi nào được gửi."))
          .finally(() => setChecking(false));
      }}>{checking ? "Đang kiểm tra điều kiện…" : consumed ? "Quyền gửi lại đã dùng" : "Gửi lại đúng thao tác"}</Button>
      <Button variant="outline" disabled aria-describedby={reasonId}>Mở khóa thao tác</Button>
    </div>
    {message && <p role="status">{message}</p>}
    <Dialog open={!!resendInfo} onOpenChange={open => { if (!open && !confirming.current) setResendInfo(null); }}>
      <DialogContent showCloseButton={false} initialFocus={cancel} finalFocus={resendButton} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}>
        <DialogHeader><DialogTitle>Gửi lại đúng thao tác gốc?</DialogTitle><DialogDescription>Hệ thống chưa xác minh được kết quả của thao tác này. Nếu yêu cầu trước chưa hoàn tất, lần gửi này có thể thực hiện nghiệp vụ bán hàng/nhập hàng lần đầu. Ứng dụng sẽ gửi lại đúng mã thao tác và nội dung đã lưu ban đầu, không sử dụng những thay đổi hiện tại.</DialogDescription></DialogHeader>
        {resendInfo && <div className="space-y-1 text-sm">
          <p>Loại thao tác: {resendInfo.operationKind}</p>
          <p>Nhãn chứng từ: {resendInfo.documentLabel}</p>
          <p>Mã thao tác: …{resendInfo.operationId.slice(-8)}</p>
        </div>}
        <div className="flex justify-end gap-2">
          <Button ref={cancel} variant="outline" onClick={() => setResendInfo(null)}>Hủy</Button>
          <Button disabled={confirming.current} onKeyDown={event => { if (event.key === "Enter" && composing.current) event.preventDefault(); }} onClick={() => {
            if (!resend || !resendInfo || confirming.current || composing.current) return;
            confirming.current = true; setChecking(true);
            void resend.confirm(crypto.randomUUID()).then(() => { setConsumed(true); setMessage("Quyền gửi lại đã được dùng. Nếu kết quả vẫn chưa rõ, chỉ dùng kiểm tra kết quả hoặc thông tin hỗ trợ."); })
              .catch(() => { setConsumed(true); setMessage("Kết quả gửi lại chưa rõ. Quyền gửi lại được xem là đã dùng; không gửi thêm lần nữa."); })
              .finally(() => { confirming.current = false; setChecking(false); setResendInfo(null); });
          }}>Xác nhận gửi thao tác gốc</Button>
        </div>
      </DialogContent>
    </Dialog>
  </section>;
}
