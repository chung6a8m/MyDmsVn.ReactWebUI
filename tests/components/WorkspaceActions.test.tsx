// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkspaceProvider } from "../../src/app/workspace/WorkspaceContext";
import { WorkspaceActions, captureWorkspaceActionTarget, admitWorkspaceAction } from "../../src/app/workspace/WorkspaceActions";
import { createWorkspaceRuntime } from "../../src/app/workspace/panelRegistry";
import { injectedRuntimeFixture } from "../unit/workspace/injectedRuntimeFixture";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("W7-CMD-02 captures the actual panel and rejects retargeting after focus changes", async () => {
  const fixture = injectedRuntimeFixture();
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  try {
    const initial = fixture.auth.getSnapshot();
    fixture.publish({ ...initial, features: {
      sales: { read: true, write: true, post: false },
      "inventory-stock-card": { read: true },
    } });
    workspace.registerPanel({ module: "inventory-stock-card", kind: "read-only", componentId: "inventory-stock-card", title: "Thẻ kho" });
    const sale = await workspace.openDocument("sales", null);
    const captured = captureWorkspaceActionTarget(workspace);
    expect(captured.panel?.id).toBe(sale);
    expect(admitWorkspaceAction(workspace, captured, "close")).toBe(true);
    const inventory = await workspace.openPanel("inventory-stock-card");
    expect(inventory).not.toBe("");
    expect(workspace.commands.capture()).toBeNull();
    expect(admitWorkspaceAction(workspace, captured, "close")).toBe(false);
    expect(admitWorkspaceAction(workspace, captured, "split")).toBe(false);
    expect(admitWorkspaceAction(workspace, captured, "reset")).toBe(true);
    const inventoryTarget = captureWorkspaceActionTarget(workspace);
    expect(inventoryTarget.panel?.module).toBe("inventory-stock-card");
    expect(admitWorkspaceAction(workspace, inventoryTarget, "close")).toBe(true);
  } finally { workspace.dispose(); }
});

it("W7-CMD-02/05 refuses old actor scope, busy close and busy layout", async () => {
  const fixture = injectedRuntimeFixture();
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  try {
    await workspace.openDocument("sales", null);
    const snapshot = captureWorkspaceActionTarget(workspace);
    workspace.close.state.setState({ busy: true });
    expect(admitWorkspaceAction(workspace, snapshot, "close-all")).toBe(false);
    workspace.close.state.setState({ busy: false });
    workspace.layouts.state.setState({ busy: true });
    expect(admitWorkspaceAction(workspace, snapshot, "reset")).toBe(false);
    workspace.layouts.state.setState({ busy: false });
    fixture.publish({ ...fixture.auth.getSnapshot(), actorGeneration: 100 });
    expect(admitWorkspaceAction(workspace, snapshot, "close")).toBe(false);
    expect(admitWorkspaceAction(workspace, snapshot, "close-all")).toBe(false);
  } finally { workspace.dispose(); }
});

it("W7-CMD-01 presents one workspace menu without the legacy pilot action row", () => {
  const fixture = injectedRuntimeFixture();
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  const view = render(<WorkspaceProvider workspace={workspace}><WorkspaceActions /></WorkspaceProvider>);
  try {
    const button = screen.getByRole("button", { name: "Tác vụ Workspace" });
    expect(button).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Đóng tất cả" })).toBeNull();
    fireEvent.click(button);
  } finally { view.unmount(); workspace.dispose(); }
});
