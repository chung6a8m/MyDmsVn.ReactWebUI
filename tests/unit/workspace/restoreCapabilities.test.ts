import { expect, it, vi } from "vitest";
import { Orientation, type DockviewApi, type SerializedDockview } from "dockview";
import { createWorkspaceRuntime } from "../../../src/app/workspace/panelRegistry";
import { createLayoutPanel, encodeLayoutV2, type LayoutPanelDescriptor } from "../../../src/app/workspace/layoutPersistenceV2";
import { layoutStorageKey } from "../../../src/app/workspace/workspaceLayouts";
import { deniedModuleCapabilities } from "../../../src/app/runtime/moduleCapabilities";
import { registerReceiptWorkspaceStub } from "../../../src/lab/receiptWorkspaceStub";
import { injectedRuntimeFixture } from "./injectedRuntimeFixture";

const descriptors = [
  { kind: "records", module: "goods-receipt" },
  { kind: "read-only", module: "inventory-balances" },
  { kind: "read-only", module: "inventory-stock-card" },
] satisfies LayoutPanelDescriptor[];

function setup(descriptor: LayoutPanelDescriptor, read: boolean) {
  const fixture = injectedRuntimeFixture();
  const scope = fixture.auth.getSnapshot();
  fixture.publish({ ...scope, features: {
    ...deniedModuleCapabilities(), sales: scope.capabilities,
    [descriptor.module]: { read, write: false, post: false },
  } });
  const savedPanel = createLayoutPanel(descriptor);
  const savedId = savedPanel.id;
  const saved: SerializedDockview = {
    grid: { width: 800, height: 600, orientation: Orientation.HORIZONTAL,
      root: { type: "branch", data: [{ type: "leaf", data: { id: "saved-group", views: [savedId], activeView: savedId } }] } },
    panels: { [savedId]: savedPanel },
  };
  const key = layoutStorageKey(scope);
  const raw = encodeLayoutV2(saved, { [savedId]: { ...scope, descriptor } }, scope);
  fixture.dependencies.storage = { getItem: requested => requested === key ? raw : null, setItem: vi.fn(), removeItem: vi.fn() };
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  registerReceiptWorkspaceStub(workspace);
  let rendered = structuredClone(saved);
  const api = {
    toJSON: () => rendered,
    fromJSON: vi.fn((layout: SerializedDockview) => { rendered = layout; }),
    clear: () => { rendered = { ...saved, panels: {}, grid: { ...saved.grid, root: { type: "branch", data: [] } } }; },
    addPanel: (panel: { id: string; component: string; params: Record<string, unknown> }) => {
      rendered.panels[panel.id] = { id: panel.id, contentComponent: panel.component, params: panel.params };
    },
    onDidLayoutChange: () => ({ dispose() {} }),
  } as unknown as DockviewApi;
  return { workspace, api, rendered: () => rendered };
}

it.each(descriptors)("does not restore denied $module panels through the layout path", async descriptor => {
  const { workspace, api, rendered } = setup(descriptor, false);
  expect(await workspace.openPanel(descriptor.module)).toBe("");
  const detach = workspace.layouts.attach(api, "Danh sách Sales");
  try {
    expect(await workspace.layouts.ready()).toBe("closed");
    expect(Object.values(workspace.panelState.getState().panels).some(panel => panel.module === descriptor.module)).toBe(false);
    expect(Object.values(rendered().panels).some(panel => panel.params?.module === descriptor.module)).toBe(false);
    expect(workspace.panelState.getState().panels["foundation-catalog"]).toBeDefined();
  } finally { detach(); workspace.dispose(); }
});

it.each(descriptors)("restores $module panels with the current Read capability", async descriptor => {
  const { workspace, api, rendered } = setup(descriptor, true);
  const detach = workspace.layouts.attach(api, "Danh sách Sales");
  try {
    expect(await workspace.layouts.ready()).toBe("closed");
    expect(Object.values(workspace.panelState.getState().panels).some(panel => panel.module === descriptor.module)).toBe(true);
    expect(Object.values(rendered().panels).some(panel => panel.params?.module === descriptor.module)).toBe(true);
  } finally { detach(); workspace.dispose(); }
});

it("retains the safe Sales shell when Sales Read is denied", async () => {
  const { workspace, api, rendered } = setup({ kind: "records", module: "sales" }, false);
  expect(await workspace.openPanel("sales")).toBe("");
  const detach = workspace.layouts.attach(api, "Danh sách Sales");
  try {
    expect(await workspace.layouts.ready()).toBe("closed");
    expect(workspace.panelState.getState().panels["foundation-catalog"]).toMatchObject({ module: "sales", kind: "records" });
    expect(Object.keys(rendered().panels)).toEqual(["foundation-catalog"]);
  } finally { detach(); workspace.dispose(); }
});
