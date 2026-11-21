import { useId, useState, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { useQuery } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz, type ColDef } from "ag-grid-community";
import { useWorkspace } from "../../app/workspace/WorkspaceContext";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { hasModuleCapability } from "../../app/runtime/moduleCapabilities";
import { getStyleNonce } from "../../app/styleNonce";
import { ReadRequestError, ReadState, readErrorStatus, type ReadStatus } from "../../shared/feedback/ReadState";
import { FilterBar } from "../../shared/layout/FilterBar";
import { DateField } from "../../shared/inputs/DateField";
import { parseDateOnly } from "../../shared/inputs/dateOnly";
import { ProductLookup } from "../../shared/lookup/ProductLookup";
import { LookupOverlayHost } from "../../shared/lookup/LookupOverlayHost";
import { emptyLookup, type LookupValue } from "../../shared/lookup/lookupTypes";
import type { SalesListQuery, SalesPage } from "./contracts";
import type { PortContext } from "../../ports/portContracts";

type Item = SalesPage["items"][number];
const columns: ColDef<Item>[] = [
  { field: "saleId", headerName: "Sale ID", width: 200 },
  { field: "saleNumber", headerName: "Số chứng từ", flex: 1, minWidth: 180 },
  { field: "saleDate", headerName: "Ngày", width: 130 },
  { field: "status", headerName: "Trạng thái", width: 120 },
  { field: "totalAmount", headerName: "Tổng tiền", width: 170 },
];
const empty: Item[] = [];
const catalogFilters = [
  ["customerId", "customer", "Lọc khách hàng"],
  ["warehouseId", "warehouse", "Lọc kho"],
  ["employeeId", "employee", "Lọc nhân viên"],
  ["productId", "product", "Lọc sản phẩm"],
] as const;
type FilterId = (typeof catalogFilters)[number][0];
const initialBuffers = (): Record<FilterId, LookupValue> => ({
  customerId: { ...emptyLookup },
  warehouseId: { ...emptyLookup },
  employeeId: { ...emptyLookup },
  productId: { ...emptyLookup },
});

/** A new actor/epoch receives independent filters and raw lookup buffers. */
export function SalesListPanel() {
  const workspace = useWorkspace();
  const auth = useSyncExternalStore(workspace.auth.subscribe, workspace.auth.getSnapshot);
  const scope = useStore(workspace.layouts.state, s => s.scope);
  const actor = { ...workspace.portContext(), ...scope };
  const canRead = hasModuleCapability(auth, actor, "sales", "read");
  return <SalesListView
    key={JSON.stringify([actor.actorKey, actor.actorGeneration, actor.deploymentEpoch])}
    actor={actor} canRead={canRead}
  />;
}

function SalesListView({ actor, canRead }: { actor: PortContext; canRead: boolean }) {
  const workspace = useWorkspace();
  const dateId = useId();
  const [query, setQuery] = useState<SalesListQuery>({ pageSize: 25 });
  const [buffers, setBuffers] = useState(initialBuffers);
  // Text is not an ID or an applied date until a catalog selection / valid ISO date is committed.
  const [dateRaw, setDateRaw] = useState({ fromDate: "", toDate: "" });
  const result = useQuery({
    queryKey: ["sales-list", actor.actorKey, actor.actorGeneration, query, ...(actor.deploymentEpoch === undefined ? [] : [actor.deploymentEpoch])],
    enabled: canRead,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await workspace.port.list(query, { ...actor, signal });
      if (signal.aborted || !workspace.isCurrentScope(actor) ||
          !hasModuleCapability(workspace.auth.getSnapshot(), actor, "sales", "read")) {
        throw new ReadRequestError("forbidden", "Phiên đọc Sales đã thay đổi.");
      }
      if (response.kind === "failed") throw new ReadRequestError(response.error.kind, response.error.message);
      return response.value;
    },
  });
  const denied = result.isError && readErrorStatus(result.error) === "forbidden";
  const readable = canRead && !denied;
  const page = canRead && !result.isError ? result.data : undefined;
  const applied = Object.entries(query).some(([key, value]) =>
    key !== "pageSize" && key !== "cursor" && !!value);
  const status: ReadStatus = !canRead || denied ? "forbidden"
    : result.isError ? "error"
    : result.isPending ? "loading"
    : page && !page.items.length ? (applied ? "no-match" : "empty")
    : "ready";
  const uncommitted = catalogFilters.some(([field]) => !buffers[field].confirmed);
  const dateIncomplete = (["fromDate", "toDate"] as const).some(field => {
    const raw = dateRaw[field];
    return raw !== (query[field] ?? "");
  });

  function filter(key: "search" | "status", value: string) {
    setQuery(q => ({ ...q, [key]: value || undefined, cursor: undefined }));
  }
  function updateLookup(field: FilterId, value: LookupValue) {
    if (!workspace.isCurrentScope(actor)) return;
    setBuffers(previous => ({ ...previous, [field]: value }));
    if (!value.confirmed || value.composing) return;
    const id = value.selectedId ?? undefined;
    setQuery(previous => previous[field] === id ? previous
      : { ...previous, [field]: id, cursor: undefined });
  }
  function updateDate(field: "fromDate" | "toDate", raw: string, composing: boolean) {
    if (!workspace.isCurrentScope(actor)) return;
    setDateRaw(previous => ({ ...previous, [field]: raw }));
    if (composing) return;
    const parsed = parseDateOnly(raw);
    if (parsed.kind !== "valid" && parsed.kind !== "empty") return;
    const date = parsed.kind === "valid" ? parsed.canonical : undefined;
    setQuery(previous => previous[field] === date ? previous
      : { ...previous, [field]: date, cursor: undefined });
  }
  function canOpen() {
    return readable && !!page && workspace.isCurrentScope(actor) &&
      hasModuleCapability(workspace.auth.getSnapshot(), actor, "sales", "read");
  }

  return <LookupOverlayHost>
    <section aria-label="Danh sách Sales" className="flex h-full min-h-0 flex-col overflow-auto">
      <FilterBar label="Bộ lọc Sales">
        <div className="min-w-36 flex-1">
          <label htmlFor={dateId + "-search"} className="text-sm font-medium leading-none">Tìm chứng từ</label>
          <Input id={dateId + "-search"} aria-label="Tìm chứng từ" value={query.search ?? ""}
            onChange={event => filter("search", event.target.value)} />
        </div>
        {(["fromDate", "toDate"] as const).map(field => {
          const label = field === "fromDate" ? "Từ ngày" : "Đến ngày";
          return <div key={field} className="min-w-36 flex-1">
            <label htmlFor={dateId + "-" + field} className="text-sm font-medium leading-none">{label}</label>
            <DateField id={dateId + "-" + field} aria-label={label} calendarLabel={label}
              value={dateRaw[field]} placeholder="yyyy-MM-dd"
              onRawChange={(raw, composing) => updateDate(field, raw, composing)} disabled={!canRead} />
          </div>;
        })}
        {catalogFilters.map(([field, kind, label]) =>
          <div className="min-w-40 flex-1" key={field}>
            <ProductLookup label={label} scope={{
              ...actor, sessionId: "sales-list", generation: actor.actorGeneration,
              clientLineId: field, catalogContext: "sales-list", catalogKind: kind,
            }} port={workspace.catalog} value={buffers[field]} required={false}
              disabled={!canRead} onChange={value => updateLookup(field, value)} />
          </div>
        )}
        <label className="min-w-32 flex-1 text-sm font-medium leading-none">
          Trạng thái
          <NativeSelect className="w-full" aria-label="Lọc trạng thái"
            value={query.status ?? ""} disabled={!canRead}
            onChange={event => filter("status", event.target.value)}>
            <NativeSelectOption value="">Tất cả</NativeSelectOption>
            <NativeSelectOption>Draft</NativeSelectOption>
            <NativeSelectOption>Posted</NativeSelectOption>
          </NativeSelect>
        </label>
      </FilterBar>
      <p className="px-4 pt-2 text-xs text-muted-foreground">
        Nhấp đúp hoặc Enter để mở chứng từ. Tổng gồm tất cả dòng, kể cả khi lọc sản phẩm.
      </p>
      {(uncommitted || dateIncomplete) && canRead &&
        <p className="px-4 pt-1 text-xs text-muted-foreground" role="status">
          Bộ lọc đang nhập chưa áp dụng: chọn kết quả danh mục hoặc nhập ngày ISO hợp lệ.
        </p>}
      <ReadState status={status}
        message={(status === "error" || status === "forbidden") && result.isError ? result.error.message : undefined}
        onRetryRead={status === "error" ? () => { void result.refetch(); } : undefined} />
      <div className="min-h-64 flex-1" data-testid="sales-list-grid">
        <AgGridReact<Item> styleNonce={getStyleNonce()} theme={themeQuartz} columnDefs={columns}
          rowData={(page?.items as Item[]) ?? empty} loading={canRead && result.isPending}
          getRowId={p => p.data.saleId}
          onRowDoubleClicked={event => {
            if (canOpen() && event.data) void workspace.openSalesDocument(event.data.saleId);
          }}
          onCellKeyDown={event => {
            if ((event.event as KeyboardEvent)?.key === "Enter" && canOpen() && event.data)
              void workspace.openSalesDocument(event.data.saleId);
          }} />
      </div>
      <div className="flex flex-wrap items-center gap-2 p-4 text-sm">
        <Button variant="outline" disabled={!page?.previousCursor || result.isFetching}
          onClick={() => { if (page?.previousCursor) setQuery(q => ({ ...q, cursor: page.previousCursor! })); }}>
          Trang trước
        </Button>
        <Button variant="outline" disabled={!page?.nextCursor || result.isFetching}
          onClick={() => { if (page?.nextCursor) setQuery(q => ({ ...q, cursor: page.nextCursor! })); }}>
          Trang sau
        </Button>
        <Button variant="outline" disabled={!readable || result.isFetching}
          onClick={() => void result.refetch()}>Tải lại danh sách</Button>
        {page && <span>{page.items.length} chứng từ trên trang</span>}
      </div>
    </section>
  </LookupOverlayHost>;
}
