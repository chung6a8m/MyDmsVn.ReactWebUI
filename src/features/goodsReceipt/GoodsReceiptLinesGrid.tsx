import { useEffect, useMemo, useState, type RefObject } from "react";
import { useStore } from "zustand";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz, type ColDef, type GridState } from "ag-grid-community";
import type { DockviewPanelApi } from "dockview";
import { getStyleNonce } from "../../app/styleNonce";
import { suppressProductLookupKeyboard } from "../../shared/grid/ProductLookupCellEditor";
import { emptyLookup } from "../../shared/lookup/lookupTypes";
import type { GoodsReceiptLineDraft } from "./contracts";
import { useGoodsReceipt } from "./GoodsReceiptContext";
import { canEdit } from "./goodsReceiptSessionStore";
import { GoodsReceiptDecimalEditor, GoodsReceiptProductEditor } from "./GoodsReceiptEditors";
import { previewLineAmount } from "./decimal";
export function GoodsReceiptLinesGrid({ sessionId, api, gridRef, onCurrentLine }: { sessionId: string; api: DockviewPanelApi; gridRef: RefObject<AgGridReact<GoodsReceiptLineDraft> | null>; onCurrentLine(id: string): void }) {
  const runtime = useGoodsReceipt(), session = useStore(runtime.store, s => s.sessions[sessionId]);
  const [initialState] = useState(session.view.grid);
  useEffect(() => runtime.barrier.register(sessionId, async () => {
    const grid = gridRef.current?.api; grid?.stopEditing();
    if (grid?.getEditingCells().length) throw Error("Editor chưa xác nhận kết thúc.");
  }), [runtime, sessionId, gridRef]);
  useEffect(() => { gridRef.current?.api?.refreshCells({ force: true }); }, [session.rawBuffers, session.lookupBuffers, session.preparing, session.mutation, session.capabilities, session.baseline, gridRef]);
  useEffect(() => {
    const sub = api.onDidVisibilityChange(() => { if (!api.isVisible) gridRef.current?.api?.stopEditing(); });
    return () => sub.dispose();
  }, [api, gridRef]);
  const columns = useMemo<ColDef<GoodsReceiptLineDraft>[]>(() => [
    { colId: "index", headerName: "STT", width: 65, valueGetter: p => (p.node?.rowIndex ?? 0) + 1 },
    { colId: "product", field: "productId", headerName: "Sản phẩm", width: 300,
      editable: () => canEdit(runtime.store.getState().sessions[sessionId]), cellEditor: GoodsReceiptProductEditor,
      suppressKeyboardEvent: p => {
        if (p.editing && p.event.key === "Tab") {
          p.event.preventDefault(); if (p.event.isComposing || (p.event.target as HTMLElement).dataset.composing === "true") return true;
          p.api.stopEditing(); if (p.event.shiftKey) p.api.tabToPreviousCell(); else p.api.tabToNextCell(); return true;
        }
        return suppressProductLookupKeyboard(p);
      },
      valueGetter: p => runtime.store.getState().sessions[sessionId].lookupBuffers?.[`product:${p.data!.clientLineId}`]?.selectedId ?? p.data?.productId,
      valueFormatter: p => {
        const s = runtime.store.getState().sessions[sessionId], line = s.baseline?.lines.find(l => l.clientLineId === p.data?.clientLineId);
        return s.lookupBuffers?.[`product:${p.data!.clientLineId}`]?.displayText || line?.product.displayName || (p.value ? `ID ${p.value}` : "Chưa chọn sản phẩm");
      },
      cellEditorParams: (p: { data: GoodsReceiptLineDraft; node: { rowIndex: number } }) => {
        const s = runtime.store.getState().sessions[sessionId], ref = s.baseline?.lines.find(l => l.clientLineId === p.data.clientLineId)?.product;
        const text = ref?.displayName ?? (ref ? `ID ${ref.id}` : "");
        return { runtime, identity: s, lineId: p.data.clientLineId, row: p.node.rowIndex,
          initialLookup: ref ? { selectedId: ref.id, displayText: text, query: text, confirmed: true, composing: false } : emptyLookup };
      },
    },
    ...(["quantity", "unitCost"] as const).map(kind => ({ colId: kind, field: kind, headerName: kind === "quantity" ? "Số lượng" : "Đơn giá nhập", width: 220,
      editable: () => canEdit(runtime.store.getState().sessions[sessionId]),
      valueGetter: (p: { data?: GoodsReceiptLineDraft }) => runtime.store.getState().sessions[sessionId].rawBuffers[`${kind}:${p.data!.clientLineId}`]?.raw ?? p.data?.[kind],
      cellEditor: GoodsReceiptDecimalEditor,
      cellEditorParams: (p: { data: GoodsReceiptLineDraft; node: { rowIndex: number } }) => ({ runtime, identity: runtime.store.getState().sessions[sessionId], lineId: p.data.clientLineId, row: p.node.rowIndex, kind }),
      suppressKeyboardEvent: (p: import("ag-grid-community").SuppressKeyboardEventParams<GoodsReceiptLineDraft>) => {
        const target = p.event.target as HTMLElement;
        if (!(target instanceof HTMLInputElement)) return false;
        if (p.event.isComposing || target.dataset.composing === "true") { if (p.event.key === "Tab") p.event.preventDefault(); return true; }
        if (p.event.key === "Tab") { p.event.preventDefault(); p.api.stopEditing(); if (p.event.shiftKey) p.api.tabToPreviousCell(); else p.api.tabToNextCell(); return true; }
        if (p.event.key === "Enter") { p.event.preventDefault(); p.api.stopEditing(); p.api.setFocusedCell(p.node.rowIndex!, kind); return true; }
        return p.event.key !== "Escape";
      },
    })),
    { colId: "amount", headerName: "Thành tiền (xem trước)", width: 240, valueGetter: p => {
      const s = runtime.store.getState().sessions[sessionId], l = p.data!;
      try { return previewLineAmount(s.rawBuffers[`quantity:${l.clientLineId}`]?.raw ?? l.quantity, s.rawBuffers[`unitCost:${l.clientLineId}`]?.raw ?? l.unitCost); }
      catch { return "Chưa hợp lệ"; }
    } },
  ], [runtime, sessionId]);
  function persist(state: GridState, scrollChanged = false) {
    if (!api.isVisible || !gridRef.current?.api) return;
    const scroll = runtime.store.getState().sessions[sessionId]?.view.grid?.scroll;
    runtime.setGridState(sessionId, scrollChanged ? state : { ...state, scroll: scroll ?? state.scroll });
  }
  return <div className="h-full min-h-64" data-testid="goods-receipt-lines-grid"><AgGridReact<GoodsReceiptLineDraft>
    ref={gridRef} styleNonce={getStyleNonce()} theme={themeQuartz} rowData={session.draft!.lines as GoodsReceiptLineDraft[]} columnDefs={columns}
    initialState={initialState} getRowId={p => p.data.clientLineId} readOnlyEdit suppressClickEdit stopEditingWhenCellsLoseFocus
    onCellFocused={e => { if (e.rowIndex != null) { const line = e.api.getDisplayedRowAtIndex(e.rowIndex)?.data; if (line) onCurrentLine(line.clientLineId); } }}
    onCellDoubleClicked={e => {
      const key = e.column.getColId();
      if (["product", "quantity", "unitCost"].includes(key) && canEdit(runtime.store.getState().sessions[sessionId]) && !e.api.getEditingCells().some(cell => cell.rowIndex === e.node.rowIndex && cell.column === e.column))
        e.api.startEditingCell({ rowIndex: e.node.rowIndex!, colKey: key });
    }}
    onBodyScroll={e => persist({ ...e.api.getState(), scroll: { top: e.top, left: e.left } }, true)}
    onStateUpdated={e => persist(e.state)} onGridPreDestroyed={e => persist(e.state)} />
  </div>;
}
