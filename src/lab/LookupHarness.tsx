import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz, type ColDef } from "ag-grid-community";
import type { DockviewPanelApi } from "dockview";
import { useWorkspace } from "../app/workspace/WorkspaceContext";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { LookupOverlayHost } from "../shared/lookup/LookupOverlayHost";
import { ProductLookup } from "../shared/lookup/ProductLookup";
import {
  ProductLookupCellEditor,
  suppressProductLookupKeyboard,
} from "../shared/grid/ProductLookupCellEditor";
import {
  emptyLookup,
  lookupIssue,
  type LookupScope,
} from "../shared/lookup/lookupTypes";
import { publishLookup } from "../shared/lookup/sessionLookup";
import { createFakeCatalogPort } from "../infrastructure/fake/fakeCatalogPort";
function Field({
  scope,
  field,
  label,
}: {
  scope: LookupScope;
  field: string;
  label: string;
}) {
  const w = useWorkspace();
  const value = useStore(
    w.store,
    (s) => s.sessions[scope.sessionId]?.lookupBuffers?.[field] ?? emptyLookup,
  );
  const port = useMemo(
    () =>
      createFakeCatalogPort(
        scope.catalogContext === "empty"
          ? "empty-catalog"
          : scope.catalogContext === "error"
            ? "catalog-error"
            : "lookup-many",
      ),
    [scope.catalogContext],
  );
  return (
    <>
      <ProductLookup
        scope={scope}
        label={label}
        port={port}
        value={value}
        onChange={(v) => publishLookup(w.store, scope, field, v)}
      />
      <p data-testid={field === "product:field" ? "field-selected" : undefined}>
        ID: {value.selectedId ?? "∅"}
      </p>
    </>
  );
}
export function LookupHarness({
  sessionId,
  api,
}: {
  sessionId: string;
  api: DockviewPanelApi;
}) {
  const w = useWorkspace();
  const session = useStore(w.store, (s) => s.sessions[sessionId]);
  const [visible, setVisible] = useState(api.isVisible);
  const [modal, setModal] = useState(false);
  const [context, setContext] = useState("default");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const sub = api.onDidVisibilityChange((e) => setVisible(e.isVisible));
    return () => sub.dispose();
  }, [api]);
  const scope = useMemo(
    () => ({
      ...session,
      sessionId,
      clientLineId: "field",
      catalogContext: context,
    }),
    [
      sessionId,
      session.generation,
      session.actorKey,
      session.actorGeneration,
      context,
    ],
  );
  const rows = useMemo(
    () =>
      session.draft!.lines.slice(0, 2).map((line) => ({
        clientLineId: line.clientLineId,
        productId: null,
        note: "",
      })),
    [sessionId],
  );
  const port = useMemo(
    () =>
      createFakeCatalogPort(
        context === "empty"
          ? "empty-catalog"
          : context === "error"
            ? "catalog-error"
            : "lookup-many",
      ),
    [context],
  );
  const grid = useRef<AgGridReact<(typeof rows)[number]>>(null);
  useEffect(() => {
    grid.current?.api?.refreshCells({ columns: ["productId"] });
  }, [session.lookupBuffers]);
  const columns = useMemo<ColDef<(typeof rows)[number]>[]>(
    () => [
      {
        field: "productId",
        headerName: "Sản phẩm lookup",
        width: 400,
        editable: true,
        suppressKeyboardEvent: suppressProductLookupKeyboard,
        cellEditor: ProductLookupCellEditor,
        cellEditorParams: (p: { data: (typeof rows)[number] }) => ({
          store: w.store,
          scope: { ...scope, clientLineId: p.data.clientLineId },
          field: `product:${p.data.clientLineId}`,
          port,
        }),
        valueGetter: (p) =>
          w.store.getState().sessions[sessionId]?.lookupBuffers?.[
            `product:${p.data!.clientLineId}`
          ]?.selectedId ?? null,
        valueFormatter: (p) =>
          w.store.getState().sessions[sessionId]?.lookupBuffers?.[
            `product:${p.data!.clientLineId}`
          ]?.displayText || "Chọn sản phẩm",
      },
      { field: "note", headerName: "Ô kế tiếp", editable: true, width: 220 },
    ],
    [w, scope, port],
  );
  return (
    <LookupOverlayHost visible={visible}>
      <div
        className="flex h-full min-h-0 flex-col gap-2 p-4"
        data-testid="lookup-harness"
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setModal(true)}>
            Mở modal lookup
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const values = Object.values(
                w.store.getState().sessions[sessionId].lookupBuffers ?? {},
              );
              setMessage(
                values.map((v) => lookupIssue(v)).find(Boolean) ??
                  "Lookup hợp lệ; chưa chạy Save barrier.",
              );
            }}
          >
            Kiểm tra Save lookup
          </Button>
          <label>
            Danh mục{" "}
            <select
              aria-label="Danh mục lookup"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            >
              <option value="default">Mặc định</option>
              <option value="empty">Rỗng</option>
              <option value="error">Lỗi</option>
            </select>
          </label>
        </div>
        {message && <p role="alert">{message}</p>}
        <Field scope={scope} field="product:field" label="Sản phẩm field" />
        <div className="min-h-0 flex-1">
          <AgGridReact
            ref={grid}
            theme={themeQuartz}
            rowData={rows}
            columnDefs={columns}
            getRowId={(p) => p.data.clientLineId}
            stopEditingWhenCellsLoseFocus
            rowHeight={110}
          />
        </div>
      </div>
      <Dialog open={modal && visible} onOpenChange={setModal}>
        <DialogContent>
          <DialogTitle>Lookup trong modal</DialogTitle>
          <DialogDescription>
            Chọn sản phẩm, Escape đóng danh sách trước.
          </DialogDescription>
          <LookupOverlayHost>
            <Field
              scope={{ ...scope, clientLineId: "modal" }}
              field="product:modal"
              label="Sản phẩm modal"
            />
          </LookupOverlayHost>
        </DialogContent>
      </Dialog>
    </LookupOverlayHost>
  );
}
