import { useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridState,
  type ICellRendererParams,
} from "ag-grid-community";
import type { IDockviewPanelProps } from "dockview";
import { useWorkspace } from "../../app/workspace/WorkspaceContext";
import type { WorkspaceRuntime } from "../../app/workspace/panelRegistry";
import { Input } from "../../components/ui/input";
import type { SalesLineDraft } from "./contracts";

ModuleRegistry.registerModules([AllCommunityModule]);
interface GridContext {
  workspace: WorkspaceRuntime;
  sessionId: string;
}
function RawQuantity({
  data,
  node,
  context,
}: ICellRendererParams<SalesLineDraft, string, GridContext>) {
  const field = `qty:${data!.clientLineId}`;
  const buffer = useStore(
    context.workspace.store,
    (state) => state.sessions[context.sessionId]?.rawBuffers[field],
  );
  return (
    <Input
      aria-label={`Số lượng dòng ${node.rowIndex! + 1}`}
      data-line-id={data!.clientLineId}
      value={buffer?.raw ?? data!.qty}
      onChange={(event) =>
        context.workspace.writeBuffer(
          context.sessionId,
          field,
          event.target.value,
          buffer?.composing,
        )
      }
      onCompositionStart={(event) =>
        context.workspace.writeBuffer(
          context.sessionId,
          field,
          event.currentTarget.value,
          true,
        )
      }
      onCompositionEnd={(event) =>
        context.workspace.writeBuffer(
          context.sessionId,
          field,
          event.currentTarget.value,
          false,
        )
      }
    />
  );
}

export function SalesDocumentPanel({
  params,
  api,
}: IDockviewPanelProps<{ sessionId: string }>) {
  const workspace = useWorkspace();
  const session = useStore(
    workspace.store,
    (state) => state.sessions[params.sessionId],
  );
  const root = useRef<HTMLElement>(null);
  const [initialState] = useState(() => session?.view.grid);
  const context = useMemo(
    () => ({ workspace, sessionId: params.sessionId }),
    [workspace, params.sessionId],
  );
  const columns = useMemo<ColDef<SalesLineDraft>[]>(
    () => [
      {
        colId: "product",
        headerName: "Sản phẩm",
        width: 300,
        valueGetter: ({ data }) =>
          session?.baseline?.lines.find(
            (line) => line.clientLineId === data?.clientLineId,
          )?.product.name ?? "Chưa chọn sản phẩm",
      },
      {
        field: "qty",
        headerName: "Số lượng · raw harness",
        width: 220,
        cellRenderer: RawQuantity,
        cellRendererParams: { suppressMouseEventHandling: () => true },
        suppressKeyboardEvent: () => true,
      },
      { field: "unitPrice", headerName: "Đơn giá mẫu", width: 240 },
      { field: "saleLineId", headerName: "Mã dòng", width: 240 },
    ],
    [session?.baseline],
  );
  const persistView = (state: GridState, scrollChanged = false) => {
    if (
      api.isVisible &&
      root.current &&
      root.current.clientWidth > 0 &&
      root.current.clientHeight > 0
    ) {
      // AG Grid caches scroll on bodyScrollEnd; another state event can still
      // carry the previous scroll position while the user is scrolling.
      const scroll =
        workspace.store.getState().sessions[params.sessionId]?.view.grid
          ?.scroll;
      workspace.setGridState(
        params.sessionId,
        scrollChanged ? state : { ...state, scroll: scroll ?? state.scroll },
      );
    }
  };
  if (!session) return null;
  const note = session.rawBuffers.note?.raw ?? session.draft?.note ?? "";
  return (
    <section
      ref={root}
      aria-label={`Chứng từ ${session.saleId ?? "mới"}`}
      data-session-id={session.sessionId}
      data-generation={session.generation}
      data-request-generation={session.requestGeneration}
      className="flex h-full min-h-0 flex-col"
      onFocusCapture={() => {
        api.setActive();
        workspace.commands.activate(session.sessionId);
      }}
    >
      {session.status === "loading" ? (
        <p role="status">Đang đọc chứng từ…</p>
      ) : session.status === "failed" ? (
        <p role="alert">{session.error?.message}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 p-4">
            <label
              className="min-w-0 flex-1"
              htmlFor={`note-${session.sessionId}`}
            >
              Ghi chú
              <Input
                id={`note-${session.sessionId}`}
                value={note}
                onChange={(event) =>
                  workspace.writeBuffer(
                    session.sessionId,
                    "note",
                    event.target.value,
                    session.rawBuffers.note?.composing,
                  )
                }
                onCompositionStart={(event) =>
                  workspace.writeBuffer(
                    session.sessionId,
                    "note",
                    event.currentTarget.value,
                    true,
                  )
                }
                onCompositionEnd={(event) =>
                  workspace.writeBuffer(
                    session.sessionId,
                    "note",
                    event.currentTarget.value,
                    false,
                  )
                }
              />
            </label>
            <span>{session.dirty ? "Chưa lưu" : "Chưa thay đổi"}</span>
            <span>Lệnh đã nhận: {session.commandCount}</span>
          </div>
          <div className="min-h-0 flex-1">
            <AgGridReact<SalesLineDraft>
              theme={themeQuartz}
              rowData={session.draft!.lines as SalesLineDraft[]}
              columnDefs={columns}
              context={context}
              getRowId={({ data }) => data.clientLineId}
              initialState={initialState}
              onBodyScroll={(event) =>
                persistView(
                  {
                    ...event.api.getState(),
                    scroll: { top: event.top, left: event.left },
                  },
                  true,
                )
              }
              onStateUpdated={(event) => persistView(event.state)}
              onGridPreDestroyed={(event) => persistView(event.state)}
            />
          </div>
        </>
      )}
    </section>
  );
}
