import { test, expect } from "@playwright/test";
import { openDecimal } from "./decimal-helpers";
import { createProductDocument } from "./helpers/productActions";
import { productionHttp } from "./helpers/durableDraftWorkspaceHttp";

test("W7-DEC-01/02/04: shared DecimalInput Lab keeps exact and invalid text without formatting", async ({ page }) => {
  await page.goto("/lab/components");
  await page.getByText("DecimalInput · raw / IME / Escape", { exact: true }).click();
  const lab = page.getByTestId("lab-decimal-input");
  const sales = lab.getByRole("textbox", { name: "Số lượng Sales" });
  const receipt = lab.getByRole("textbox", { name: "Số lượng Receipt mẫu" });
  await lab.getByRole("button", { name: "Comma / zero tail" }).click();
  await expect(sales).toHaveValue("1,25000");
  await expect(receipt).toHaveValue("1,25000");
  await expect(lab.getByTestId("lab-decimal-result")).toContainText("Sales: 1.2500");
  await expect(lab.getByTestId("lab-decimal-result")).toContainText("Receipt: 1.2500");

  await lab.getByRole("button", { name: "Incomplete" }).click();
  await sales.blur();
  await expect(sales).toHaveValue("1.");
  await expect(receipt).toHaveValue("1.");
  await lab.getByRole("button", { name: "65 characters" }).click();
  await expect(receipt).toHaveValue("9".repeat(65));
  await expect(lab.getByTestId("lab-decimal-result")).toContainText("Số tối đa 64 ký tự.");

  await sales.focus();
  await sales.press("Escape");
  await expect(sales).toHaveValue("1.0000");
  await expect(receipt).toHaveValue("9".repeat(65));
  await lab.getByRole("combobox", { name: "Chế độ DecimalInput" }).selectOption("readonly");
  await expect(sales).toHaveAttribute("readonly");
  await expect(receipt).toHaveAttribute("readonly");
  await lab.getByRole("combobox", { name: "Chế độ DecimalInput" }).selectOption("disabled");
  await expect(sales).toBeDisabled();
  await expect(receipt).toBeDisabled();
});

test("W7-DEC-02/03: Sales grid IME Escape keeps raw; final keystroke reaches snapshot", async ({ page }) => {
  await page.goto("/lab/sales");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  const panel = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
  const qty = await openDecimal(panel, "qty");
  await expect(qty).toHaveAttribute("inputmode", "decimal");
  await expect(qty).toHaveAttribute("type", "text");
  const id = await qty.getAttribute("data-line-id");
  expect(id).toBeTruthy();

  await qty.dispatchEvent("compositionstart", { data: "" });
  await qty.fill("1,2500");
  await expect(qty).toHaveAttribute("data-composing", "true");
  await qty.press("Escape");
  await expect(qty).toHaveValue("1,2500");
  await qty.dispatchEvent("compositionend", { data: "" });
  await expect(qty).toHaveAttribute("data-composing", "false");
  await qty.press("End");
  await qty.press("0");
  await expect(qty).toHaveValue("1,25000");

  await panel.getByRole("button", { name: "Kiểm tra snapshot", exact: true }).click();
  await panel.getByText("Snapshot kiểm chứng", { exact: true }).click();
  const snapshot = JSON.parse((await panel.getByTestId("prepared-snapshot").textContent())!);
  expect(snapshot.lines.find((line: { clientLineId: string }) => line.clientLineId === id).qty).toBe("1.2500");
});

test("W7-DEC-02/04: Receipt editor keeps session-owned raw and cancels to original value", async ({ page }) => {
  const http = await productionHttp(page);
  await createProductDocument(page, "goods-receipt");
  const panel = page.getByRole("region", { name: "Phiếu nhập mới", exact: true });
  const cell = panel.locator('.ag-row[row-index="0"] [col-id="quantity"]');
  await cell.dblclick();
  const qty = panel.getByRole("textbox", { name: "Số lượng dòng 1" });
  const lineId = await qty.getAttribute("data-line-id");
  expect(lineId).toBeTruthy();
  await expect(qty).toHaveAttribute("inputmode", "decimal");

  await qty.fill("1,25000");
  await expect(qty).toHaveValue("1,25000");
  await qty.press("Escape");
  await expect(cell).toContainText("1.0000");
  expect(http.businessWrites).toEqual([]);
  expect(http.unexpected).toEqual([]);
  expect(http.errors).toEqual([]);
});
