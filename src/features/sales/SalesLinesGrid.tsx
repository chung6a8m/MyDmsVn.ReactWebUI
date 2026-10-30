import { useEffect, useMemo, useState, type RefObject } from "react";
import { useStore } from "zustand";
import { AgGridReact } from "ag-grid-react";
import {
  themeQuartz,
  type ColDef,
  type GridState,
  type ICellRendererParams,
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
          ); /* Every adapter publishes to the session synchronously, before this acknowledgement. */
      }),
    [workspace, sessionId, gridRef],
  );
  useEffect(() => {
    gridRef.current?.api?.refreshCells({
      columns: ["product", "unit", "amount"],
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
        suppressKeyboardEvent: suppressProductLookupKeyboard,
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
        cellRenderer: (p: ICellRendererParams<SalesLineDraft>) => (
          <DecimalCellEditor
            workspace={workspace}
            identity={workspace.store.getState().sessions[sessionId]}
            lineId={p.data!.clientLineId}
            kind={kind}
            row={p.node.rowIndex!}
          />
        ),
        cellRendererParams: { suppressMouseEventHandling: () => true },
        suppressKeyboardEvent: () => true,
      })),
      {
        field: "isGift",
        headerName: "Tặng",
        width: 85,
        cellRenderer: "agCheckboxCellRenderer",
        editable: () => canEdit(workspace.store.getState().sessions[sessionId]),
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
          e.column.getColId() === "product" &&
          canEdit(workspace.store.getState().sessions[sessionId])
        )
          e.api.startEditingCell({
            rowIndex: e.node.rowIndex!,
            colKey: "product",
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
