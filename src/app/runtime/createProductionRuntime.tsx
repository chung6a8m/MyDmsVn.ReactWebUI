import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createWorkspaceRuntime, type WorkspaceRuntime } from "../workspace/panelRegistry";
import type { LayoutStorage } from "../workspace/workspaceLayouts";
import type { AuthSession } from "../../infrastructure/http/authSession";
import { createHttpTransport } from "../../infrastructure/http/httpTransport";
import { createSalesHttpPort } from "../../infrastructure/http/salesHttpPort";
import { createCatalogHttpPort } from "../../infrastructure/http/catalogHttpPort";
import { SalesWorkspace } from "../../features/sales/SalesWorkspace";
const businessCalendar = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" });
export function businessDate(now = new Date()): string {
  const parts = businessCalendar.formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function ProductionContent({ auth, queryClient }: { auth: AuthSession; queryClient: QueryClient }) {
  useEffect(() => {
    const scope = auth.getSnapshot();
    const unsubscribe = auth.subscribe(() => {
      const current = auth.getSnapshot();
      if (current.status !== "authenticated" || current.actorKey !== scope.actorKey || current.actorGeneration !== scope.actorGeneration) queryClient.clear();
    });
    return () => { unsubscribe(); queryClient.clear(); };
  }, [auth, queryClient]);
  return <QueryClientProvider client={queryClient}><SalesWorkspace /></QueryClientProvider>;
}
export function createProductionRuntime(auth: AuthSession, options: { today?: () => string; storage?: LayoutStorage | null; fetch?: typeof fetch } = {}): { workspace: WorkspaceRuntime; content: React.ReactNode } {
  const transport = createHttpTransport(auth, options.fetch);
  let storage = options.storage;
  if (storage === undefined) { try { storage = window.localStorage; } catch { storage = null; } }
  const workspace = createWorkspaceRuntime({ sales: createSalesHttpPort(transport, auth), catalog: createCatalogHttpPort(transport, auth), auth, today: options.today ?? businessDate, storage });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } });
  return { workspace, content: <ProductionContent auth={auth} queryClient={queryClient} /> };
}
