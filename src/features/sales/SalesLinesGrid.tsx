import { useEffect, useMemo, useState, type RefObject } from "react";
import { useStore } from "zustand";
import { AgGridReact } from "ag-grid-react";
import {
  themeQuartz,
  type ColDef,
  type GridState,
  type SuppressKeyboardEventParams,
} from "ag-grid-community";
import type { DockviewPanelApi } from "dockview";
import type { WorkspaceRuntime } from "../../app/workspace/panelRegistry";
import { DecimalCellEditor } from "../../shared/grid/DecimalCellEditor";
import {
  ProductLookupCellEditor,
  suppressProductLookupKeyboard,
} from "../../shared/grid/ProductLookupCellEditor";
import { emptyLookup } from "../../shared/lookup/lookupTypes";
import { createFakeCatalogPort } from "../../infrastructure/fake/fakeCatalogPort";
import { canEdit } from "./salesSessionStore";
import { editDraft } from "./sessionEditing";
import { lineAmount, parseDecimal } from "./decimal";
import type { SalesLineDraft } from "./contracts";
export function SalesLinesGrid({
  workspace,
  sessionId,
  api,
  gridRef,
}: {
  workspace: WorkspaceRuntime;
  sessionId: string;
  api: DockviewPanelApi;
  gridRef: RefObject<AgGridReact<SalesLineDraft> | null>;
}) {
  const session = useStore(workspace.store, (s) => s.sessions[sessionId]);
  const [initialState] = useState(session.view.grid);
  const port = useMemo(() => createFakeCatalogPort(), []);
  useEffect(
    () =>
      workspace.barrier.register(sessionId, async () => {
        const grid = gridRef.current?.api;
        if (!grid) return;
        grid.stopEditing();
        if (grid.getEditingCells().length)
          throw Error(
            "Editor chưa xác nhận kết thúc.",
          ); // Decimal/lookup raw is already in the session before stopEditing.
        // Gift uses the public readOnlyEdit callback; browser interaction order
        // is covered separately, not claimed synchronous within one JS turn.
      }),
    [workspace, sessionId, gridRef],
  );
  useEffect(() => {
    gridRef.current?.api?.refreshCells({
      columns: ["product", "unit", "qty", "unitPrice", "amount"],
    });
  }, [
    session.rawBuffers,
    session.lookupBuffers,
    session.preparing,
    session.mutation,
    gridRef,
  ]);
  useEffect(() => {
    gridRef.current?.api?.refreshCells({ columns: ["isGift"], force: true });
  }, [session.preparing, session.mutation, session.draft, gridRef]);
  const columns = useMemo<ColDef<SalesLineDraft>[]>(
    () => [
      {
        colId: "index",
        headerName: "STT",
        width: 65,
        valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      },
      {
        colId: "product",
        field: "productId",
        headerName: "Sản phẩm",
        width: 300,
        editable: () => canEdit(workspace.store.getState().sessions[sessionId]),
        cellEditor: ProductLookupCellEditor,
        suppressKeyboardEvent: (p) => {
          if (p.editing && p.event.key === "Tab") {
            const target = p.event.target as HTMLElement;
            if (p.event.isComposing || target.dataset.composing === "true") {
              p.event.preventDefault();
              return true;
            }
            // Leave edit mode before navigation, so Tab visits every column
            // instead of starting the next editable cell's local editor.
            p.event.preventDefault();
            p.api.stopEditing();
            if (p.event.shiftKey) p.api.tabToPreviousCell();
            else p.api.tabToNextCell();
            return true;
          }
          return suppressProductLookupKeyboard(p);
        },
        valueGetter: (p) =>
          workspace.store.getState().sessions[sessionId].lookupBuffers?.[
            `product:${p.data!.clientLineId}`
          ]?.selectedId ?? p.data?.productId,
        valueFormatter: (p) => {
          const s = workspace.store.getState().sessions[sessionId];
          const v = s.lookupBuffers?.[`product:${p.data!.clientLineId}`];
          return v
            ? v.displayText || "Chưa chọn sản phẩm"
            : (s.baseline?.lines.find(
                (l) => l.clientLineId === p.data?.clientLineId,
              )?.product.name ??
                s.baseline?.lines.find((l) => l.productId === p.data?.productId)
                  ?.product.name ??
                "Chưa chọn sản phẩm");
        },
        cellEditorParams: (p: { data: SalesLineDraft }) => {
          const s = workspace.store.getState().sessions[sessionId];
          const ref =
            s.baseline?.lines.find(
              (l) => l.clientLineId === p.data.clientLineId,
            )?.product ??
            s.baseline?.lines.find((l) => l.productId === p.data.productId)
              ?.product;
          return {
            store: workspace.store,
            commitToColumn: "qty",
            scope: {
              ...s,
              clientLineId: p.data.clientLineId,
              catalogContext: "sales-product",
            },
            field: `product:${p.data.clientLineId}`,
            port,
            initialLookup: ref
              ? {
                  selectedId: ref.id,
                  displayText: ref.name,
                  query: ref.name,
                  confirmed: true,
                  composing: false,
                }
              : emptyLookup,
          };
        },
      },
      {
        colId: "unit",
        headerName: "Đơn vị tính",
        width: 110,
        valueGetter: (p) => {
          const s = workspace.store.getState().sessions[sessionId];
          const selected = s.lookupBuffers?.[`product:${p.data!.clientLineId}`];
          if (selected && selected.selectedId !== p.data?.productId) return "—";
          return (
            (
              s.baseline?.lines.find(
                (l) =>
                  l.clientLineId === p.data?.clientLineId &&
                  l.productId === p.data?.productId,
              ) ??
              s.baseline?.lines.find((l) => l.productId === p.data?.productId)
            )?.unit ?? "—"
          );
        },
      },
      ...(["qty", "unitPrice"] as const).map((kind) => ({
        field: kind,
        headerName: kind === "qty" ? "Số lượng" : "Đơn giá bán",
        width: 220,
        editable: () => canEdit(workspace.store.getState().sessions[sessionId]),
        valueGetter: (p: { data?: SalesLineDraft }) => {
          const s = workspace.store.getState().sessions[sessionId];
          return s.rawBuffers[`${kind}:${p.data!.clientLineId}`]?.raw ?? p.data?.[kind];
        },
        cellEditor: DecimalCellEditor,
        cellEditorParams: (p: { data: SalesLineDraft; node: { rowIndex: number } }) => ({
          workspace, identity: workspace.store.getState().sessions[sessionId],
          lineId: p.data.clientLineId, kind, row: p.node.rowIndex,
        }),
        suppressKeyboardEvent: (p: SuppressKeyboardEventParams<SalesLineDraft>) => {
          const target = p.event.target as HTMLElement;
          if (!(target instanceof HTMLInputElement)) return false;
          const composing = p.event.isComposing || target.dataset.composing === "true";
          if (composing) {
            if (p.event.key === "Tab") p.event.preventDefault();
            return true;
          }
          if (p.event.key === "Tab") {
            p.event.preventDefault();
            p.api.stopEditing();
            if (p.event.shiftKey) p.api.tabToPreviousCell();
            else p.api.tabToNextCell();
            return true;
          }
          if (p.event.key === "Enter") {
            p.event.preventDefault();
            p.api.stopEditing();
            p.api.setFocusedCell(p.node.rowIndex!, kind);
            return true;
          }
          return p.event.key !== "Escape";
        },
      })),
      {
        field: "isGift",
        cellClass: "sales-gift-cell",
        headerName: "Tặng",
        width: 85,
        cellRenderer: "agCheckboxCellRenderer",
        editable: false,
        cellRendererParams: () => ({
          disabled: !canEdit(workspace.store.getState().sessions[sessionId]),
        }),
        // The provided renderer publishes click/Space immediately. Do not
        // expose the provided editor, whose local value only publishes on stop.
        suppressKeyboardEvent: ({ event }) =>
          !["Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
            event.key,
          ),
      },
      {
        colId: "amount",
        headerName: "Thành tiền",
        width: 240,
        valueGetter: (p) => {
          const s = workspace.store.getState().sessions[sessionId],
            line = p.data!;
          try {
            return lineAmount(
              parseDecimal(
                s.rawBuffers[`qty:${line.clientLineId}`]?.raw ?? line.qty,
                "qty",
              ),
              parseDecimal(
                s.rawBuffers[`unitPrice:${line.clientLineId}`]?.raw ??
                  line.unitPrice,
                "unitPrice",
              ),
              line.isGift,
            );
          } catch {
            return "Chưa hợp lệ";
          }
        },
      },
    ],
    [workspace, sessionId, port],
  );
  function persist(state: GridState, scrollChanged = false) {
    if (!api.isVisible || !gridRef.current?.api) return;
    const scroll =
      workspace.store.getState().sessions[sessionId]?.view.grid?.scroll;
    workspace.setGridState(
      sessionId,
      scrollChanged ? state : { ...state, scroll: scroll ?? state.scroll },
    );
  }
  return (
    <AgGridReact<SalesLineDraft>
      ref={gridRef}
      theme={themeQuartz}
      rowData={session.draft!.lines as SalesLineDraft[]}
      columnDefs={columns}
      getRowId={(p) => p.data.clientLineId}
      initialState={initialState}
      readOnlyEdit
      suppressClickEdit
      onCellDoubleClicked={(e) => {
        if (
          ["product", "qty", "unitPrice"].includes(e.column.getColId()) &&
          canEdit(workspace.store.getState().sessions[sessionId]) &&
          !e.api.getEditingCells().some((cell) => cell.rowIndex === e.node.rowIndex && cell.column === e.column)
        )
          e.api.startEditingCell({
            rowIndex: e.node.rowIndex!,
            colKey: e.column.getColId(),
          });
      }}
      stopEditingWhenCellsLoseFocus
      onCellEditRequest={(e) => {
        if (e.colDef.field === "isGift")
          editDraft(workspace.store, session, (d) => ({
            ...d,
            lines: d.lines.map((l) =>
              l.clientLineId === e.data.clientLineId
                ? { ...l, isGift: !!e.newValue }
                : l,
            ),
          }));
      }}
      onBodyScroll={(e) =>
        persist(
          { ...e.api.getState(), scroll: { top: e.top, left: e.left } },
          true,
        )
      }
      onStateUpdated={(e) => persist(e.state)}
      onGridPreDestroyed={(e) => persist(e.state)}
    />
  );
}
