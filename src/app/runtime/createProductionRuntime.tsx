import { createInventoryViews } from "../../features/inventory/inventoryViews";
import { useEffect } from "react";
import { useStore } from "zustand";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createWorkspaceRuntime, type WorkspaceRuntime } from "../workspace/panelRegistry";
import type { LayoutStorage } from "../workspace/workspaceLayouts";
import type { AuthSession } from "../../infrastructure/http/authSession";
import { createHttpTransport } from "../../infrastructure/http/httpTransport";
import { createSalesHttpPort } from "../../infrastructure/http/salesHttpPort";
import { createCatalogHttpPort } from "../../infrastructure/http/catalogHttpPort";
import { ProductionWorkspace } from "../workspace/ProductionWorkspace";
import { createGoodsReceiptHttpPort } from "../../infrastructure/http/goodsReceiptHttpPort";
import { createGoodsReceiptWorkspaceAdapter } from "../../features/goodsReceipt/goodsReceiptWorkspaceAdapter";
import { GoodsReceiptProvider, type GoodsReceiptRuntime } from "../../features/goodsReceipt/GoodsReceiptContext";
import { createReceiptCapabilityLoading } from "./receiptCapabilityLoading";
import { createInventoryHttpPort } from "../../infrastructure/http/inventoryHttpPort";
import { InventoryProvider } from "../../features/inventory/InventoryContext";
import type { InventoryPort } from "../../ports/inventoryPort";
import type { CatalogPort } from "../../ports/catalogPort";
import { hasModuleCapability } from "./moduleCapabilities";
import { observeInventoryPosts } from "../../features/inventory/inventoryInvalidation";
const businessCalendar = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" });
export function businessDate(now = new Date()): string {
  const parts = businessCalendar.formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function ProductionContent({ auth, queryClient, receipt, capabilities, inventory }: { auth: AuthSession; queryClient: QueryClient; receipt: GoodsReceiptRuntime; capabilities: ReturnType<typeof createReceiptCapabilityLoading>; inventory: { port: InventoryPort; catalog: CatalogPort; views: ReturnType<typeof createInventoryViews> } }) {
  const settled = useStore(capabilities.state, s => s.initialSettled);
  useEffect(() => capabilities.connect(), [capabilities]);
  useEffect(() => {
    return () => { queryClient.clear(); };
  }, [auth, queryClient]);
  return <QueryClientProvider client={queryClient}><InventoryProvider runtime={inventory}><GoodsReceiptProvider runtime={receipt}>{settled ? <ProductionWorkspace /> : <p role="status" className="p-4">Đang đọc quyền phiếu nhập…</p>}</GoodsReceiptProvider></InventoryProvider></QueryClientProvider>;
}
export function createProductionRuntime(auth: AuthSession, options: { today?: () => string; storage?: LayoutStorage | null; fetch?: typeof fetch } = {}): { workspace: WorkspaceRuntime; content: React.ReactNode } {
  const transport = createHttpTransport(auth, options.fetch);
  let storage = options.storage;
  if (storage === undefined) { try { storage = window.localStorage; } catch { storage = null; } }
  const workspace = createWorkspaceRuntime({ sales: createSalesHttpPort(transport, auth), catalog: createCatalogHttpPort(transport, auth), auth, today: options.today ?? businessDate, storage });
  const receipt = createGoodsReceiptWorkspaceAdapter({ port: createGoodsReceiptHttpPort(transport, auth), catalog: workspace.catalog, auth, today: options.today ?? businessDate }, {
    scope: workspace.portContext, isCurrentScope: workspace.isCurrentScope,
    blocked: () => workspace.close.state.getState().busy || workspace.layouts.state.getState().busy,
    show: workspace.showPanel, remove: workspace.removePanel,
  });
  workspace.registerFeature(receipt.feature);
  workspace.registerPanel({ module: "goods-receipt", kind: "records", componentId: "goods-receipt-list", title: "Danh sách nhập kho" });

  const capabilities = createReceiptCapabilityLoading(auth);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } });
  workspace.registerPanel({ module: "inventory-balances", kind: "read-only", componentId: "inventory-balances", title: "Tồn kho" });
  workspace.registerPanel({ module: "inventory-stock-card", kind: "read-only", componentId: "inventory-stock-card", title: "Thẻ kho" });
  const inventory = { views: createInventoryViews(), port: createInventoryHttpPort(transport, auth), catalog: workspace.catalog };
  // Observe for the runtime lifetime: closing a panel must not leave private
  // cached or in-flight reads alive through a Read revoke/regrant.
  const scope = auth.getSnapshot();
  const fenceQueries = () => {
    const current = auth.getSnapshot();
    if (current.status !== "authenticated" || current.actorKey !== scope.actorKey || current.actorGeneration !== scope.actorGeneration) {
      inventory.views.clear();
      queryClient.clear();
      return;
    }
    for (const [module, key] of [["inventory-balances", "balances"], ["inventory-stock-card", "stock-card"]] as const) {
      if (hasModuleCapability(current, scope, module, "read")) continue;
      const queryKey = ["inventory", scope.actorKey, scope.actorGeneration, key];
      void queryClient.cancelQueries({ queryKey });
      queryClient.removeQueries({ queryKey });
    }
  };
  const unsubscribeAuth = auth.subscribe(fenceQueries);
  fenceQueries();
  const unsubscribeViews = workspace.panelState.subscribe(state => inventory.views.retain(Object.keys(state.panels)));
  const unsubscribers = [unsubscribeViews, unsubscribeAuth, observeInventoryPosts(queryClient, receipt.store, workspace.isCurrentScope), observeInventoryPosts(queryClient, workspace.store, workspace.isCurrentScope)];
  const dispose = workspace.dispose;
  workspace.dispose = () => { unsubscribers.forEach(unsubscribe => unsubscribe()); inventory.views.clear(); queryClient.clear(); receipt.dispose(); dispose(); };
  return { workspace, content: <ProductionContent auth={auth} queryClient={queryClient} receipt={receipt} capabilities={capabilities} inventory={inventory} /> };
}
