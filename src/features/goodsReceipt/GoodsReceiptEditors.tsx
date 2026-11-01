import { useLayoutEffect, useRef } from "react";
import { useStore } from "zustand";
import type { CustomCellEditorProps } from "ag-grid-react";
import { Input } from "../../components/ui/input";
import { ProductLookup } from "../../shared/lookup/ProductLookup";
import { emptyLookup, typeQuery, type LookupValue } from "../../shared/lookup/lookupTypes";
import type { GoodsReceiptRuntime } from "./GoodsReceiptContext";
import { canEdit, type SessionIdentity } from "./goodsReceiptSessionStore";
import { writeRaw, restoreRaw, writeLookup, restoreLookup } from "./sessionEditing";
import { receiptFieldErrorAttributes } from "./fieldErrors";
interface Binding { runtime: GoodsReceiptRuntime; identity: SessionIdentity; lineId: string; row: number; }
export function GoodsReceiptDecimalEditor(props: CustomCellEditorProps & Binding & { kind: "quantity" | "unitCost" }) {
  // AG Grid refresh can omit custom params: bind this editor's entire lifetime.
  const { runtime, identity, lineId, row, kind, eventKey } = useRef(props).current;
  const session = useStore(runtime.store, s => s.sessions[identity.sessionId]);
  const field = `${kind}:${lineId}`, original = useRef(session?.rawBuffers[field]), composing = useRef(false);
  const line = session?.draft?.lines.find(l => l.clientLineId === lineId);
  function publish(raw: string, composition = false) { if (writeRaw(runtime.store, identity, field, raw, composition)) props.onValueChange(raw); }
  const started = useRef(false);
  useLayoutEffect(() => { if (!started.current) { started.current = true; if (eventKey?.length === 1) publish(eventKey); } }, []);
  if (!session || !line) return null;
  return <Input autoFocus tabIndex={-1} inputMode="decimal" aria-label={`${kind === "quantity" ? "Số lượng" : "Đơn giá nhập"} dòng ${row + 1}`}
    {...receiptFieldErrorAttributes(session, field)}
    disabled={!canEdit(session)} data-composing={session.rawBuffers[field]?.composing ?? false} data-line-id={lineId}
    value={session.rawBuffers[field]?.raw ?? line[kind]} onChange={e => publish(e.target.value, composing.current)}
    onCompositionStart={e => { composing.current = true; publish(e.currentTarget.value, true); }}
    onCompositionEnd={e => { composing.current = false; publish(e.currentTarget.value, false); }}
    onKeyDownCapture={e => { if (e.key === "Escape" && !composing.current && !e.nativeEvent.isComposing) restoreRaw(runtime.store, identity, field, original.current); }} />;
}
export function GoodsReceiptProductEditor(props: CustomCellEditorProps & Binding & { initialLookup: LookupValue }) {
  const { runtime, identity, lineId, initialLookup, eventKey } = useRef(props).current;
  const field = `product:${lineId}`;
  const original = useRef(runtime.store.getState().sessions[identity.sessionId]?.lookupBuffers?.[field] ?? initialLookup);
  const session = useStore(runtime.store, s => s.sessions[identity.sessionId]);
  const value = session?.lookupBuffers?.[field] ?? initialLookup ?? emptyLookup;
  const started = useRef(false);
  useLayoutEffect(() => { if (!started.current) { started.current = true; if (eventKey && Array.from(eventKey).length === 1 && !/[\p{C}]/u.test(eventKey)) writeLookup(runtime.store, identity, field, typeQuery(value, eventKey)); } }, []);
  const errors = session ? receiptFieldErrorAttributes(session, field) : undefined;
  return <ProductLookup presentation="cell" label="Sản phẩm grid" autoFocus disabled={!canEdit(session)} invalid={errors?.["aria-invalid"]} describedBy={errors?.["aria-describedby"]}
    scope={{ ...identity, clientLineId: lineId, catalogContext: "receipt-grid", catalogKind: "product" }} port={runtime.catalog} value={value}
    onChange={next => { if (writeLookup(runtime.store, identity, field, next)) props.onValueChange(next.selectedId); }}
    onCommitSelection={next => {
      if (!writeLookup(runtime.store, identity, field, next)) return;
      props.onValueChange(next.selectedId); props.api.stopEditing();
      const row = props.api.getRowNode(lineId)?.rowIndex;
      if (row != null) { props.api.ensureIndexVisible(row); props.api.ensureColumnVisible("quantity"); props.api.setFocusedCell(row, "quantity"); }
    }}
    onCancelEdit={() => { restoreLookup(runtime.store, identity, field, original.current); props.onValueChange(original.current.selectedId); }} />;
}
