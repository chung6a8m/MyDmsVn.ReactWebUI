
import { useStore } from "zustand";
import { DateField } from "../../shared/inputs/DateField";
import { ProductLookup } from "../../shared/lookup/ProductLookup";
import { emptyLookup } from "../../shared/lookup/lookupTypes";
import { DocumentField } from "../../shared/forms/DocumentField";
import { documentFieldId, fieldIssueMessages } from "../../shared/forms/fieldIdentity";
import { useGoodsReceipt } from "./GoodsReceiptContext";
import { canEdit } from "./goodsReceiptSessionStore";
import { writeLookup, writeRaw } from "./sessionEditing";

export function GoodsReceiptHeaderForm({ sessionId }: { sessionId: string }) {
  const runtime = useGoodsReceipt();
  const session = useStore(runtime.store, s => s.sessions[sessionId]);
  const noteComposing = useRef(false);
  if (!session?.draft) return null;
  const readOnly = !!session.postAcknowledgement || session.baseline?.status === "Posted";
  const disabled = !canEdit(session);
  const issues = (field: string) => fieldIssueMessages(session.issues, field);
  return <div className="flex flex-col gap-3 p-4">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
      <DocumentField id={documentFieldId("goods-receipt", sessionId, "receiptDate")} label="Ngày nhập"
        helper="Định dạng yyyy-MM-dd" required readOnly={readOnly} disabled={disabled} errors={issues("receiptDate")}>
        {attrs => <DateField {...attrs} key={sessionId} calendarLabel="Ngày nhập" placeholder="yyyy-MM-dd"
          value={session.rawBuffers.receiptDate?.raw ?? session.draft!.receiptDate}
          min="0001-01-02"
          onRawChange={(raw, composing) => writeRaw(runtime.store, session, "receiptDate", raw, composing)} />}
      </DocumentField>
      {([["warehouse", "Kho"], ["employee", "Nhân viên"]] as const).map(([kind, label]) => {
        const field = kind + "Id", ref = session.baseline?.references[kind];
        const text = ref?.displayName ?? (ref ? "ID " + ref.id : "");
        return <DocumentField key={kind} id={documentFieldId("goods-receipt", sessionId, field)}
          label={label} labelOwner="control" required readOnly={readOnly} disabled={disabled}
          helper={ref && !ref.isActive ? "Ngừng hoạt động" : "Chọn từ danh mục"} errors={issues(field)}>
          {attrs => <ProductLookup id={attrs.id} label={label} required readOnly={readOnly}
            scope={{ ...session, clientLineId: field, catalogContext: "receipt-header", catalogKind: kind }}
            port={runtime.catalog} disabled={disabled} invalid={attrs["aria-invalid"]}
            describedBy={attrs["aria-describedby"]}
            value={session.lookupBuffers?.[field] ?? (ref
              ? { selectedId: ref.id, displayText: text, query: text, confirmed: true, composing: false } : emptyLookup)}
            onChange={value => writeLookup(runtime.store, session, field, value)} />}
        </DocumentField>;
      })}
    </div>
    <DocumentField id={documentFieldId("goods-receipt", sessionId, "note")} label="Ghi chú"
      errors={issues("note")} readOnly={readOnly} disabled={disabled}>
      {attrs => <Input {...attrs} value={session.rawBuffers.note?.raw ?? session.draft!.note ?? ""}
        onChange={e => writeRaw(runtime.store, session, "note", e.target.value, noteComposing.current)}
        onCompositionStart={e => { noteComposing.current = true; writeRaw(runtime.store, session, "note", e.currentTarget.value, true); }}
        onCompositionEnd={e => { noteComposing.current = false; writeRaw(runtime.store, session, "note", e.currentTarget.value, false); }} />}
    </DocumentField>
  </div>;
}
