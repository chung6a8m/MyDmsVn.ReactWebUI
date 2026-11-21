import { useState } from "react";
import { Button } from "../components/ui/button";
import { DocumentField } from "../shared/forms/DocumentField";
import { documentFieldId } from "../shared/forms/fieldIdentity";
import { DecimalInput } from "../shared/inputs/DecimalInput";
import { parseDecimal } from "../features/sales/decimal";
import { parseReceiptDecimal } from "../features/goodsReceipt/validation";

function result(raw: string, receipt: boolean) {
  try {
    return receipt ? parseReceiptDecimal(raw, "quantity") : parseDecimal(raw, "qty");
  } catch (error) {
    return (error as Error).message;
  }
}

// DEV-only local states. The live grid adapters still own session writes and Save.
export function DecimalInputStates({ initialOpen = false }: { initialOpen?: boolean }) {
  const [expanded, setExpanded] = useState(initialOpen);
  const [salesRaw, setSalesRaw] = useState("1.0000");
  const [receiptRaw, setReceiptRaw] = useState("1.0000");
  const [salesComposing, setSalesComposing] = useState(false);
  const [receiptComposing, setReceiptComposing] = useState(false);
  const [mode, setMode] = useState<"editable" | "disabled" | "readonly">("editable");
  const disabled = mode === "disabled", readOnly = mode === "readonly";
  return <details className="relative" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary className="cursor-pointer rounded-md border px-2 py-1 text-sm font-medium">DecimalInput · raw / IME / Escape</summary>
    <div className="absolute right-0 top-full z-50 mt-2 flex w-[min(90vw,33rem)] flex-col gap-3 rounded-lg border bg-background p-4 shadow-lg" data-testid="lab-decimal-input">
      <div className="flex flex-wrap gap-1">
        {([
          ["1,25000", "Comma / zero tail"],
          ["1.", "Incomplete"],
          ["-", "Invalid"],
          ["99999999999999,9999", "Exact maximum qty"],
          ["9".repeat(65), "65 characters"],
        ] as const).map(([sample, label]) =>
          <Button key={label} size="xs" variant="outline" type="button"
            onClick={() => { setSalesRaw(sample); setReceiptRaw(sample); setSalesComposing(false); setReceiptComposing(false); }}>
            {label}
          </Button>)}
      </div>
      <label className="flex items-center gap-2 text-sm">Chế độ
        <select aria-label="Chế độ DecimalInput" className="rounded-md border bg-background px-1 py-0.5"
          value={mode} onChange={event => setMode(event.target.value as typeof mode)}>
          <option value="editable">Chỉnh sửa</option>
          <option value="disabled">Disabled</option>
          <option value="readonly">Read-only</option>
        </select>
      </label>
      <DocumentField id={documentFieldId("sales", "lab-decimal", "qty")} label="Số lượng Sales"
        helper="Field mẫu: raw/IME do caller giữ; Escape quay về 1.0000."
        disabled={disabled} readOnly={readOnly}>
        {attrs => <DecimalInput {...attrs} value={salesRaw} composing={salesComposing}
          onRawChange={(raw, composing) => { setSalesRaw(raw); setSalesComposing(composing); }}
          onEscape={() => { setSalesRaw("1.0000"); setSalesComposing(false); }} />}
      </DocumentField>
      <div className="rounded-md border p-2" role="group" aria-label="Cell editor Receipt mẫu">
        <p className="mb-1 text-xs text-muted-foreground">Receipt · inline grid-cell style (không tự Save)</p>
        <DecimalInput aria-label="Số lượng Receipt mẫu" value={receiptRaw} composing={receiptComposing}
          disabled={disabled} readOnly={readOnly}
          onRawChange={(raw, composing) => { setReceiptRaw(raw); setReceiptComposing(composing); }}
          onEscape={() => { setReceiptRaw("1.0000"); setReceiptComposing(false); }} />
      </div>
      <p className="break-all text-xs text-muted-foreground" data-testid="lab-decimal-result">
        Sales: {result(salesRaw, false)} · composing: {String(salesComposing)} · raw: {salesRaw}
        <span className="block">Receipt: {result(receiptRaw, true)} · composing: {String(receiptComposing)} · raw: {receiptRaw}</span>
      </p>
    </div>
  </details>;
}
