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
const businessCalendar = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" });
export function businessDate(now = new Date()): string {
  const parts = businessCalendar.formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function ProductionContent({ auth, queryClient, receipt, capabilities }: { auth: AuthSession; queryClient: QueryClient; receipt: GoodsReceiptRuntime; capabilities: ReturnType<typeof createReceiptCapabilityLoading> }) {
  const settled = useStore(capabilities.state, s => s.initialSettled);
  useEffect(() => capabilities.connect(), [capabilities]);
  useEffect(() => {
    const scope = auth.getSnapshot();
    const unsubscribe = auth.subscribe(() => {
      const current = auth.getSnapshot();
      if (current.status !== "authenticated" || current.actorKey !== scope.actorKey || current.actorGeneration !== scope.actorGeneration) queryClient.clear();
    });
    return () => { unsubscribe(); queryClient.clear(); };
  }, [auth, queryClient]);
  return <QueryClientProvider client={queryClient}><GoodsReceiptProvider runtime={receipt}>{settled ? <ProductionWorkspace /> : <p role="status" className="p-4">Đang đọc quyền phiếu nhập…</p>}</GoodsReceiptProvider></QueryClientProvider>;
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
  const dispose = workspace.dispose;
  workspace.dispose = () => { receipt.dispose(); dispose(); };
  const capabilities = createReceiptCapabilityLoading(auth);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } });
  return { workspace, content: <ProductionContent auth={auth} queryClient={queryClient} receipt={receipt} capabilities={capabilities} /> };
}
