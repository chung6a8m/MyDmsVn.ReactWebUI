import { ReceiptProbeButtons, receiptProbeComponents } from "../ReceiptWorkspaceProbe";
import type { ReactNode } from "react";
import { LabShell } from "../LabShell";
import { GoodsReceiptProvider } from "../../features/goodsReceipt/GoodsReceiptContext";
import { InventoryProvider } from "../../features/inventory/InventoryContext";
import { createLabFeatureRuntime, type LabFeatureRuntime } from "./createLabFeatureRuntime";
import { createContext, useContext } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStore } from "zustand";
import { WorkspaceProvider } from "../../app/workspace/WorkspaceContext";
import { WorkspaceExtensionsContext, type WorkspaceExtensions } from "../../app/workspace/WorkspaceExtensions";
import { Button } from "../../components/ui/button";
import { LookupHarness } from "../LookupHarness";
import { WorkspaceDiagnostics, markLabShortcut } from "../WorkspaceDiagnostics";
import { SalesSnapshotDiagnostics } from "../SalesSnapshotDiagnostics";
import { createLabWorkspaceRuntime, type LabWorkspaceRuntime } from "./createLabWorkspaceRuntime";
const LabContext = createContext<LabWorkspaceRuntime | null>(null);
const FeatureContext = createContext<LabFeatureRuntime | null>(null);
// Navigation/remount is not document close. Lab sessions and its separate cache
// live for this page load, including visits to the disconnected application.
let instance: { workspace: LabWorkspaceRuntime; queries: QueryClient;
  feature?: { runtime: LabFeatureRuntime; queries: QueryClient } } | undefined;
function warnOnExit(event: BeforeUnloadEvent) {
  if ([instance?.workspace, instance?.feature?.runtime.workspace].some(workspace =>
    workspace?.documents().some(document => document.isDirtyIncludingRaw() || document.isCloseBlocked()))) {
    event.preventDefault();
    event.returnValue = "";
  }
}
function labInstance() {
  if (instance) return instance;
  instance = {
    workspace: createLabWorkspaceRuntime(),
    queries: new QueryClient({ defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false },
    } }),
  };
  // The page owns these sessions even while the Lab's Dockview host is absent.
  window.addEventListener("beforeunload", warnOnExit);
  return instance;
}
function featureInstance() {
  const root = labInstance();
  if (!root.feature) {
    root.feature = {
      runtime: createLabFeatureRuntime(),
      queries: new QueryClient({ defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false },
      } }),
    };
  }
  return root.feature;
}
if (import.meta.hot) import.meta.hot.dispose(() => {
  window.removeEventListener("beforeunload", warnOnExit);
  instance?.workspace.dispose();
  instance?.feature?.runtime.workspace.dispose();
  instance?.feature?.queries.clear();
  instance?.queries.clear();
});
export function useLabFeatureRuntime() {
  const runtime = useContext(FeatureContext);
  if (!runtime) throw new Error("LabFeatureScope is required");
  return runtime;
}
export function LabFeatureScope({ children }: { children: ReactNode }) {
  const { runtime, queries } = featureInstance();
  return (
    <QueryClientProvider client={queries}>
      <FeatureContext.Provider value={runtime}>
        <WorkspaceExtensionsContext.Provider value={{}}>
          <WorkspaceProvider workspace={runtime.workspace}>
            <GoodsReceiptProvider runtime={runtime.receipt}>
              <InventoryProvider runtime={runtime.inventory}>{children}</InventoryProvider>
            </GoodsReceiptProvider>
          </WorkspaceProvider>
        </WorkspaceExtensionsContext.Provider>
      </FeatureContext.Provider>
    </QueryClientProvider>
  );
}
export function useLabWorkspace() {
  const workspace = useContext(LabContext);
  if (!workspace) throw new Error("LabProvider is required");
  return workspace;
}
function FixtureButtons() {
  const workspace = useLabWorkspace();
  const busy = useStore(workspace.layouts.state, (state) => state.busy);
  return <>{["1001", "1002"].map((id) => (
    <Button key={id} variant="outline" disabled={busy}
      onClick={() => void workspace.openSalesDocument(id)}>Mở mẫu {id}</Button>
  ))}</>;
}
const extensions = {
  toolbar: <><FixtureButtons /><ReceiptProbeButtons /><WorkspaceDiagnostics /></>,
  lookupHarness: LookupHarness,
  panelComponents: receiptProbeComponents,
  salesDiagnostics: SalesSnapshotDiagnostics,
  onShortcut: markLabShortcut,
} satisfies WorkspaceExtensions;
export function LabProvider() {
  const { workspace, queries } = labInstance();
  return (
    <QueryClientProvider client={queries}>
      <LabContext.Provider value={workspace}>
        <WorkspaceExtensionsContext.Provider value={extensions}>
          <WorkspaceProvider workspace={workspace}><LabShell /></WorkspaceProvider>
        </WorkspaceExtensionsContext.Provider>
      </LabContext.Provider>
    </QueryClientProvider>
  );
}
