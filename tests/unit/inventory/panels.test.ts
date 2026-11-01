import { createInventoryViews } from "../../../src/features/inventory/inventoryViews";
// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InventoryProvider } from "../../../src/features/inventory/InventoryContext";
import { StockBalancesPanel } from "../../../src/features/inventory/StockBalancesPanel";
import { StockCardPanel } from "../../../src/features/inventory/StockCardPanel";
const state = vi.hoisted(() => ({ read: true, panels: { panels: {} as Record<string, { id: string; module: string; filters?: Record<string, string> }> }, listeners: new Set<() => void>() }));
vi.mock("../../../src/app/workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({
    auth: { subscribe: () => () => {}, getSnapshot: () => null },
    portContext: () => ({ actorKey: "a", actorGeneration: 1 }),
    isCurrentScope: () => true,
    panelState: { subscribe: (listener: () => void) => { state.listeners.add(listener); return () => state.listeners.delete(listener); }, getState: () => state.panels },
  }),
}));
vi.mock("../../../src/app/runtime/moduleCapabilities", () => ({
  hasModuleCapability: () => state.read,
}));
vi.mock("ag-grid-react", () => ({
  AgGridReact: ({ rowData, onCellClicked }: { rowData: unknown[]; onCellClicked: (event: { data: unknown }) => void }) =>
    createElement("button", { onClick: () => onCellClicked({ data: rowData[0] }) }, JSON.stringify(rowData)),
}));
vi.mock("../../../src/shared/lookup/ProductLookup", () => ({
  ProductLookup: ({ label, required }: { label: string; required?: boolean }) =>
    createElement("input", { "aria-label": label, "aria-invalid": !!required }),
}));
vi.mock("../../../src/shared/lookup/LookupOverlayHost", () => ({
  LookupOverlayHost: ({ children }: { children: import("react").ReactNode }) =>
    children,
}));
afterEach(() => {
  cleanup();
  state.read = true;
  state.panels = { panels: {} };
});
function mount(card = false) {
  const balances = vi.fn(async (_query: unknown) => ({
    kind: "success" as const,
    value: {
      items: [
        {
          warehouseId: "1",
          productId: "2",
          quantity: "99999999999999.9999",
          inventoryValue: "1",
          warehouseCode: "W",
          warehouseName: "Kho",
          warehouseIsActive: true,
          productCode: "P",
          productName: "Sản phẩm",
          productIsActive: false,
          averageUnitCost: null,
        },
      ],
      pageNumber: 1,
      pageSize: 25,
      totalCount: "9007199254740993",
    },
  }));
  const stockCard = vi.fn(async () => {
    const result = await balances(undefined);
    return { ...result, value: { ...result.value, items: result.value.items.map(row => ({ ...row, ledgerId: "10", postedAtUtc: "2026-11-01T00:00:00Z", documentType: "GoodsReceipt", documentId: "9", documentNumber: "GR9", quantityChange: "1", valueChange: "1" })) } };
  });
  render(
    createElement(
      QueryClientProvider,
      {
        client: new QueryClient({
          defaultOptions: { queries: { retry: false } },
        }),
      },
      createElement(InventoryProvider, {
        runtime: {
          views: createInventoryViews(),
          port: { balances, stockCard },
          catalog: { search: vi.fn() },
        },
        children: createElement(card ? StockCardPanel : StockBalancesPanel),
      }),
    ),
  );
  return { balances, stockCard };
}
it("requests explicit paging and preserves exact totals", async () => {
  const { balances } = mount();
  await screen.findByText(/Tổng 9007199254740993/);
  expect(balances.mock.calls[0]?.[0]).toEqual({ pageNumber: 1, pageSize: 25 });
  expect(screen.getByLabelText("Lọc kho").getAttribute("aria-invalid")).toBe("false");
  expect(screen.getByLabelText("Lọc sản phẩm").getAttribute("aria-invalid")).toBe("false");
});
it("does not query stock card until both keys are selected", async () => {
  const { stockCard } = mount(true);
  await screen.findByText(/Chọn kho và sản phẩm/);
  expect(stockCard).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Lọc kho").getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByLabelText("Lọc sản phẩm").getAttribute("aria-invalid")).toBe("true");
});
it("does not query when independent read permission is denied", async () => {
  state.read = false;
  const { balances } = mount();
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(balances).not.toHaveBeenCalled();
});

it("same-stock explicit retarget clears cached source selection", async () => {
  const filters = { warehouseId: "1", productId: "2" };
  state.panels = { panels: { card: { id: "card", module: "inventory-stock-card", filters } } };
  mount(true);
  const row = await screen.findByRole("button", { name: /ledgerId/ });
  fireEvent.click(row);
  await waitFor(() => expect((screen.getByRole("button", { name: "Mở chứng từ" }) as HTMLButtonElement).disabled).toBe(false));
  act(() => {
    state.panels = { panels: { card: { id: "card", module: "inventory-stock-card", filters: { ...filters } } } };
    state.listeners.forEach(listener => listener());
  });
  await waitFor(() => expect(screen.queryByRole("button", { name: "Mở chứng từ" })).toBeNull());
});
