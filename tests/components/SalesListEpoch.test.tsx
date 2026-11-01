// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SalesListPanel } from "../../src/features/sales/SalesListPanel";
import { WorkspaceProvider } from "../../src/app/workspace/WorkspaceContext";
import { createWorkspaceRuntime } from "../../src/app/workspace/panelRegistry";
import { injectedRuntimeFixture } from "../unit/workspace/injectedRuntimeFixture";

vi.mock("ag-grid-react", () => ({ AgGridReact: ({ rowData }: { rowData: { saleNumber: string }[] }) => <div>{rowData.map(row => <span key={row.saleNumber}>{row.saleNumber}</span>)}</div> }));
afterEach(cleanup);
it("hides cached Sales rows immediately when only the authenticated database changes", async () => {
  const fixture = injectedRuntimeFixture();
  fixture.publish({ ...fixture.auth.getSnapshot(), deploymentEpoch: "11111111-2222-4333-8444-555555555555" });
  fixture.sales.list = vi.fn<typeof fixture.sales.list>(async () => ({ kind: "success", value: { items: [{ saleId: "1", saleNumber: "old database sale", saleDate: "2026-11-02", status: "Draft", totalAmount: "1" }], nextCursor: null, previousCursor: null } }));
  const workspace = createWorkspaceRuntime(fixture.dependencies), client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><WorkspaceProvider workspace={workspace}><SalesListPanel /></WorkspaceProvider></QueryClientProvider>);
  await screen.findByText("old database sale");
  act(() => fixture.publish({ ...fixture.auth.getSnapshot(), deploymentEpoch: "7c3baa58-9721-47ee-a1ac-88fc37c06e51" }));
  expect(screen.queryByText("old database sale")).toBeNull();
  expect((screen.getByRole("button", { name: "Tải lại danh sách" }) as HTMLButtonElement).disabled).toBe(true);
  view.unmount(); client.clear(); workspace.dispose();
});
