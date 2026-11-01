import { useMemo, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz, type ColDef } from "ag-grid-community";
import { useWorkspace } from "../../app/workspace/WorkspaceContext";
import { hasModuleCapability } from "../../app/runtime/moduleCapabilities";
import { getStyleNonce } from "../../app/styleNonce";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { ProductLookup } from "../../shared/lookup/ProductLookup";
import { LookupOverlayHost } from "../../shared/lookup/LookupOverlayHost";
import { emptyLookup, type LookupValue } from "../../shared/lookup/lookupTypes";
import { useGoodsReceipt } from "./GoodsReceiptContext";
import type { GoodsReceiptDocument, GoodsReceiptListQuery } from "./contracts";
const columns: ColDef<GoodsReceiptDocument>[] = [
  { field: "receiptId", headerName: "Receipt ID", width: 200 }, { field: "receiptNumber", headerName: "Số phiếu nhập", minWidth: 170, flex: 1 },
  { colId: "receiptDate", headerName: "Ngày nhập", width: 130, valueGetter: p => p.data?.saved.receiptDate },
  { field: "status", headerName: "Trạng thái", width: 120 }, { colId: "warehouse", headerName: "Kho", width: 190, valueGetter: p => p.data?.references.warehouse.displayName ?? `ID ${p.data?.references.warehouse.id}` },
];
const empty: GoodsReceiptDocument[] = [];
export function GoodsReceiptListPanel() {
  const runtime = useGoodsReceipt(), workspace = useWorkspace(), auth = useSyncExternalStore(workspace.auth.subscribe, workspace.auth.getSnapshot);
  const [query, setQuery] = useState<GoodsReceiptListQuery>({ pageNumber: 1, pageSize: 25 }), [warehouse, setWarehouse] = useState<LookupValue>(emptyLookup);
  const actor = workspace.portContext(), readable = hasModuleCapability(auth, actor, "goods-receipt", "read");
  const scope = useMemo(() => ({ ...actor, sessionId: "receipt-list", generation: actor.actorGeneration, clientLineId: "warehouseId", catalogContext: "receipt-list", catalogKind: "warehouse" as const }), [actor.deploymentEpoch, actor.actorKey, actor.actorGeneration]);
  const result = useQuery({ queryKey: ["goods-receipt-list", actor.actorKey, actor.actorGeneration, query, ...(actor.deploymentEpoch === undefined ? [] : [actor.deploymentEpoch])], enabled: readable, retry: false,
    queryFn: async ({ signal }) => { const r = await runtime.port.list(query, { ...actor, signal }); if (r.kind === "failed") throw Error(r.error.message); return r.value; } });
  const page = readable && !result.isError ? result.data : undefined;
  const hasNext = !!page && page.pageNumber < 2147483647 && BigInt(page.pageNumber) * BigInt(page.pageSize) < BigInt(page.totalCount);
  return <LookupOverlayHost><section aria-label="Danh sách phiếu nhập" className="flex h-full min-h-0 flex-col overflow-auto">
    <div className="flex flex-wrap items-end gap-3 p-4">
      <label className="min-w-40 flex-1">Tìm phiếu nhập<Input aria-label="Tìm phiếu nhập" value={query.search ?? ""} onChange={e => setQuery(q => ({ ...q, search: e.target.value || undefined, pageNumber: 1 }))} /></label>
      <div className="min-w-40 flex-1"><ProductLookup label="Lọc kho" scope={scope} port={runtime.catalog} value={warehouse} disabled={!readable} onChange={value => { setWarehouse(value); setQuery(q => ({ ...q, warehouseId: value.confirmed && value.selectedId ? value.selectedId : undefined, pageNumber: 1 })); }} /></div>
      <label className="min-w-32 flex-1">Trạng thái<NativeSelect aria-label="Lọc trạng thái phiếu nhập" className="w-full" value={query.status ?? ""} onChange={e => setQuery(q => ({ ...q, status: (e.target.value || undefined) as GoodsReceiptListQuery["status"], pageNumber: 1 }))}>
        <NativeSelectOption value="">Tất cả</NativeSelectOption><NativeSelectOption>Draft</NativeSelectOption><NativeSelectOption>Posted</NativeSelectOption>
      </NativeSelect></label>
    </div>
    {!readable && <p role="alert" className="px-4">Không có quyền đọc danh sách phiếu nhập.</p>}
    {result.isError && <p role="alert" className="px-4">{result.error.message}</p>}
    {page && !page.items.length && <p role="status" className="px-4">Không có phiếu nhập.</p>}
    <div className="min-h-64 flex-1" data-testid="goods-receipt-list-grid"><AgGridReact<GoodsReceiptDocument> styleNonce={getStyleNonce()} theme={themeQuartz} columnDefs={columns} rowData={page?.items as GoodsReceiptDocument[] ?? empty}
      loading={readable && result.isPending} getRowId={p => p.data.receiptId}
      onRowDoubleClicked={e => { if (readable && page && e.data) void workspace.openDocument("goods-receipt", e.data.receiptId); }}
      onCellKeyDown={e => { if (readable && page && e.data && (e.event as KeyboardEvent)?.key === "Enter") void workspace.openDocument("goods-receipt", e.data.receiptId); }} /></div>
    <div className="flex flex-wrap items-center gap-2 p-4 text-sm">
      <Button variant="outline" disabled={!page || page.pageNumber <= 1 || result.isFetching} onClick={() => setQuery(q => ({ ...q, pageNumber: q.pageNumber - 1 }))}>Trang trước</Button>
      <Button variant="outline" disabled={!hasNext || result.isFetching} onClick={() => setQuery(q => ({ ...q, pageNumber: q.pageNumber + 1 }))}>Trang sau</Button>
      <label>Số dòng mỗi trang<NativeSelect aria-label="Số dòng mỗi trang" value={query.pageSize} onChange={e => setQuery(q => ({ ...q, pageNumber: 1, pageSize: Number(e.target.value) }))}>{[25, 50, 100, 200].map(n => <NativeSelectOption key={n} value={n}>{n}</NativeSelectOption>)}</NativeSelect></label>
      <Button variant="outline" disabled={!readable || result.isFetching} onClick={() => void result.refetch()}>Tải lại danh sách phiếu nhập</Button>
      {page && <span>{page.items.length} phiếu trên trang {page.pageNumber} · Tổng {page.totalCount}</span>}
    </div>
  </section></LookupOverlayHost>;
}
