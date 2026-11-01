import { useMemo, useState, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import type { IDockviewPanelProps } from "dockview";
import { useQuery } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz, type ColDef } from "ag-grid-community";
import { useWorkspace } from "../../app/workspace/WorkspaceContext";
import { hasModuleCapability } from "../../app/runtime/moduleCapabilities";
import { getStyleNonce } from "../../app/styleNonce";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../components/ui/native-select";
import { ProductLookup } from "../../shared/lookup/ProductLookup";
import { LookupOverlayHost } from "../../shared/lookup/LookupOverlayHost";
import { type LookupValue } from "../../shared/lookup/lookupTypes";
import { useInventory } from "./InventoryContext";
import {
  balanceRowId,
  inventoryKeys,
  sourceModule,
  stockCardIssue,
} from "./inventoryQueries";
import type {
  StockBalanceRow,
  StockCardRow,
  StockCardQuery,
} from "./contracts";
type Row = StockBalanceRow | StockCardRow;
const empty: Row[] = [];
const referenceColumns: ColDef<Row>[] = [
  {
    colId: "warehouse",
    headerName: "Kho",
    minWidth: 200,
    valueGetter: (p) =>
      p.data &&
      `${p.data.warehouseCode} · ${p.data.warehouseName}${p.data.warehouseIsActive ? "" : " (Ngừng hoạt động)"}`,
  },
  {
    colId: "product",
    headerName: "Sản phẩm",
    minWidth: 220,
    flex: 1,
    valueGetter: (p) =>
      p.data &&
      `${p.data.productCode} · ${p.data.productName}${p.data.productIsActive ? "" : " (Ngừng hoạt động)"}`,
  },
];
const balanceColumns: ColDef<Row>[] = [
  ...referenceColumns,
  {
    colId: "quantity",
    headerName: "Số lượng",
    width: 190,
    valueGetter: (p) => (p.data && "quantity" in p.data ? p.data.quantity : ""),
  },
  {
    colId: "inventoryValue",
    headerName: "Giá trị tồn",
    width: 220,
    valueGetter: (p) =>
      p.data && "inventoryValue" in p.data ? p.data.inventoryValue : "",
  },
  {
    colId: "averageUnitCost",
    headerName: "Đơn giá bình quân",
    width: 220,
    valueGetter: (p) =>
      p.data && "averageUnitCost" in p.data
        ? (p.data.averageUnitCost ?? "—")
        : "",
  },
];
const cardColumns: ColDef<Row>[] = [
  ...referenceColumns,
  ...(
    [
      ["ledgerId", "Ledger ID", 200],
      ["postedAtUtc", "Thời gian UTC", 250],
      ["documentType", "Loại chứng từ", 160],
      ["documentNumber", "Số chứng từ", 180],
      ["quantityChange", "Thay đổi số lượng", 190],
      ["valueChange", "Thay đổi giá trị", 220],
    ] as const
  ).map(([field, headerName, width]) => ({
    colId: field,
    headerName,
    width,
    valueGetter: (p: { data?: Row }) =>
      p.data && field in p.data
        ? (p.data as unknown as Record<string, string>)[field]
        : "",
  })),
];
export function InventoryReadPanel({
  card,
  api,
}: {
  card: boolean;
  api?: IDockviewPanelProps["api"];
}) {
  const runtime = useInventory(),
    workspace = useWorkspace();
  const auth = useSyncExternalStore(
    workspace.auth.subscribe,
    workspace.auth.getSnapshot,
  );
  const panels = useSyncExternalStore(
    workspace.panelState.subscribe,
    workspace.panelState.getState,
  );
  const actor = workspace.portContext(),
    module = card ? "inventory-stock-card" : "inventory-balances";
  const target = api
    ? panels.panels[api.id]
    : Object.values(panels.panels).find((p) => p.module === module);
  const filters =
    target && workspace.isCurrentScope(target) ? target.filters : undefined;
  // Renderer-local selection is fenced by actor and panel identity; view filters live in the feature runtime.
  return (
    <InventoryFilters
      key={JSON.stringify([actor.deploymentEpoch, actor.actorKey, actor.actorGeneration, target?.id ?? module])}
      {...{ card, runtime, workspace, auth, actor, filters }}
      panelId={target?.id ?? module}
    />
  );
}
function InventoryFilters({
  card,
  runtime,
  workspace,
  auth,
  actor,
  filters,
  panelId,
}: {
  card: boolean;
  runtime: ReturnType<typeof useInventory>;
  workspace: ReturnType<typeof useWorkspace>;
  auth: ReturnType<ReturnType<typeof useWorkspace>["auth"]["getSnapshot"]>;
  actor: ReturnType<ReturnType<typeof useWorkspace>["portContext"]>;
  filters?: Readonly<Record<string, string | number>>;
  panelId: string;
}) {
  const view = runtime.views.panel(panelId, filters);
  const { local, warehouse, product } = useStore(view);
  const setLocal = (update: (value: typeof local) => typeof local) => view.setState(state => ({ local: update(state.local) }));
  const setWarehouse = (value: LookupValue) => view.setState({ warehouse: value });
  const setProduct = (value: LookupValue) => view.setState({ product: value });
  const [selected, setSelected] = useState<Row>();
  const [navigationError, setNavigationError] = useState("");
  const [seenView, setSeenView] = useState(view);
  if (seenView !== view) {
    setSeenView(view);
    setSelected(undefined);
    setNavigationError("");
  }
  const query = {
    ...local,
    ...(warehouse.confirmed && warehouse.selectedId
      ? { warehouseId: warehouse.selectedId }
      : {}),
    ...(product.confirmed && product.selectedId
      ? { productId: product.selectedId }
      : {}),
  };
  const cardQuery: StockCardQuery = {
    ...query,
    warehouseId: query.warehouseId ?? "",
    productId: query.productId ?? "",
  };
  const issue = card
    ? stockCardIssue(cardQuery)
    : query.search && (query.search.length > 256 || query.search.includes("\0"))
      ? "Tìm kiếm tối đa 256 ký tự, không chứa NUL."
      : undefined;
  const module = card ? "inventory-stock-card" : "inventory-balances";
  const readable = hasModuleCapability(auth, actor, module, "read"),
    validLookups = warehouse.confirmed && product.confirmed;
  const enabled = readable && !issue && validLookups;
  const result = useQuery({
    queryKey: card
      ? inventoryKeys.stockCard(actor, cardQuery)
      : inventoryKeys.balances(actor, query),
    enabled: !!enabled,
    retry: false,
    queryFn: async ({ signal }) => {
      const r = card
        ? await runtime.port.stockCard(cardQuery, { ...actor, signal })
        : await runtime.port.balances(query, { ...actor, signal });
      if (
        signal.aborted ||
        !workspace.isCurrentScope(actor) ||
        !hasModuleCapability(
          workspace.auth.getSnapshot(),
          actor,
          module,
          "read",
        )
      )
        throw Error("Phiên đã thay đổi.");
      if (r.kind === "failed") throw Error(r.error.message);
      return r.value;
    },
  });
  const page = enabled && !result.isError ? result.data : undefined;
  const hasNext =
    !!page &&
    page.pageNumber < 2147483647 &&
    BigInt(page.pageNumber) * BigInt(page.pageSize) < BigInt(page.totalCount);
  const scope = useMemo(
    () => ({
      ...actor,
      sessionId: module,
      generation: actor.actorGeneration,
      clientLineId: "warehouseId",
      catalogContext: module,
      catalogKind: "warehouse" as const,
    }),
    [actor.deploymentEpoch, actor.actorKey, actor.actorGeneration, module],
  );
  function changeLookup(value: LookupValue, kind: "warehouse" | "product") {
    if (!workspace.isCurrentScope(actor)) return;
    (kind === "warehouse" ? setWarehouse : setProduct)(value);
    setLocal((q) => ({ ...q, pageNumber: 1 }));
    setSelected(undefined);
  }
  const selectedCurrent =
    selected && page?.items.includes(selected as never) ? selected : undefined;
  const source =
    selectedCurrent && "documentType" in selectedCurrent
      ? sourceModule(selectedCurrent.documentType)
      : undefined;
  const sourceAllowed =
    !!source && hasModuleCapability(auth, actor, source, "read");
  async function navigate() {
    if (!selectedCurrent || !workspace.isCurrentScope(actor)) return;
    setNavigationError("");
    try {
      const current = workspace.auth.getSnapshot();
      if (
        card &&
        source &&
        "documentId" in selectedCurrent &&
        hasModuleCapability(current, actor, source, "read")
      ) {
        const id = await workspace.openDocument(
          source,
          selectedCurrent.documentId,
        );
        if (!id && workspace.isCurrentScope(actor))
          setNavigationError("Không thể mở chứng từ nguồn.");
      } else if (
        !card &&
        hasModuleCapability(current, actor, "inventory-stock-card", "read")
      )
        await workspace.openPanel(
          "inventory-stock-card",
          {
            warehouseId: selectedCurrent.warehouseId,
            productId: selectedCurrent.productId,
          },
          actor,
        );
    } catch {
      if (workspace.isCurrentScope(actor))
        setNavigationError("Không thể mở chứng từ nguồn.");
    }
  }
  return (
    <LookupOverlayHost>
      <section
        aria-label={card ? "Thẻ kho" : "Tồn kho"}
        className="flex h-full min-h-0 flex-col overflow-auto"
      >
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-40 flex-1">
            <ProductLookup
              label="Lọc kho"
              scope={scope}
              port={runtime.catalog}
              value={warehouse}
              disabled={!readable}
              required={card}
              onChange={(v) => changeLookup(v, "warehouse")}
            />
          </div>
          <div className="min-w-40 flex-1">
            <ProductLookup
              label="Lọc sản phẩm"
              scope={{
                ...scope,
                clientLineId: "productId",
                catalogKind: "product",
              }}
              port={runtime.catalog}
              value={product}
              disabled={!readable}
              required={card}
              onChange={(v) => changeLookup(v, "product")}
            />
          </div>
          {card ? (
            (["fromUtc", "toUtc"] as const).map((field) => (
              <label className="min-w-64 flex-1" key={field}>
                {field === "fromUtc" ? "Từ UTC" : "Đến UTC"}
                <Input
                  aria-label={field === "fromUtc" ? "Từ UTC" : "Đến UTC"}
                  placeholder="yyyy-MM-ddTHH:mm:ss[.fffffff]Z"
                  value={local[field] ?? ""}
                  disabled={!readable}
                  onChange={(e) => {
                    setLocal((q) => ({
                      ...q,
                      [field]: e.target.value || undefined,
                      pageNumber: 1,
                    }));
                    setSelected(undefined);
                  }}
                />
              </label>
            ))
          ) : (
            <label className="min-w-40 flex-1">
              Tìm tồn kho
              <Input
                aria-label="Tìm tồn kho"
                disabled={!readable}
                value={local.search ?? ""}
                onChange={(e) => {
                  setLocal((q) => ({
                    ...q,
                    search: e.target.value || undefined,
                    pageNumber: 1,
                  }));
                  setSelected(undefined);
                }}
              />
            </label>
          )}
        </div>
        {!readable && (
          <p role="alert" className="px-4">
            Không có quyền đọc {card ? "thẻ kho" : "tồn kho"}.
          </p>
        )}
        {readable && issue && (
          <p role="status" className="px-4">
            {issue}
          </p>
        )}
        {readable && result.isError && (
          <p role="alert" className="px-4">
            {result.error.message}
          </p>
        )}
        {navigationError && (
          <p role="alert" className="px-4">
            {navigationError}
          </p>
        )}
        {page && !page.items.length && (
          <p role="status" className="px-4">
            Không có dữ liệu.
          </p>
        )}
        <div
          className="min-h-32 flex-1"
          data-testid={
            card ? "inventory-stock-card-grid" : "inventory-balances-grid"
          }
        >
          <AgGridReact<Row>
            styleNonce={getStyleNonce()}
            theme={themeQuartz}
            columnDefs={card ? cardColumns : balanceColumns}
            rowData={(page?.items as Row[]) ?? empty}
            loading={!!enabled && result.isPending}
            getRowId={(p) =>
              "ledgerId" in p.data ? p.data.ledgerId : balanceRowId(p.data)
            }
            onCellClicked={(e) => setSelected(e.data)}
            onCellKeyDown={(e) => {
              if ((e.event as KeyboardEvent)?.key === "Enter")
                setSelected(e.data);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 p-4 text-sm">
          <Button
            variant="outline"
            disabled={!page || page.pageNumber <= 1 || result.isFetching}
            onClick={() =>
              setLocal((q) => ({ ...q, pageNumber: q.pageNumber - 1 }))
            }
          >
            Trang trước
          </Button>
          <Button
            variant="outline"
            disabled={!hasNext || result.isFetching}
            onClick={() =>
              setLocal((q) => ({ ...q, pageNumber: q.pageNumber + 1 }))
            }
          >
            Trang sau
          </Button>
          <label>
            Số dòng mỗi trang
            <NativeSelect
              aria-label="Số dòng mỗi trang"
              value={local.pageSize}
              disabled={!readable}
              onChange={(e) =>
                setLocal((q) => ({
                  ...q,
                  pageNumber: 1,
                  pageSize: Number(e.target.value),
                }))
              }
            >
              {[25, 50, 100, 200].map((n) => (
                <NativeSelectOption key={n} value={n}>
                  {n}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <Button
            variant="outline"
            disabled={!enabled || result.isFetching}
            onClick={() => void result.refetch()}
          >
            Tải lại
          </Button>
          {(!card || source) && (
            <Button
              variant="outline"
              disabled={
                !selectedCurrent ||
                !(card
                  ? sourceAllowed
                  : hasModuleCapability(
                      auth,
                      actor,
                      "inventory-stock-card",
                      "read",
                    ))
              }
              onClick={() => void navigate()}
            >
              {card ? "Mở chứng từ" : "Mở thẻ kho"}
            </Button>
          )}
          {page && (
            <span>
              {page.items.length} dòng · Trang {page.pageNumber} · Tổng{" "}
              {page.totalCount}
            </span>
          )}
        </div>
      </section>
    </LookupOverlayHost>
  );
}
