// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WorkspaceProvider, useWorkspace } from "../../../src/app/workspace/WorkspaceContext";
import { createWorkspaceRuntime, type WorkspaceRuntime } from "../../../src/app/workspace/panelRegistry";
import { SalesHeaderForm } from "../../../src/features/sales/SalesHeaderForm";
import { LookupOverlayHost } from "../../../src/shared/lookup/LookupOverlayHost";
import type { CatalogQuery } from "../../../src/features/sales/contracts";
import { injectedRuntimeFixture } from "../../unit/workspace/injectedRuntimeFixture";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, width: 400, height: 200, top: 0, bottom: 200, left: 0, right: 400, toJSON() {},
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function Probe({ expected }: { expected: WorkspaceRuntime }) {
  return <output aria-label="runtime identity">{useWorkspace() === expected ? "injected" : "unexpected runtime"}</output>;
}

it("the provider uses the supplied runtime and releases its auth observer across StrictMode remounts", () => {
  const fixture = injectedRuntimeFixture();
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  const view = render(<StrictMode><WorkspaceProvider workspace={workspace}><Probe expected={workspace} /></WorkspaceProvider></StrictMode>);
  expect(screen.getByLabelText("runtime identity").textContent).toBe("injected");
  expect(fixture.observerCount()).toBe(1);
  view.unmount();
  expect(fixture.observerCount()).toBe(0);
  const remounted = render(<WorkspaceProvider workspace={workspace}><Probe expected={workspace} /></WorkspaceProvider>);
  expect(fixture.observerCount()).toBe(1);
  remounted.unmount();
  expect(fixture.observerCount()).toBe(0);
});

it("replacing the provider runtime moves context and observation without relabeling old private sessions", async () => {
  const first = injectedRuntimeFixture();
  const second = injectedRuntimeFixture();
  second.publish({ actorKey: "other-user/session-B", actorGeneration: 8, capabilities: { read: true, write: false, post: false } });
  const oldRuntime = createWorkspaceRuntime(first.dependencies);
  const nextRuntime = createWorkspaceRuntime(second.dependencies);
  const id = await oldRuntime.openSalesDocument(null);
  oldRuntime.writeBuffer(id, "note", "old owner private text");
  const view = render(<WorkspaceProvider workspace={oldRuntime}><Probe expected={oldRuntime} /></WorkspaceProvider>);
  view.rerender(<WorkspaceProvider workspace={nextRuntime}><Probe expected={nextRuntime} /></WorkspaceProvider>);
  expect(screen.getByLabelText("runtime identity").textContent).toBe("injected");
  expect(first.observerCount()).toBe(0);
  expect(second.observerCount()).toBe(1);
  expect(nextRuntime.store.getState().sessions).toEqual({});
  expect(oldRuntime.store.getState().sessions[id]).toMatchObject({
    actorKey: "authenticated-user-42/session-A", actorGeneration: 7,
    rawBuffers: { note: { raw: "old owner private text" } },
  });
  view.unmount();
  expect(second.observerCount()).toBe(0);
});

it("Sales header queries the injected Catalog with authenticated scope and preserves selection after Write revocation", async () => {
  const fixture = injectedRuntimeFixture();
  fixture.catalog.search = vi.fn(async (query: CatalogQuery) => ({
    kind: "success" as const,
    value: [{ id: "88", code: "INJECTED", name: `Injected ${query.kind}`, isActive: true }],
  }));
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  const disconnect = workspace.connectAuth();
  const id = await workspace.openSalesDocument(null);
  const view = render(<LookupOverlayHost><SalesHeaderForm workspace={workspace} sessionId={id} /></LookupOverlayHost>);
  try {
    const customer = screen.getByRole("combobox", { name: "Khách hàng" });
    fireEvent.focus(customer);
    await waitFor(() => expect(fixture.catalog.search).toHaveBeenCalledWith(
      { kind: "customer", search: "", limit: 25 },
      { actorKey: "authenticated-user-42/session-A", actorGeneration: 7, signal: expect.any(AbortSignal) },
    ));
    fireEvent.click(await screen.findByRole("option", { name: /Injected customer/ }));
    expect(workspace.store.getState().sessions[id].lookupBuffers?.customerId.selectedId).toBe("88");
    fixture.publish({ ...fixture.auth.getSnapshot(), capabilities: { read: true, write: false, post: true } });
    await waitFor(() => expect((customer as HTMLInputElement).disabled).toBe(true));
    expect((screen.getByLabelText("Ngày chứng từ") as HTMLInputElement).disabled).toBe(true);
    expect(workspace.store.getState().sessions[id].lookupBuffers?.customerId.selectedId).toBe("88");
    expect(workspace.store.getState().sessions[id].capabilities).toEqual({ read: true, write: false, post: true });
  } finally { view.unmount(); disconnect(); }
});
