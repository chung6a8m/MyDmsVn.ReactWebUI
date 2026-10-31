import { test, expect } from "@playwright/test";
import { openDecimal } from "./decimal-helpers";
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (["error", "warning"].includes(m.type())) errors.push(m.text()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/lab/sales");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
});
test.afterEach(() => expect(errors).toEqual([]));
for (const kind of ["qty", "unitPrice"] as const) {
  test(`close validation follows ${kind} identity after sorting`, async ({ page }) => {
    const panel = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
    const sortingKind = kind === "qty" ? "unitPrice" : "qty";
    await (await openDecimal(panel, sortingKind, 1)).fill("9");
    const editor = await openDecimal(panel, kind);
    const id = await editor.getAttribute("data-line-id");
    await editor.fill("-");
    const header = panel.getByRole("columnheader", { name: sortingKind === "qty" ? "Số lượng" : "Đơn giá bán", exact: true });
    await header.click();
    await header.click();
    const row = panel.locator(`.ag-row[row-id="${id}"]`);
    await expect(row).not.toHaveAttribute("row-index", "0");
    await page.keyboard.press("Control+Alt+w");
    await page.getByRole("button", { name: "Lưu (stub)", exact: true }).click();
    const input = panel.locator(`input[data-line-id="${id}"]`);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("-");
    await expect(input).toHaveAttribute("inputmode", "decimal");
    await input.fill("2.25");
    await input.press("Enter");
    await expect(row.locator(`[col-id="${kind}"]`)).toHaveText("2.25");
  });
}
for (const click of [false, true]) for (const key of ["Enter", "Tab"]) {
  test(`product ${click ? "click" : "highlight"} then ${key} commits and focuses idle Qty`, async ({ page }) => {
    const panel = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
    const row = panel.locator('.ag-row[row-index="0"]');
    const id = await row.getAttribute("row-id");
    await row.locator('[col-id="product"]').dblclick();
    const input = panel.getByRole("combobox", { name: "Sản phẩm grid", exact: true });
    await input.fill("SP002");
    const option = page.getByRole("listbox").getByRole("option");
    await expect(option).toHaveCount(1);
    await input.press("ArrowDown");
    const label = await option.textContent();
    if (click) await option.click();
    await input.press(key);
    const target = panel.locator(`.ag-row[row-id="${id}"] [col-id="qty"]`);
    await expect(target).toBeFocused();
    await expect(panel.locator('.ag-cell-inline-editing')).toHaveCount(0);
    await expect(target.locator("input")).toHaveCount(0);
    await expect(panel.getByRole("combobox", { name: "Sản phẩm grid", exact: true })).toHaveCount(0);
    await expect(panel.locator(`.ag-row[row-id="${id}"] [col-id="product"]`)).toContainText(label!.split(" · ")[1]);
    await panel.getByRole("button", { name: "Kiểm tra snapshot", exact: true }).click();
    await panel.locator("summary").click();
    const snapshot = JSON.parse((await panel.getByTestId("prepared-snapshot").textContent())!);
    expect(snapshot.lines.find((line: { clientLineId: string }) => line.clientLineId === id).productId).toBe("9007199254740994");
  });
}

test("gift checkbox is centered checked unchecked disabled and resized", async ({ page }) => {
  const panel = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
  const cell = panel.locator('.ag-row[row-index="0"] [col-id="isGift"]');
  const input = cell.locator("input");
  const centered = async () => {
    const a = (await cell.boundingBox())!, b = (await input.boundingBox())!;
    expect(Math.abs(a.x + a.width / 2 - b.x - b.width / 2)).toBeLessThan(2);
    expect(Math.abs(a.y + a.height / 2 - b.y - b.height / 2)).toBeLessThan(2);
  };
  await centered();
  await input.click();
  await expect(input).toBeChecked();
  await centered();
  const handle = panel.locator('.ag-header-cell[col-id="isGift"] .ag-header-cell-resize');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await centered();
  await page.getByRole("button", { name: "Stub: chờ điều khiển", exact: true }).click();
  await panel.getByRole("button", { name: "Lưu chứng từ (stub)", exact: true }).click();
  await expect(input).toBeDisabled();
  await centered();
});


test("product commit ignores stale highlight free query and composition", async ({ page }) => {
  const panel = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
  await panel.locator('.ag-row[row-index="0"] [col-id="product"]').dblclick();
  const input = panel.getByRole("combobox", { name: "Sản phẩm grid", exact: true });
  await input.fill("SP002");
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1);
  await input.press("ArrowDown");
  await input.fill("không có kết quả");
  await input.press("Tab");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("không có kết quả");
  await input.press("Enter");
  await expect(input).toBeFocused();
  await input.fill("SP002");
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1);
  await input.press("ArrowDown");
  await input.dispatchEvent("compositionstart", { data: "" });
  await input.press("Enter");
  await input.press("Tab");
  await expect(input).toBeFocused();
  await input.dispatchEvent("compositionend", { data: "2" });
  await input.press("Tab");
  await expect(input).toBeFocused();
  await input.press("Escape");
  await input.press("Escape");
  await expect(panel.locator('.ag-row[row-index="0"] [col-id="product"]')).toHaveText("Cà phê sữa");
});
