import { useState } from "react";
import { Input } from "../components/ui/input";
import { DocumentField } from "../shared/forms/DocumentField";
import { documentFieldId } from "../shared/forms/fieldIdentity";

// The gallery mounts the exact production field; local state here is Lab-only
// and never mirrors a real Sales/Receipt document.
export function FieldStates({ initialOpen = false }: { initialOpen?: boolean }) {
  const [expanded, setExpanded] = useState(initialOpen);
  const [raw, setRaw] = useState("2026-11-20");
  const id = (field: string) => documentFieldId("sales", "lab-field-demo", field);
  return <details className="relative" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary className="cursor-pointer rounded-md border px-2 py-1 text-sm font-medium">DocumentField · trạng thái và validation</summary>
    <div className="absolute right-0 top-full z-50 mt-2 grid max-h-[70dvh] w-[min(88vw,48rem)] grid-cols-1 gap-4 overflow-auto rounded-md border bg-background p-4 shadow-lg md:grid-cols-2 xl:grid-cols-3" data-testid="lab-field-states">
      <DocumentField id={id("normal")} label="Giá trị đang nhập" helper="Kiểm tra raw và caret, không tự Save.">
        {attrs => <Input {...attrs} value={raw} onChange={e => setRaw(e.target.value)} />}
      </DocumentField>
      <DocumentField id={id("required")} label="Bắt buộc" required helper="Cần chọn một giá trị">
        {attrs => <Input {...attrs} defaultValue="" placeholder="Nhập giá trị" />}
      </DocumentField>
      <DocumentField id={id("invalid")} label="Không hợp lệ" required helper="Ví dụ: yyyy-MM-dd"
        errors={["Giá trị mẫu đang sai."]}>
        {attrs => <Input {...attrs} defaultValue="2026-02-30" />}
      </DocumentField>
      <DocumentField id={id("disabled")} label="Bị vô hiệu hóa" disabled>
        {attrs => <Input {...attrs} defaultValue="Không được sửa" />}
      </DocumentField>
      <DocumentField id={id("readonly")} label="Chỉ đọc" readOnly>
        {attrs => <Input {...attrs} defaultValue="Có thể chọn và sao chép" />}
      </DocumentField>
    </div>
  </details>;
}
