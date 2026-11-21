import { chromium, expect, test } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { productionHttp } from "./helpers/durableDraftWorkspaceHttp";
import { createProductDocument, productModuleButton, productWorkspaceAction } from "./helpers/productActions";

test("W7-INT-01/02: desktop shell, two dirty documents, Inventory, split and close Cancel preserve independent raw", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const http = await productionHttp(page);

  await createProductDocument(page, "sales");
  const sales = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  const salesId = await sales.getAttribute("data-session-id");
  expect(salesId).toBeTruthy();
  await sales.getByLabel("Ngày chứng từ", { exact: true }).fill("ngày chưa hợp lệ");
  await sales.getByLabel("Ghi chú", { exact: true }).fill("Sales raw – chưa lưu");

  await createProductDocument(page, "goods-receipt");
  const receipt = page.getByRole("region", { name: "Phiếu nhập mới", exact: true });
  const receiptId = await receipt.getAttribute("data-session-id");
  expect(receiptId).toBeTruthy();
  expect(receiptId).not.toBe(salesId);
  await receipt.getByLabel("Ghi chú", { exact: true }).fill("Receipt raw – chưa lưu");

  await productModuleButton(page, "inventory-balances").click();
  const inventory = page.getByRole("region", { name: "Tồn kho", exact: true });
  await expect(inventory.getByTestId("inventory-balances-grid")).toBeVisible();
  await productWorkspaceAction(page, "Tách sang phải");

  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-ag-theme-mode", "dark");
  await page.getByRole("button", { name: "Thu gọn sidebar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mở rộng sidebar", exact: true })).toBeVisible();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport);
    await expect(page.getByTestId("product-shell")).toBeVisible();
    await expect(page.getByRole("toolbar", { name: "Workspace", exact: true })).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-ag-theme-mode", "light");

  await page.getByRole("tab", { name: "Sales mới", exact: true }).click();
  await expect(sales).toHaveAttribute("data-session-id", salesId!);
  await expect(sales.getByLabel("Ngày chứng từ", { exact: true })).toHaveValue("ngày chưa hợp lệ");
  await expect(sales.getByLabel("Ghi chú", { exact: true })).toHaveValue("Sales raw – chưa lưu");

  await productWorkspaceAction(page, "Đóng tất cả");
  const confirm = page.getByRole("dialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Tiếp tục sửa", exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await expect(sales).toHaveAttribute("data-session-id", salesId!);

  await page.getByRole("tab", { name: "Phiếu nhập mới", exact: true }).click();
  await expect(receipt).toHaveAttribute("data-session-id", receiptId!);
  await expect(receipt.getByLabel("Ghi chú", { exact: true })).toHaveValue("Receipt raw – chưa lưu");
  expect(http.businessWrites).toEqual([]);
  expect(http.unexpected).toEqual([]);
  expect(http.errors).toEqual([]);
});

test("W7-INT-01/02: 390px drawer focus and navigation do not discard a dirty Receipt", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  const http = await productionHttp(page);
  await createProductDocument(page, "goods-receipt");
  const receipt = page.getByRole("region", { name: "Phiếu nhập mới", exact: true });
  const receiptId = await receipt.getAttribute("data-session-id");
  await receipt.getByLabel("Ghi chú", { exact: true }).fill("Bản nháp qua drawer ệ");

  const opener = page.getByRole("button", { name: "Mở điều hướng", exact: true });
  await opener.click();
  const drawer = page.getByRole("dialog", { name: "Điều hướng" });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await drawer.getByRole("navigation", { name: "Chức năng" })
    .getByRole("button", { name: "Mở Tồn kho", exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByLabel("Đường dẫn")).toContainText("Tồn kho");
  await page.getByRole("tab", { name: "Phiếu nhập mới", exact: true }).click();
  await expect(receipt).toHaveAttribute("data-session-id", receiptId!);
  await expect(receipt.getByLabel("Ghi chú", { exact: true })).toHaveValue("Bản nháp qua drawer ệ");
  expect(http.businessWrites).toEqual([]);
  expect(http.unexpected).toEqual([]);
  expect(http.errors).toEqual([]);
});

// Native Chromium tab zoom is controlled and read back through chrome.tabs;
// changing the viewport or CSS zoom would not meet W7-INT-01.
test("W7-INT-01: product document survives actual Chromium 125% and 200% tab zoom", async ({}, testInfo) => {
  const directory = await mkdtemp(join(tmpdir(), "web7-product-zoom-"));
  await writeFile(join(directory, "manifest.json"), JSON.stringify({
    manifest_version: 3,
    name: "WEB7 product native zoom acceptance",
    version: "1.0",
    permissions: ["tabs"],
    host_permissions: ["http://127.0.0.1/*"],
    background: { service_worker: "worker.js" },
  }));
  await writeFile(join(directory, "worker.js"), "chrome.runtime.onInstalled.addListener(() => {});");
  const context = await chromium.launchPersistentContext(join(directory, "profile"), {
    channel: "chromium",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    args: [
      `--disable-extensions-except=${directory}`,
      `--load-extension=${directory}`,
      "--window-size=1440,1000",
    ],
  });
  try {
    const page = await context.newPage();
    const http = await productionHttp(page);
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    await createProductDocument(page, "sales");
    const sales = page.getByRole("region", { name: "Chứng từ mới", exact: true });
    const sessionId = await sales.getAttribute("data-session-id");
    const note = sales.getByLabel("Ghi chú", { exact: true });
    await note.fill("Giữ raw qua native zoom ệ");

    for (const zoom of [1.25, 2]) {
      const actual = await worker.evaluate(
        `(async()=>{const [tab]=await chrome.tabs.query({url:'http://127.0.0.1:5173/*'});await chrome.tabs.setZoom(tab.id,${zoom});return chrome.tabs.getZoom(tab.id);})()`,
      );
      expect(actual).toBe(zoom);
      await expect(sales).toHaveAttribute("data-session-id", sessionId!);
      await expect(note).toHaveValue("Giữ raw qua native zoom ệ");
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await note.focus();
      await note.press("End");
      await note.press("!");
      await expect(note).toHaveValue(zoom === 1.25 ? "Giữ raw qua native zoom ệ!" : "Giữ raw qua native zoom ệ!!");
      await page.screenshot({ path: testInfo.outputPath(`product-native-zoom-${zoom}.png`) });
    }
    expect(http.businessWrites).toEqual([]);
    expect(http.unexpected).toEqual([]);
    expect(http.errors).toEqual([]);
  } finally {
    await context.close();
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep))
      throw new Error("Unexpected temporary profile path");
    await rm(directory, { recursive: true, force: true });
  }
});
