import { useStore } from "zustand";
import { useRef } from "react";
import { Input } from "../../components/ui/input";
import { ProductLookup } from "../../shared/lookup/ProductLookup";
import { emptyLookup } from "../../shared/lookup/lookupTypes";
import { useGoodsReceipt } from "./GoodsReceiptContext";
import { canEdit } from "./goodsReceiptSessionStore";
import { writeLookup, writeRaw } from "./sessionEditing";
import { receiptFieldErrorAttributes } from "./fieldErrors";
export function GoodsReceiptHeaderForm({ sessionId }: { sessionId: string }) {
  const runtime = useGoodsReceipt();
  const session = useStore(runtime.store, s => s.sessions[sessionId]);
  const dateComposing = useRef(false), noteComposing = useRef(false);
  if (!session?.draft) return null;
  return <div className="flex flex-col gap-3 p-4">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
      <label htmlFor={`receiptDate-${sessionId}`}>Ngày nhập
        <Input id={`receiptDate-${sessionId}`} placeholder="yyyy-MM-dd" disabled={!canEdit(session)}
          {...receiptFieldErrorAttributes(session, "receiptDate")}
          value={session.rawBuffers.receiptDate?.raw ?? session.draft.receiptDate}
          onChange={e => writeRaw(runtime.store, session, "receiptDate", e.target.value, dateComposing.current)}
          onCompositionStart={e => { dateComposing.current = true; writeRaw(runtime.store, session, "receiptDate", e.currentTarget.value, true); }}
          onCompositionEnd={e => { dateComposing.current = false; writeRaw(runtime.store, session, "receiptDate", e.currentTarget.value, false); }} />
      </label>
      {([["warehouse", "Kho"], ["employee", "Nhân viên"]] as const).map(([kind, label]) => {
        const field = `${kind}Id`, ref = session.baseline?.references[kind];
        const text = ref?.displayName ?? (ref ? `ID ${ref.id}` : "");
        const errors = receiptFieldErrorAttributes(session, field);
        return <div key={kind} data-receipt-field={field}>
          <ProductLookup label={label} scope={{ ...session, clientLineId: field, catalogContext: "receipt-header", catalogKind: kind }}
            port={runtime.catalog} disabled={!canEdit(session)}
            invalid={errors["aria-invalid"]} describedBy={errors["aria-describedby"]}
            value={session.lookupBuffers?.[field] ?? (ref ? { selectedId: ref.id, displayText: text, query: text, confirmed: true, composing: false } : emptyLookup)}
            onChange={value => writeLookup(runtime.store, session, field, value)} />
          {ref && !ref.isActive && <p className="text-muted-foreground">Ngừng hoạt động</p>}
        </div>;
      })}
    </div>
    <label htmlFor={`note-${sessionId}`}>Ghi chú
      <Input id={`note-${sessionId}`} disabled={!canEdit(session)} value={session.rawBuffers.note?.raw ?? session.draft.note ?? ""}
        {...receiptFieldErrorAttributes(session, "note")}
        onChange={e => writeRaw(runtime.store, session, "note", e.target.value, noteComposing.current)}
        onCompositionStart={e => { noteComposing.current = true; writeRaw(runtime.store, session, "note", e.currentTarget.value, true); }}
        onCompositionEnd={e => { noteComposing.current = false; writeRaw(runtime.store, session, "note", e.currentTarget.value, false); }} />
    </label>
  </div>;
}
