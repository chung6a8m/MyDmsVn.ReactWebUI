import { test, expect } from "@playwright/test";
import { createProductDocument } from "./helpers/productActions";
import { productionHttp } from "./helpers/durableDraftWorkspaceHttp";

test("W7-DAT-01/03/04: Lab raw ISO, leap day, years 0001, bounds and keyboard focus", async ({ page }) => {
  await page.goto("/lab/components");
  await page.getByText("DateField · ISO / Calendar", { exact: true }).click();
  const lab = page.getByTestId("lab-date-field");
  const input = lab.getByRole("textbox", { name: "Ngày mẫu" });
  const trigger = lab.getByRole("button", { name: "Mở lịch Ngày mẫu" });
  const popup = page.getByRole("dialog", { name: "Lịch Ngày mẫu" });
  await expect(input).toHaveValue("2024-02-29");
  await expect(lab.getByTestId("lab-date-state")).toContainText("valid · 2024-02-29");
  await input.fill("2026-02-30");
  await input.blur();
  await expect(input).toHaveValue("2026-02-30");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await trigger.click();
  await expect(popup).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(input).toHaveValue("2026-02-30");
  await expect(input).toBeFocused();

  await lab.getByRole("button", { name: "Leap day" }).click();
  await trigger.click();
  await expect(popup.getByRole("button", { name: "Chọn ngày 2024-02-29" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(popup.getByRole("button", { name: "Chọn ngày 2024-03-01" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(input).toHaveValue("2024-03-01");
  await expect(popup).toHaveCount(0);
  await expect(input).toBeFocused();

  await lab.getByRole("button", { name: "Year 0001" }).click();
  await trigger.click();
  await expect(popup).toContainText("Tháng 01 / 0001");
  await expect(popup.getByRole("button", { name: "Chọn ngày 0001-01-01" })).toBeFocused();
  await page.keyboard.press("Escape");
  await lab.getByRole("button", { name: "Leap day" }).click();
  await lab.getByRole("checkbox", { name: /Giới hạn/ }).check();
  await trigger.click();
  await expect(popup.getByRole("button", { name: "Chọn ngày 2024-02-27" })).toBeDisabled();
  await expect(popup.getByRole("button", { name: "Chọn ngày 2024-02-28" })).toBeEnabled();
  await page.keyboard.press("Escape");
  await lab.getByRole("combobox", { name: "Chế độ DateField" }).selectOption("readonly");
  await expect(trigger).toBeDisabled();
  await expect(input).toHaveAttribute("readonly");
});

test("W7-DAT-02: calendar and raw typing share Sales session snapshot without Save/Post", async ({ page }) => {
  await page.goto("/lab/sales");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  const panel = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
  const input = panel.getByRole("textbox", { name: "Ngày chứng từ" });
  await input.fill("2024-02-29");
  await panel.getByRole("button", { name: "Mở lịch Ngày chứng từ" }).click();
  await page.getByRole("dialog", { name: "Lịch Ngày chứng từ" })
    .getByRole("button", { name: "Chọn ngày 2024-02-28" }).click();
  await expect(input).toHaveValue("2024-02-28");
  await panel.getByRole("button", { name: "Kiểm tra snapshot", exact: true }).click();
  await panel.getByText("Snapshot kiểm chứng", { exact: true }).click();
  const s = JSON.parse((await panel.getByTestId("prepared-snapshot").textContent())!);
  expect(s.saleDate).toBe("2024-02-28");
  await input.fill("2026-");
  await panel.getByRole("button", { name: "Kiểm tra snapshot", exact: true }).click();
  await expect(input).toHaveValue("2026-");
});

test("W7-DAT-02/03: Receipt calendar uses original write path and excludes forbidden default", async ({ page }) => {
  const http = await productionHttp(page);
  await createProductDocument(page, "goods-receipt");
  const panel = page.getByRole("region", { name: "Phiếu nhập mới", exact: true });
  const input = panel.getByRole("textbox", { name: "Ngày nhập" });
  await input.fill("0001-01-01");
  await panel.getByRole("button", { name: "Mở lịch Ngày nhập" }).click();
  const popup = page.getByRole("dialog", { name: "Lịch Ngày nhập" });
  await expect(popup.getByRole("button", { name: "Chọn ngày 0001-01-01" })).toBeDisabled();
  await popup.getByRole("button", { name: "Chọn ngày 0001-01-02" }).click();
  await expect(input).toHaveValue("0001-01-02");
  await expect(input).toBeFocused();
  expect(http.businessWrites).toEqual([]);
  expect(http.unexpected).toEqual([]);
  expect(http.errors).toEqual([]);
});
