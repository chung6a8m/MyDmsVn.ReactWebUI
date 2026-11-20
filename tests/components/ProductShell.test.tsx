// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ThemeContext } from "../../src/app/theme";
import { WorkspaceProvider } from "../../src/app/workspace/WorkspaceContext";
import { createWorkspaceRuntime } from "../../src/app/workspace/panelRegistry";
import { ProductShell } from "../../src/app/shell/ProductShell";
import { injectedRuntimeFixture } from "../unit/workspace/injectedRuntimeFixture";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("WEB7-02 shell navigates through the injected runtime and collapse leaves document content mounted", async () => {
  const fixture = injectedRuntimeFixture();
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  const openPanel = vi.spyOn(workspace, "openPanel");
  const logout = vi.fn();
  const view = render(
    <ThemeContext.Provider value={{ mode: "light", setMode: vi.fn() }}>
      <WorkspaceProvider workspace={workspace}>
        <ProductShell displayName="Người thử nghiệm" busy={false} onLogout={logout}>
          <output data-testid="retained-workspace">retained session</output>
        </ProductShell>
      </WorkspaceProvider>
    </ThemeContext.Provider>,
  );
  try {
    const nav = screen.getByRole("navigation", { name: "Chức năng" });
    fireEvent.click(within(nav).getByRole("button", { name: "Mở Bán hàng" }));
    await waitFor(() => expect(openPanel).toHaveBeenCalledWith("sales"));
    expect(within(nav).getByRole("button", { name: "Mở Bán hàng" }).getAttribute("aria-current")).toBe("page");
    const content = screen.getByTestId("retained-workspace");
    fireEvent.click(screen.getByRole("button", { name: "Thu gọn sidebar" }));
    expect(screen.getByRole("button", { name: "Mở rộng sidebar" })).toBeTruthy();
    expect(screen.getByTestId("retained-workspace")).toBe(content);
    fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
    expect(logout).toHaveBeenCalledOnce();
  } finally {
    view.unmount();
    workspace.dispose();
  }
});

it("WEB7-02 capability revoke removes Read navigation but preserves Write-only create entry", async () => {
  const fixture = injectedRuntimeFixture();
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  const view = render(
    <ThemeContext.Provider value={{ mode: "light", setMode: vi.fn() }}>
      <WorkspaceProvider workspace={workspace}>
        <ProductShell displayName="Người thử nghiệm" busy={false} onLogout={() => {}}>workspace</ProductShell>
      </WorkspaceProvider>
    </ThemeContext.Provider>,
  );
  try {
    expect(within(screen.getByRole("navigation", { name: "Chức năng" })).getByRole("button", { name: "Mở Bán hàng" })).toBeTruthy();
    const current = fixture.auth.getSnapshot();
    fixture.publish({ ...current, capabilities: { read: false, write: true, post: false },
      features: { sales: { read: false, write: true, post: false } } });
    await waitFor(() => expect(within(screen.getByRole("navigation", { name: "Chức năng" })).queryByRole("button", { name: "Mở Bán hàng" })).toBeNull());
    expect((screen.getByRole("button", { name: "Tạo chứng từ" }) as HTMLButtonElement).disabled).toBe(false);
  } finally {
    view.unmount();
    workspace.dispose();
  }
});


it("WEB7-02 pending logout disables sidebar Read navigation without re-entering the runtime", () => {
  const fixture = injectedRuntimeFixture();
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  const openPanel = vi.spyOn(workspace, "openPanel");
  const view = render(
    <ThemeContext.Provider value={{ mode: "light", setMode: vi.fn() }}>
      <WorkspaceProvider workspace={workspace}>
        <ProductShell displayName="Người thử nghiệm" busy onLogout={() => {}}>workspace</ProductShell>
      </WorkspaceProvider>
    </ThemeContext.Provider>,
  );
  try {
    const nav = screen.getByRole("navigation", { name: "Chức năng" });
    const sales = within(nav).getByRole("button", { name: "Mở Bán hàng" }) as HTMLButtonElement;
    expect(sales.disabled).toBe(true);
    expect(screen.getByTestId("product-workspace").hasAttribute("inert")).toBe(true);
    fireEvent.click(sales);
    expect(openPanel).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    workspace.dispose();
  }
});
