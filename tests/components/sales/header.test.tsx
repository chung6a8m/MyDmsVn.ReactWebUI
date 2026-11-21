// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createWorkspaceRuntime } from "../../../src/app/workspace/panelRegistry";
import { SalesHeaderForm } from "../../../src/features/sales/SalesHeaderForm";
import { LookupOverlayHost } from "../../../src/shared/lookup/LookupOverlayHost";
import { injectedRuntimeFixture } from "../../unit/workspace/injectedRuntimeFixture";
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows Sales validation in actual header controls and preserves session raw on composition", async () => {
  const f = injectedRuntimeFixture(), workspace = createWorkspaceRuntime(f.dependencies);
  const disconnect = workspace.connectAuth();
  try {
    const id = await workspace.openSalesDocument(null);
    workspace.store.setState(state => ({ sessions: { ...state.sessions, [id]: {
      ...state.sessions[id], issues: [
        { code: "date", field: "saleDate", message: "Ngày không hợp lệ." },
        { code: "customer", field: "customerId", message: "Cần chọn khách hàng." },
      ],
    } } }));
    render(<LookupOverlayHost><SalesHeaderForm workspace={workspace} sessionId={id} /></LookupOverlayHost>);
    const date = screen.getByRole("textbox", { name: "Ngày chứng từ" });
    const customer = screen.getByRole("combobox", { name: "Khách hàng" });
    expect(date).toHaveAttribute("aria-invalid", "true");
    expect(date).toHaveAccessibleDescription(/Ngày không hợp lệ/);
    expect(customer).toHaveAttribute("aria-invalid", "true");
    expect(customer).toHaveAccessibleDescription(/Cần chọn khách hàng/);
    expect(date).toHaveAttribute("required");
    fireEvent.compositionStart(date);
    fireEvent.change(date, { target: { value: "2026-02-" } });
    expect(workspace.store.getState().sessions[id].rawBuffers.saleDate)
      .toEqual({ raw: "2026-02-", composing: true });
    fireEvent.compositionEnd(date, { data: "" });
    expect(workspace.store.getState().sessions[id].rawBuffers.saleDate?.raw).toBe("2026-02-");
    expect(workspace.store.getState().sessions[id].rawBuffers.saleDate?.composing).toBe(false);
  } finally { disconnect(); }
});

it("keeps same field name unique for concurrent Sales sessions", async () => {
  const f = injectedRuntimeFixture(), workspace = createWorkspaceRuntime(f.dependencies);
  const disconnect = workspace.connectAuth();
  try {
    const a = await workspace.openSalesDocument(null);
    const b = await workspace.openSalesDocument(null);
    expect(a).not.toBe(b);
    render(<LookupOverlayHost><SalesHeaderForm workspace={workspace} sessionId={a} />
      <SalesHeaderForm workspace={workspace} sessionId={b} /></LookupOverlayHost>);
    const dates = screen.getAllByRole("textbox", { name: "Ngày chứng từ" });
    expect(dates).toHaveLength(2);
    expect(dates[0].id).not.toBe(dates[1].id);
    const lookups = screen.getAllByRole("combobox", { name: "Khách hàng" });
    expect(lookups[0].id).not.toBe(lookups[1].id);
  } finally { disconnect(); }
});
