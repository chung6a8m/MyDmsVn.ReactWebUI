import { expect, test } from "@playwright/test";
import { productionHttp } from "./helpers/durableDraftWorkspaceHttp";

async function workspaceMenu(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Tác vụ Workspace", exact: true }).click();
}

test("W7-CMD-01/02/03: document menu close goes through admission and preserves raw on Cancel", async ({ page }) => {
  const server = await productionHttp(page);
  await page.getByRole("button", { name: "Tạo chứng từ", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sales mới", exact: true }).click();
  const panel = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  const id = await panel.getAttribute("data-session-id");
  await panel.getByLabel("Ngày chứng từ", { exact: true }).fill("ngày chưa hợp lệ");
  await workspaceMenu(page);
  await expect(page.getByRole("menuitem", { name: "Tách sang phải" })).toBeEnabled();
  await page.getByRole("menuitem", { name: "Đóng tài liệu", exact: true }).click();
  const confirm = page.getByRole("dialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Tiếp tục sửa", exact: true }).click();
  // The menuitem that opened close admission is now unmounted.
  await expect(page.getByRole("button", { name: "Tác vụ Workspace", exact: true })).toBeFocused();
  await expect(panel).toHaveAttribute("data-session-id", id!);
  await expect(panel.getByLabel("Ngày chứng từ", { exact: true })).toHaveValue("ngày chưa hợp lệ");
  expect(server.businessWrites).toEqual([]);
  expect(server.unexpected).toEqual([]);
  expect(server.errors).toEqual([]);
});

test("W7-CMD-06: Write-only actor creates explicitly from empty workspace and Inventory, without list fetch", async ({ page }) => {
  const listFetches: string[] = [];
  page.on("request", request => {
    if (request.method() === "GET" && /\/api\/v1\/(sales-receipts|goods-receipts)$/.test(new URL(request.url()).pathname))
      listFetches.push(request.url());
  });
  const server = await productionHttp(page, { capabilities: { read: false, write: true, post: false } });
  await page.getByRole("navigation", { name: "Chức năng" }).getByRole("button", { name: "Mở Tồn kho" }).click();
  await expect(page.getByLabel("Đường dẫn")).toContainText("Tồn kho");
  await page.getByRole("button", { name: "Tạo chứng từ", exact: true }).click();
  await page.getByRole("menuitem", { name: "Phiếu nhập mới", exact: true }).click();
  await expect(page.getByRole("region", { name: "Phiếu nhập mới", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tạo chứng từ", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sales mới", exact: true }).click();
  await expect(page.getByRole("region", { name: "Chứng từ mới", exact: true })).toBeVisible();
  expect(listFetches).toEqual([]);
  expect(server.businessWrites).toEqual([]);
  expect(server.unexpected).toEqual([]);
});

test("W7-CMD-04: Escape restores workspace trigger and stable local drafts trigger after modal", async ({ page }) => {
  const server = await productionHttp(page);
  const trigger = page.getByRole("button", { name: "Tác vụ Workspace", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Đóng tất cả" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  const drafts = page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true });
  await drafts.click();
  await expect(page.getByRole("dialog", { name: "Bản nháp trên thiết bị" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drafts).toBeFocused();
  expect(server.businessWrites).toEqual([]);
  expect(server.unexpected).toEqual([]);
});
