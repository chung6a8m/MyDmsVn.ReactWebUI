import { useId, useState } from "react";
import { Button } from "../../components/ui/button";
import { operatorMetadata } from "./operatorMetadata";

export function RecoverySupport({ metadata, current }: { metadata: Record<string, unknown>; current(): Record<string, unknown> | null }) {
  const reasonId = useId(), summaryId = useId();
  const [message, setMessage] = useState("");
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
    <p id={reasonId} className="text-sm text-muted-foreground">Chưa có xác nhận có thẩm quyền rằng thao tác gốc không được thực hiện. Tiếp tục giữ khóa; chức năng mở khóa và gửi lại chưa được bật. Không có kết quả, hết hạn hoặc lỗi kiểm tra không chứng minh thao tác đã bị hủy.</p>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled aria-describedby={reasonId}>Gửi lại đúng thao tác</Button>
      <Button variant="outline" disabled aria-describedby={reasonId}>Mở khóa thao tác</Button>
    </div>
    {message && <p role="status">{message}</p>}
  </section>;
}
