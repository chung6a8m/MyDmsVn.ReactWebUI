import { expect, test } from "@playwright/test";
import { productionHttp } from "./helpers/durableDraftWorkspaceHttp";

test("W7-DIA-02: Lab snapshot uses the feature barrier and mark follows the focused session", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/lab/sales");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  const a = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
  await a.getByLabel("Ghi chú", { exact: true }).fill("WEB7 snapshot last keystroke");
  await a.getByRole("button", { name: "Kiểm tra snapshot", exact: true }).click();
  await a.getByText("Snapshot kiểm chứng", { exact: true }).click();
  await expect.poll(async () =>
    JSON.parse((await a.getByTestId("prepared-snapshot").textContent()) ?? "{}").note,
  ).toBe("WEB7 snapshot last keystroke");

  await page.getByRole("button", { name: "Mở mẫu 1002", exact: true }).click();
  const b = page.getByRole("region", { name: "Chứng từ 1002", exact: true });
  await page.getByRole("button", { name: "Tách sang phải", exact: true }).click();
  await a.getByLabel("Ghi chú", { exact: true }).click();
  await page.getByRole("button", { name: "Đánh dấu phiên", exact: true }).click();
  await expect(a.getByText("Lệnh đã nhận: 1", { exact: true })).toBeVisible();
  await expect(b.getByText("Lệnh đã nhận: 0", { exact: true })).toBeVisible();
  await b.getByLabel("Ghi chú", { exact: true }).click();
  await page.keyboard.press("Control+Alt+m");
  await expect(b.getByText("Lệnh đã nhận: 1", { exact: true })).toBeVisible();

  await b.getByLabel("Ghi chú", { exact: true }).fill("dirty stays through close admission");
  await page.keyboard.press("Control+Alt+w");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Tiếp tục sửa", exact: true }).click();
  await expect(b.getByLabel("Ghi chú", { exact: true })).toHaveValue("dirty stays through close admission");
});

test("W7-DIA-02: Lab snapshot and Save replace a single feedback alert", async ({ page }) => {
  await page.goto("/lab/sales");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  const panel = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
  await panel.getByLabel("Ngày chứng từ", { exact: true }).fill("2026-02-30");
  await panel.getByRole("button", { name: "Kiểm tra snapshot", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("ngày thật");
  await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  await expect(panel.getByRole("alert")).toHaveCount(1);
});

test("W7-DIA-03: Components Lab retains the same diagnostic extension", async ({ page }) => {
  await page.goto("/lab/components");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  const panel = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
  await expect(panel.getByRole("button", { name: "Kiểm tra snapshot", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đánh dấu phiên", exact: true })).toBeEnabled();
});

test("W7-DIA-01: authenticated Product has no diagnostic UI or Ctrl+Alt+M handler", async ({ page }) => {
  const http = await productionHttp(page);
  await page.getByRole("button", { name: "Sales mới", exact: true }).click();
  const panel = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đánh dấu phiên", exact: true })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Kiểm tra snapshot", exact: true })).toHaveCount(0);
  await expect(panel.getByTestId("prepared-snapshot")).toHaveCount(0);
  await expect(panel.getByText(/Lệnh đã nhận:/)).toHaveCount(0);

  const handled = await page.evaluate(() => {
    const event = new KeyboardEvent("keydown", {
      code: "KeyM", key: "m", ctrlKey: true, altKey: true, bubbles: true, cancelable: true,
    });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(handled).toBe(false);
  await panel.getByLabel("Ghi chú", { exact: true }).fill("still dirty");
  await page.keyboard.press("Control+Alt+w");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Tiếp tục sửa", exact: true }).click();
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toHaveValue("still dirty");
  expect(http.businessWrites).toEqual([]);
  expect(http.unexpected).toEqual([]);
  expect(http.errors).toEqual([]);
});
