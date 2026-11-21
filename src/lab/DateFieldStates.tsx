import { useState } from "react";
import { Button } from "../components/ui/button";
import { DateField } from "../shared/inputs/DateField";
import { parseDateOnly } from "../shared/inputs/dateOnly";
import { DocumentField } from "../shared/forms/DocumentField";
import { documentFieldId } from "../shared/forms/fieldIdentity";

// Local-only controls mount the same DateField as Sales/Receipt, never a copied mock.
export function DateFieldStates() {
  const [raw, setRaw] = useState("2024-02-29");
  const [bounded, setBounded] = useState(false);
  const [mode, setMode] = useState<"editable" | "disabled" | "readonly">("editable");
  const parsed = parseDateOnly(raw);
  return <details className="relative">
    <summary className="cursor-pointer rounded-md border px-2 py-1 text-sm font-medium">DateField · ISO / Calendar</summary>
    <div className="absolute right-0 top-full z-50 mt-2 flex w-[min(90vw,26rem)] flex-col gap-3 rounded-lg border bg-background p-4 shadow-lg" data-testid="lab-date-field">
      <div className="flex flex-wrap gap-1">
        {([
          ["2024-02-29", "Leap day"],
          ["2026-02-30", "Invalid"],
          ["2026-", "Partial"],
          ["0001-01-01", "Year 0001"],
          ["", "Clear"],
        ] as const).map(([sample, title]) =>
          <Button key={title} type="button" size="xs" variant="outline" onClick={() => setRaw(sample)}>{title}</Button>)}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={bounded} onChange={e => setBounded(e.target.checked)} />
        Giới hạn 2024-02-28 đến 2024-03-02
      </label>
      <label className="flex items-center gap-2 text-sm">Chế độ
        <select className="rounded-md border bg-background px-1 py-0.5" aria-label="Chế độ DateField"
          value={mode} onChange={e => setMode(e.target.value as typeof mode)}>
          <option value="editable">Chỉnh sửa</option>
          <option value="disabled">Disabled</option>
          <option value="readonly">Read-only</option>
        </select>
      </label>
      <DocumentField id={documentFieldId("sales", "lab-date", "date")} label="Ngày mẫu"
        helper="ISO yyyy-MM-dd · raw giữ nguyên khi sai, dở hoặc Escape." required
        disabled={mode === "disabled"} readOnly={mode === "readonly"}
        errors={parsed.kind === "invalid" ? ["Ngày không hợp lệ."] : []}>
        {attrs => <DateField {...attrs} calendarLabel="Ngày mẫu" placeholder="yyyy-MM-dd" value={raw}
          min={bounded ? "2024-02-28" : undefined} max={bounded ? "2024-03-02" : undefined}
          onRawChange={next => setRaw(next)} />}
      </DocumentField>
      <p className="text-xs text-muted-foreground" data-testid="lab-date-state">
        Parser: {parsed.kind}{parsed.kind === "valid" ? " · " + parsed.canonical : ""} · raw: {raw}
      </p>
    </div>
  </details>;
}
