import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz, type ColDef } from "ag-grid-community";
import { useWorkspace } from "../../app/workspace/WorkspaceContext";
import { hasModuleCapability } from "../../app/runtime/moduleCapabilities";
import { getStyleNonce } from "../../app/styleNonce";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { FilterBar } from "../../shared/layout/FilterBar";
import { ReadState, ReadRequestError, readErrorStatus, type ReadStatus } from "../../shared/feedback/ReadState";
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
  const workspace = useWorkspace();
  const auth = useSyncExternalStore(workspace.auth.subscribe, workspace.auth.getSnapshot);
  const actor = workspace.portContext();
  return <GoodsReceiptListView key={JSON.stringify([actor.actorKey, actor.actorGeneration, actor.deploymentEpoch])}
    actor={actor} auth={auth} />;
}

/** Keep raw filter buffers isolated across actor, generation and deployment epoch. */
function GoodsReceiptListView({
  actor, auth,
}: {
  actor: ReturnType<ReturnType<typeof useWorkspace>["portContext"]>;
  auth: ReturnType<ReturnType<typeof useWorkspace>["auth"]["getSnapshot"]>;
}) {
  const runtime = useGoodsReceipt(), workspace = useWorkspace();
  const [query, setQuery] = useState<GoodsReceiptListQuery>({ pageNumber: 1, pageSize: 25 }), [warehouse, setWarehouse] = useState<LookupValue>({ ...emptyLookup });
  const [readRevoked, setReadRevoked] = useState(false);
  const readable = hasModuleCapability(auth, actor, "goods-receipt", "read");
  const scope = useMemo(() => ({ ...actor, sessionId: "receipt-list", generation: actor.actorGeneration, clientLineId: "warehouseId", catalogContext: "receipt-list", catalogKind: "warehouse" as const }), [actor.deploymentEpoch, actor.actorKey, actor.actorGeneration]);
  const result = useQuery({ queryKey: ["goods-receipt-list", actor.actorKey, actor.actorGeneration, query, ...(actor.deploymentEpoch === undefined ? [] : [actor.deploymentEpoch])], enabled: readable && !readRevoked, retry: false,
    queryFn: async ({ signal }) => { const r = await runtime.port.list(query, { ...actor, signal });
      if (signal.aborted || !workspace.isCurrentScope(actor) || !hasModuleCapability(workspace.auth.getSnapshot(), actor, "goods-receipt", "read"))
        throw new ReadRequestError("forbidden", "Phiên đọc phiếu nhập đã thay đổi.");
      if (r.kind === "failed") throw new ReadRequestError(r.error.kind, r.error.message);
      return r.value; } });
  const denied = result.isError && readErrorStatus(result.error) === "forbidden";
  useEffect(() => { if (denied) setReadRevoked(true); }, [denied]);
  const accessDenied = denied || readRevoked;
  const page = readable && !accessDenied && !result.isError ? result.data : undefined;
  const filtered = !!(query.warehouseId || query.search || query.status);
  const status: ReadStatus = !readable || accessDenied ? "forbidden" : result.isError ? "error"
    : result.isPending ? "loading"
    : page && !page.items.length ? filtered ? "no-match" : "empty" : "ready";
  const hasNext = !!page && page.pageNumber < 2147483647 && BigInt(page.pageNumber) * BigInt(page.pageSize) < BigInt(page.totalCount);
  return <LookupOverlayHost><section aria-label="Danh sách phiếu nhập" className="flex h-full min-h-0 flex-col overflow-auto">
    <FilterBar label="Bộ lọc phiếu nhập">
      <label className="min-w-40 flex-1">Tìm phiếu nhập<Input aria-label="Tìm phiếu nhập" value={query.search ?? ""} disabled={!readable || accessDenied} onChange={e => setQuery(q => ({ ...q, search: e.target.value || undefined, pageNumber: 1 }))} /></label>
      <div className="min-w-40 flex-1"><ProductLookup label="Lọc kho" scope={scope} port={runtime.catalog} value={warehouse} disabled={!readable || accessDenied} required={false} onChange={value => {
        if (!workspace.isCurrentScope(actor)) return;
        setWarehouse(value);
        if (!value.confirmed || value.composing) return;
        const id = value.selectedId ?? undefined;
        setQuery(q => q.warehouseId === id ? q : ({ ...q, warehouseId: id, pageNumber: 1 }));
      }} /></div>
      <label className="min-w-32 flex-1">Trạng thái<NativeSelect aria-label="Lọc trạng thái phiếu nhập" className="w-full" value={query.status ?? ""} disabled={!readable || accessDenied} onChange={e => setQuery(q => ({ ...q, status: (e.target.value || undefined) as GoodsReceiptListQuery["status"], pageNumber: 1 }))}>
        <NativeSelectOption value="">Tất cả</NativeSelectOption><NativeSelectOption>Draft</NativeSelectOption><NativeSelectOption>Posted</NativeSelectOption>
      </NativeSelect></label>
    </FilterBar>
    {!warehouse.confirmed && readable && <p role="status" className="px-4 pt-1 text-xs text-muted-foreground">
      Chọn kho từ danh mục hoặc khôi phục lựa chọn để áp dụng bộ lọc.
    </p>}
    <ReadState status={status} message={(status === "error" || status === "forbidden") && result.isError ? result.error.message : undefined}
      onRetryRead={status === "error" ? () => { void result.refetch(); } : undefined} />
    <div className="min-h-64 flex-1" data-testid="goods-receipt-list-grid"><AgGridReact<GoodsReceiptDocument> styleNonce={getStyleNonce()} theme={themeQuartz} columnDefs={columns} rowData={page?.items as GoodsReceiptDocument[] ?? empty}
      loading={readable && !accessDenied && result.isPending} getRowId={p => p.data.receiptId}
      onRowDoubleClicked={e => { if (readable && !accessDenied && page && workspace.isCurrentScope(actor) && hasModuleCapability(workspace.auth.getSnapshot(), actor, "goods-receipt", "read") && e.data) void workspace.openDocument("goods-receipt", e.data.receiptId); }}
      onCellKeyDown={e => { if (readable && !denied && page && workspace.isCurrentScope(actor) && hasModuleCapability(workspace.auth.getSnapshot(), actor, "goods-receipt", "read") && e.data && (e.event as KeyboardEvent)?.key === "Enter") void workspace.openDocument("goods-receipt", e.data.receiptId); }} /></div>
    <div className="flex flex-wrap items-center gap-2 p-4 text-sm">
      <Button variant="outline" disabled={!page || page.pageNumber <= 1 || result.isFetching} onClick={() => setQuery(q => ({ ...q, pageNumber: q.pageNumber - 1 }))}>Trang trước</Button>
      <Button variant="outline" disabled={!hasNext || result.isFetching} onClick={() => setQuery(q => ({ ...q, pageNumber: q.pageNumber + 1 }))}>Trang sau</Button>
      <label>Số dòng mỗi trang<NativeSelect aria-label="Số dòng mỗi trang" value={query.pageSize} disabled={!readable || accessDenied} onChange={e => setQuery(q => ({ ...q, pageNumber: 1, pageSize: Number(e.target.value) }))}>{[25, 50, 100, 200].map(n => <NativeSelectOption key={n} value={n}>{n}</NativeSelectOption>)}</NativeSelect></label>
      <Button variant="outline" disabled={!readable || accessDenied || result.isFetching} onClick={() => void result.refetch()}>Tải lại danh sách phiếu nhập</Button>
      {page && <span>{page.items.length} phiếu trên trang {page.pageNumber} · Tổng {page.totalCount}</span>}
    </div>
  </section></LookupOverlayHost>;
}
