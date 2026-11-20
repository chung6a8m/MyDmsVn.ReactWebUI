import { test, expect } from "@playwright/test";
import { openDecimal } from "./decimal-helpers";
import { createProductDocument } from "./helpers/productActions";
import { productionHttp } from "./helpers/durableDraftWorkspaceHttp";

test("W7-FLD-01/02/03: Sales Save failure focuses first invalid and error navigation preserves raw", async ({ page }) => {
  const http = await productionHttp(page);
  await createProductDocument(page, "sales");
  const panel = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  const date = panel.getByRole("textbox", { name: "Ngày chứng từ" });
  const sessionId = await panel.getAttribute("data-session-id");
  await panel.locator('label[data-slot="field-label"]').filter({ hasText: "Ngày chứng từ" }).click();
  await expect(date).toBeFocused();
  await date.fill("2026-02-30");
  await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  await expect(date).toBeFocused();
  await expect(date).toHaveAttribute("aria-invalid", "true");
  await expect(date).toHaveAccessibleDescription(/Ngày chứng từ phải là ngày thật/);
  const summary = panel.getByRole("list", { name: "Lỗi chứng từ" });
  await expect(summary).toContainText("Ngày chứng từ phải là ngày thật");
  await panel.getByRole("textbox", { name: "Ghi chú" }).focus();
  await summary.getByRole("button", { name: /Ngày chứng từ phải là ngày thật/ }).click();
  await expect(date).toBeFocused();
  await expect(panel).toHaveAttribute("data-session-id", sessionId!);
  await expect(date).toHaveValue("2026-02-30");
  await date.fill("2026-11-20");
  await expect(date).toBeFocused(); // live editing must not retrigger automatic issue focus
  expect(http.businessWrites).toEqual([]);
  expect(http.unexpected).toEqual([]);
  expect(http.errors).toEqual([]);
});

test("W7-FLD-01/02/03: Receipt errors use the same accessible summary and Save focuses the date", async ({ page }) => {
  const http = await productionHttp(page);
  await createProductDocument(page, "goods-receipt");
  const panel = page.getByRole("region", { name: "Phiếu nhập mới", exact: true });
  const date = panel.getByRole("textbox", { name: "Ngày nhập" });
  await date.fill("2026-02-30");
  await panel.getByRole("button", { name: "Lưu phiếu nhập", exact: true }).click();
  await expect(date).toBeFocused();
  await expect(date).toHaveAttribute("aria-invalid", "true");
  await expect(date).toHaveAccessibleDescription(/Ngày chứng từ phải là ngày thật/);
  const summary = panel.getByRole("list", { name: "Lỗi phiếu nhập" });
  await expect(summary).toContainText("Ngày chứng từ phải là ngày thật");
  await panel.getByRole("textbox", { name: "Ghi chú" }).focus();
  await summary.getByRole("button", { name: /Ngày chứng từ phải là ngày thật/ }).click();
  await expect(date).toBeFocused();
  await expect(date).toHaveValue("2026-02-30");
  expect(http.businessWrites).toEqual([]);
  expect(http.unexpected).toEqual([]);
  expect(http.errors).toEqual([]);
});

test("W7-FLD-02: Sales sorted grid validation navigates by clientLineId, not displayed index", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", m => { if (["error", "warning"].includes(m.type())) errors.push(m.text()); });
  await page.goto("/lab/sales");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  const panel = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
  const editor = await openDecimal(panel, "qty");
  const id = await editor.getAttribute("data-line-id");
  await editor.fill("-");
  const sort = panel.getByRole("columnheader", { name: "Đơn giá bán", exact: true });
  await sort.click();
  await sort.click();
  const row = panel.locator(`.ag-row[row-id="${id}"]`);
  await expect(row).not.toHaveAttribute("row-index", "0");
  await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  const focused = panel.locator(`input[data-line-id="${id}"]`);
  await expect(focused).toBeFocused();
  await expect(focused).toHaveValue("-");
  const summary = panel.getByRole("list", { name: "Lỗi chứng từ" });
  await expect(summary).toContainText("Số không hợp lệ");
  await focused.fill("2.25");
  await focused.press("Enter");
  await summary.getByRole("button", { name: /Số không hợp lệ/ }).click();
  await expect(panel.locator(`input[data-line-id="${id}"]`)).toBeFocused();
  expect(errors).toEqual([]);
});

test("W7-FLD-01: component Lab exposes real Nova field states without extra form store", async ({ page }) => {
  await page.goto("/lab/components");
  await page.getByText("DocumentField · trạng thái và validation", { exact: true }).click();
  const states = page.getByTestId("lab-field-states");
  const normal = states.getByRole("textbox", { name: "Giá trị đang nhập" });
  await normal.fill("2026-11-20 é");
  await expect(normal).toHaveValue("2026-11-20 é");
  await expect(states.getByRole("textbox", { name: "Bắt buộc" })).toHaveAttribute("required");
  await expect(states.getByRole("textbox", { name: "Không hợp lệ" })).toHaveAttribute("aria-invalid", "true");
  await expect(states.getByRole("textbox", { name: "Không hợp lệ" })).toHaveAccessibleDescription(/Giá trị mẫu đang sai/);
  await expect(states.getByRole("textbox", { name: "Bị vô hiệu hóa" })).toBeDisabled();
  await expect(states.getByRole("textbox", { name: "Chỉ đọc" })).toHaveAttribute("readonly");
});
