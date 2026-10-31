import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz, type ColDef } from "ag-grid-community";
import { useWorkspace } from "../../app/workspace/WorkspaceContext";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import type { SalesListQuery, SalesPage } from "./contracts";
type Item = SalesPage["items"][number];
const columns: ColDef<Item>[] = [
  { field: "saleId", headerName: "Sale ID", width: 200 },
  { field: "saleNumber", headerName: "Số chứng từ", flex: 1, minWidth: 180 },
  { field: "saleDate", headerName: "Ngày", width: 130 },
  { field: "status", headerName: "Trạng thái", width: 120 },
  { field: "totalAmount", headerName: "Tổng tiền", width: 170 },
];
const empty: Item[] = [];
export function SalesListPanel() {
  const w = useWorkspace();
  const [query, setQuery] = useState<SalesListQuery>({ pageSize: 25 });
  const actor = w.portContext();
  const result = useQuery({
    queryKey: ["sales-list", actor.actorKey, actor.actorGeneration, query],
    queryFn: async ({ signal }) => {
      const r = await w.port.list(query, { ...actor, signal });
      if (r.kind === "failed") throw new Error(r.error.message);
      return r.value;
    },
    retry: false,
  });
  function filter(key: keyof SalesListQuery, value: string) {
    setQuery((q) => ({ ...q, [key]: value || undefined, cursor: undefined }));
  }
  return (
    <section
      aria-label="Danh sách Sales"
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex flex-wrap gap-2 p-4">
        {(
          [
            ["search", "Tìm chứng từ"],
            ["fromDate", "Từ ngày"],
            ["toDate", "Đến ngày"],
            ["customerId", "Customer ID"],
            ["warehouseId", "Warehouse ID"],
            ["employeeId", "Employee ID"],
            ["productId", "Product ID"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="min-w-32 flex-1">
            {label}
            <Input
              aria-label={label}
              value={query[key] ?? ""}
              placeholder={key.includes("Date") ? "yyyy-MM-dd" : undefined}
              onChange={(e) => filter(key, e.target.value)}
            />
          </label>
        ))}
        <label>
          Trạng thái
          <select
            aria-label="Lọc trạng thái"
            value={query.status ?? ""}
            onChange={(e) => filter("status", e.target.value)}
          >
            <option value="">Tất cả</option>
            <option>Draft</option>
            <option>Posted</option>
          </select>
        </label>
      </div>
      <p className="px-4">
        Nhấp đúp một dòng để mở chứng từ. Tổng gồm tất cả dòng, kể cả khi lọc
        sản phẩm.
      </p>
      {result.isError && <p role="alert">{result.error.message}</p>}
      <div className="min-h-48 flex-1" data-testid="sales-list-grid">
        <AgGridReact<Item>
          theme={themeQuartz}
          columnDefs={columns}
          rowData={(result.data?.items as Item[]) ?? empty}
          loading={result.isPending}
          getRowId={(p) => p.data.saleId}
          onRowDoubleClicked={(e) => {
            if (e.data) void w.openSalesDocument(e.data.saleId);
          }}
          onCellKeyDown={(e) => {
            if ((e.event as KeyboardEvent)?.key === "Enter" && e.data)
              void w.openSalesDocument(e.data.saleId);
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2 p-4">
        <Button
          variant="outline"
          disabled={!result.data?.previousCursor || result.isFetching}
          onClick={() =>
            setQuery((q) => ({ ...q, cursor: result.data!.previousCursor! }))
          }
        >
          Trang trước
        </Button>
        <Button
          variant="outline"
          disabled={!result.data?.nextCursor || result.isFetching}
          onClick={() =>
            setQuery((q) => ({ ...q, cursor: result.data!.nextCursor! }))
          }
        >
          Trang sau
        </Button>
        <Button variant="outline" onClick={() => void result.refetch()}>
          Tải lại danh sách
        </Button>
        <span>{result.data?.items.length ?? 0} chứng từ trên trang</span>
      </div>
    </section>
  );
}
