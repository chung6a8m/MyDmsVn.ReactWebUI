import { expect, test } from "@playwright/test";
import { productionHttp } from "./helpers/durableDraftWorkspaceHttp";

test("W7-SHL-01/02/03: shell navigation, theme and collapsed state preserve the same document and raw note", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const http = await productionHttp(page);
  await expect(page.getByTestId("product-shell")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Chức năng" })).toBeVisible();
  await page.getByRole("button", { name: "Sales mới", exact: true }).click();
  const panel = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  const sessionId = await panel.getAttribute("data-session-id");
  await panel.getByLabel("Ghi chú", { exact: true }).fill("Giữ raw khi thu gọn 🧾");
  await page.getByRole("button", { name: "Thu gọn sidebar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mở rộng sidebar", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-ag-theme-mode", "dark");
  await expect(panel).toHaveAttribute("data-session-id", sessionId!);
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toHaveValue("Giữ raw khi thu gọn 🧾");
  await page.getByRole("navigation", { name: "Chức năng" }).getByRole("button", { name: "Mở Tồn kho" }).click();
  await expect(page.getByLabel("Đường dẫn")).toContainText("Tồn kho");
  await page.getByRole("tab", { name: "Sales mới", exact: true }).click();
  await expect(panel).toHaveAttribute("data-session-id", sessionId!);
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toHaveValue("Giữ raw khi thu gọn 🧾");
  await expect(page.getByRole("toolbar", { name: "Workspace" })).toHaveCount(1);
  expect(http.businessWrites).toEqual([]);
  expect(http.unexpected).toEqual([]);
  expect(http.errors).toEqual([]);
});

test("W7-SHL-05: mobile drawer traps keyboard focus, Escape returns to trigger and navigation closes it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  const http = await productionHttp(page);
  const opener = page.getByRole("button", { name: "Mở điều hướng", exact: true });
  await expect(opener).toBeVisible();
  await opener.click();
  const drawer = page.getByRole("dialog", { name: "Điều hướng" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("navigation", { name: "Chức năng" }).getByRole("button", { name: "Mở Tồn kho" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await drawer.getByRole("navigation", { name: "Chức năng" }).getByRole("button", { name: "Mở Tồn kho" }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByLabel("Đường dẫn")).toContainText("Tồn kho");
  expect(http.businessWrites).toEqual([]);
  expect(http.unexpected).toEqual([]);
});

test("W7-SHL-06: Write-only actor can explicitly create Sales without a Read navigation or list fetch", async ({ page }) => {
  const listRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/v1/sales-receipts")
      listRequests.push(request.url());
  });
  const http = await productionHttp(page, { capabilities: { read: false, write: true, post: false } });
  await expect(page.getByRole("navigation", { name: "Chức năng" }).getByRole("button", { name: "Mở Bán hàng" })).toHaveCount(0);
  await page.getByRole("button", { name: "Tạo chứng từ", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sales mới", exact: true }).click();
  const panel = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  await expect(panel).toBeVisible();
  expect(listRequests).toEqual([]);
  expect(http.businessWrites).toEqual([]);
  expect(http.unexpected).toEqual([]);
});
 

test("W7-SHL-04: pending server logout keeps desktop, Lab and mobile navigation blocked", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const http = await productionHttp(page);
  let releaseLogout = () => {};
  let markLogoutRequested = () => {};
  const heldLogout = new Promise<void>(resolve => { releaseLogout = resolve; });
  const logoutRequested = new Promise<void>(resolve => { markLogoutRequested = resolve; });
  await page.route("**/api/v1/auth/logout", async route => {
    markLogoutRequested();
    await heldLogout;
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"data":null}' });
  });
  try {
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await logoutRequested;
    // The pilot toolbar is inside this inert workspace until WEB7-03 moves its actions.
    await expect(page.getByTestId("product-workspace")).toHaveJSProperty("inert", true);
    const nav = page.getByRole("navigation", { name: "Chức năng" });
    await expect(nav.getByRole("button", { name: "Mở Tồn kho" })).toBeDisabled();
    await expect(page.getByRole("link", { name: "Sales Lab" })).toHaveAttribute("aria-disabled", "true");
    await page.setViewportSize({ width: 390, height: 780 });
    await expect(page.getByRole("button", { name: "Mở điều hướng" })).toBeDisabled();
  } finally {
    releaseLogout();
  }
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  expect(http.businessWrites).toEqual([]);
  expect(http.unexpected).toEqual([]);
});
