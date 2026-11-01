import { ReceiptProbeButtons, receiptProbeComponents } from "../ReceiptWorkspaceProbe";
import { createContext, useContext } from "react";
import { Outlet } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStore } from "zustand";
import { WorkspaceProvider } from "../../app/workspace/WorkspaceContext";
import { WorkspaceExtensionsContext } from "../../app/workspace/WorkspaceExtensions";
import { Button } from "../../components/ui/button";
import { LookupHarness } from "../LookupHarness";
import { createLabWorkspaceRuntime, type LabWorkspaceRuntime } from "./createLabWorkspaceRuntime";
const LabContext = createContext<LabWorkspaceRuntime | null>(null);
// Navigation/remount is not document close. Lab sessions and its separate cache
// live for this page load, including visits to the disconnected application.
let instance: { workspace: LabWorkspaceRuntime; queries: QueryClient } | undefined;
function warnOnExit(event: BeforeUnloadEvent) {
  if (instance?.workspace.documents().some(document => document.isDirtyIncludingRaw() || document.isCloseBlocked())) {
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
if (import.meta.hot) import.meta.hot.dispose(() => {
  window.removeEventListener("beforeunload", warnOnExit);
  instance?.workspace.dispose();
  instance?.queries.clear();
});
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
const extensions = { toolbar: <><FixtureButtons /><ReceiptProbeButtons /></>, lookupHarness: LookupHarness, panelComponents: receiptProbeComponents };
export function LabProvider() {
  const { workspace, queries } = labInstance();
  return (
    <QueryClientProvider client={queries}>
      <LabContext.Provider value={workspace}>
        <WorkspaceExtensionsContext.Provider value={extensions}>
          <WorkspaceProvider workspace={workspace}><Outlet /></WorkspaceProvider>
        </WorkspaceExtensionsContext.Provider>
      </LabContext.Provider>
    </QueryClientProvider>
  );
}
