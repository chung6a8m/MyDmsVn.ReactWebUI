// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SalesListPanel } from "../../src/features/sales/SalesListPanel";
import { WorkspaceProvider } from "../../src/app/workspace/WorkspaceContext";
import { createWorkspaceRuntime } from "../../src/app/workspace/panelRegistry";
import { injectedRuntimeFixture } from "../unit/workspace/injectedRuntimeFixture";
import type { SalesListQuery } from "../../src/features/sales/contracts";

vi.mock("ag-grid-react", () => ({ AgGridReact: ({ rowData }: { rowData: { saleNumber: string }[] }) => <div>{rowData.map(row => <span key={row.saleNumber}>{row.saleNumber}</span>)}</div> }));
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, bottom: 300, right: 500, width: 500, height: 300, toJSON() {},
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
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

it("keeps typed lookup text out of Sales query until selection, then clears cursor", async () => {
  const fixture = injectedRuntimeFixture();
  const queries: SalesListQuery[] = [];
  fixture.sales.list = vi.fn(async query => {
    queries.push({ ...query });
    return { kind: "success" as const, value: {
      items: [], nextCursor: "next-page", previousCursor: null,
    } };
  });
  fixture.catalog.search = vi.fn(async ({ kind }) => ({
    kind: "success" as const,
    value: [{ id: kind === "customer" ? "101" : "201", code: "KH001", name: "Khách hàng mẫu", isActive: true }],
  }));
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><WorkspaceProvider workspace={workspace}><SalesListPanel /></WorkspaceProvider></QueryClientProvider>);
  await waitFor(() => expect(queries).toHaveLength(1));
  // A cursor comes from the server; entering raw lookup text must not change it or apply an ID.
  await waitFor(() => expect((screen.getByRole("button", { name: "Trang sau" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  await waitFor(() => expect(queries.at(-1)?.cursor).toBe("next-page"));
  const input = screen.getByRole("combobox", { name: "Lọc khách hàng" });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "KH001" } });
  await waitFor(() => expect(within(screen.getByRole("listbox")).getByRole("option")).toBeTruthy());
  expect(queries.at(-1)?.cursor).toBe("next-page");
  expect(queries.at(-1)?.customerId).toBeUndefined();
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option"));
  await waitFor(() => expect(queries.at(-1)?.customerId).toBe("101"));
  expect(queries.at(-1)?.cursor).toBeUndefined();
  fireEvent.change(input, { target: { value: "chưa chọn" } });
  expect(queries.at(-1)?.customerId).toBe("101");
  const lookup = input.closest("[data-lookup]")!;
  fireEvent.click(lookup.querySelector<HTMLButtonElement>('button[title="Xóa lựa chọn"]')!);
  await waitFor(() => expect(queries.at(-1)?.customerId).toBeUndefined());
  view.unmount(); client.clear(); workspace.dispose();
});

it("never sends incomplete date raw, never exposes stale rows after a read 403", async () => {
  const fixture = injectedRuntimeFixture();
  const queries: SalesListQuery[] = [];
  fixture.sales.list = vi.fn(async query => {
    queries.push({ ...query });
    if (query.status === "Posted")
      return { kind: "failed" as const, error: { kind: "forbidden" as const, code: "read-denied", message: "Sales.ReadDenied" } };
    return { kind: "success" as const, value: {
      items: [{ saleId: "1", saleNumber: "allowed sale", saleDate: "2026-11-02", status: "Draft" as const, totalAmount: "1.0000" }],
      nextCursor: null, previousCursor: null,
    } };
  });
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><WorkspaceProvider workspace={workspace}><SalesListPanel /></WorkspaceProvider></QueryClientProvider>);
  await screen.findByText("allowed sale");
  fireEvent.change(screen.getByRole("textbox", { name: "Từ ngày" }), { target: { value: "2026-" } });
  expect(queries.at(-1)?.fromDate).toBeUndefined();
  fireEvent.change(screen.getByRole("textbox", { name: "Từ ngày" }), { target: { value: "2026-11-01" } });
  await waitFor(() => expect(queries.at(-1)?.fromDate).toBe("2026-11-01"));
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc trạng thái" }), { target: { value: "Posted" } });
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Sales.ReadDenied"));
  expect(screen.queryByText("allowed sale")).toBeNull();
  expect((screen.getByRole("button", { name: "Tải lại danh sách" }) as HTMLButtonElement).disabled).toBe(true);
  // Reverting to a previously cached query must not resurrect rows after a scoped 403.
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc trạng thái" }), { target: { value: "" } });
  expect(screen.queryByText("allowed sale")).toBeNull();
  expect((screen.getByRole("button", { name: "Tải lại danh sách" }) as HTMLButtonElement).disabled).toBe(true);
  view.unmount(); client.clear(); workspace.dispose();
});

it("treats a transient 401 as recoverable without re-exposing a terminal 403 page", async () => {
  const fixture = injectedRuntimeFixture();
  fixture.sales.list = vi.fn(async query => {
    if (query.status === "Posted") return { kind: "failed" as const, error: {
      kind: "unauthorized" as const, code: "Auth.Unauthorized", message: "Refresh required",
    } };
    return { kind: "success" as const, value: {
      items: [{ saleId: "1", saleNumber: "recovered sale", saleDate: "2026-11-02", status: "Draft" as const, totalAmount: "1" }],
      nextCursor: null, previousCursor: null,
    } };
  });
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><WorkspaceProvider workspace={workspace}><SalesListPanel /></WorkspaceProvider></QueryClientProvider>);
  await screen.findByText("recovered sale");
  const status = screen.getByRole("combobox", { name: "Lọc trạng thái" });
  fireEvent.change(status, { target: { value: "Posted" } });
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Refresh required"));
  expect(screen.queryByText("recovered sale")).toBeNull();
  fireEvent.change(status, { target: { value: "" } });
  await screen.findByText("recovered sale");
  await waitFor(() => expect((screen.getByRole("button", { name: "Tải lại danh sách" }) as HTMLButtonElement).disabled).toBe(false));
  view.unmount(); client.clear(); workspace.dispose();
});
