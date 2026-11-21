import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";
import { ValidationSummary } from "../../shared/forms/ValidationSummary";
import type { CatalogEntry } from "./catalogEntries";

export function ControlExample({ entry }: { entry: CatalogEntry }) {
  const [state, setState] = useState("normal");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [raw, setRaw] = useState("Tiếng Việt có dấu");
  const disabled = state === "disabled", readOnly = state === "read-only", invalid = state === "invalid";
  const nativeExample = ["button", "input", "native-select", "dialog"].includes(entry.id);
  return <section aria-label="Chi tiết catalog" data-testid="catalog-example" className="space-y-2 border-b px-4 py-3 text-sm">
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="font-semibold">{entry.title}</h2>
      {entry.status === "planned" && <span className="rounded border px-2 py-0.5 text-xs">Planned · chưa có component</span>}
    </div>
    <p>{entry.purpose}</p>
    <p className="text-xs text-muted-foreground">Source: <code>{entry.source}</code> · Consumer: {entry.consumers.join(", ") || "chưa có"}</p>
    <p className="text-xs text-muted-foreground">Keyboard: {entry.keyboard} · Contract: {entry.validation}</p>
    <p className="text-xs text-muted-foreground">States: {entry.states.join(", ") || "chưa hỗ trợ"}</p>
    <p className="text-xs text-muted-foreground">Focused tests: {entry.tests.join(" · ") || "chưa có"}</p>
    {nativeExample && <div className="flex flex-wrap items-end gap-2" data-testid="catalog-native-example">
      <label className="space-y-1">State
        <NativeSelect aria-label="Trạng thái control" value={state} onChange={e => setState(e.target.value)}>
          {["normal", "disabled", "read-only", "invalid"].map(v => <NativeSelectOption key={v} value={v}>{v}</NativeSelectOption>)}
        </NativeSelect>
      </label>
      {entry.id === "button" && <Button disabled={disabled} aria-invalid={invalid}>Button mẫu</Button>}
      {entry.id === "input" && <Input aria-label="Input catalog" value={raw} disabled={disabled} readOnly={readOnly} aria-invalid={invalid}
        onChange={e => setRaw(e.target.value)} />}
      {entry.id === "native-select" && <NativeSelect aria-label="NativeSelect catalog" disabled={disabled} aria-invalid={invalid}>
        <NativeSelectOption value="one">Mẫu một</NativeSelectOption><NativeSelectOption value="two">Mẫu hai</NativeSelectOption>
      </NativeSelect>}
      {entry.id === "dialog" && <>
        <Button onClick={() => setDialogOpen(true)} disabled={disabled}>Mở dialog mẫu</Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent>
          <DialogTitle>Dialog mẫu</DialogTitle><DialogDescription>Escape đóng và trả focus về trigger.</DialogDescription>
          <Button onClick={() => setDialogOpen(false)}>Đóng dialog mẫu</Button>
        </DialogContent></Dialog>
      </>}
    </div>}
    {entry.id === "document-field" && <ValidationSummary module="sales" sessionId="lab-summary"
      label="Tổng hợp lỗi mẫu" issues={[{ code: "required", field: "customerId", message: "Cần chọn khách hàng." }]} />}
    {entry.id === "lookup" && <p>Trong Workspace bên dưới, mở mẫu 1001 rồi bấm “Kiểm tra lookup” để thử field, AG Grid cell và dialog với đúng ProductLookup production.</p>}
    {entry.id === "workspace-actions" && <p>Trong Workspace bên dưới thử Tách sang phải, Đóng tài liệu và Đặt lại bố cục; các lệnh luôn qua admission.</p>}
  </section>;
}
