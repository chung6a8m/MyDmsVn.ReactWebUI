import { test, expect } from "@playwright/test";
let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) errors.push(m.text());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/lab/sales");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
});
test.afterEach(() => expect(errors).toEqual([]));
test("seven_columns_decimal_gift_and_last_keystroke_snapshot", async ({
  page,
}) => {
  const panel = page.getByRole("region", {
    name: "Chứng từ 1001",
    exact: true,
  });
  const headers = panel.getByRole("columnheader");
  await expect(headers).toHaveText([
    "STT",
    "Sản phẩm",
    "Đơn vị tính",
    "Số lượng",
    "Đơn giá bán",
    "Tặng",
    "Thành tiền",
  ]);
  const qty = panel.getByLabel("Số lượng dòng 1", { exact: true });
  const price = panel.getByLabel("Đơn giá dòng 1", { exact: true });
  await qty.fill("1.000");
  await qty.press("End");
  await qty.press("1");
  await price.fill("0,500");
  await price.press("End");
  await price.press("0");
  await panel
    .getByRole("button", { name: "Kiểm tra snapshot", exact: true })
    .click();
  await panel.locator("summary").click();
  const snapshot = () =>
    panel
      .getByTestId("prepared-snapshot")
      .textContent()
      .then((s) => JSON.parse(s!));
  await expect.poll(async () => (await snapshot()).lines[0].qty).toBe("1.0001");
  expect((await snapshot()).lines[0].unitPrice).toBe("0.5000");
  await expect(
    panel.getByRole("gridcell", { name: "0.5001", exact: true }),
  ).toBeVisible();
  const gift = panel.locator('.ag-row[row-index="0"] [col-id="isGift"] input');
  await gift.click();
  await expect(gift).toBeChecked();
  await panel
    .getByRole("button", { name: "Kiểm tra snapshot", exact: true })
    .click();
  expect((await snapshot()).lines[0]).toMatchObject({
    isGift: true,
    unitPrice: "0.5000",
  });
  await gift.click();
  await expect(gift).not.toBeChecked();
  await expect(
    panel.getByRole("gridcell", { name: "0.5001", exact: true }),
  ).toBeVisible();
});
test("invalid_decimal_escape_and_header_validation_preserve_input", async ({
  page,
}) => {
  const panel = page.getByRole("region", {
    name: "Chứng từ 1001",
    exact: true,
  });
  const qty = panel.getByLabel("Số lượng dòng 1", { exact: true });
  await qty.fill("-");
  await panel
    .getByRole("button", { name: "Kiểm tra snapshot", exact: true })
    .click();
  await expect(panel.getByRole("alert")).toContainText("Số không hợp lệ");
  await expect(qty).toHaveValue("-");
  await qty.fill("2.25");
  await qty.blur();
  await qty.focus();
  await qty.fill("9");
  await qty.press("Escape");
  await expect(qty).toHaveValue("2.25");
  await panel.getByLabel("Ngày chứng từ", { exact: true }).fill("2026-02-30");
  await panel
    .getByRole("button", { name: "Kiểm tra snapshot", exact: true })
    .click();
  await expect(panel.getByRole("alert")).toContainText("ngày thật");
  await expect(qty).toHaveValue("2.25");
});
test("unmounted_raw_flush_and_lookup_selection_are_in_snapshot", async ({
  page,
}) => {
  const panel = page.getByRole("region", {
    name: "Chứng từ 1001",
    exact: true,
  });
  await panel.getByLabel("Số lượng dòng 1", { exact: true }).fill("3,12500");
  await panel
    .getByRole("gridcell", { name: "Cà phê sữa", exact: true })
    .first()
    .dblclick();
  const product = panel.getByRole("combobox", {
    name: "Sản phẩm grid",
    exact: true,
  });
  await product.fill("SP002");
  await page.getByRole("listbox").getByRole("option").click();
  await product.press("Tab");
  await panel
    .getByRole("button", { name: "Kiểm tra lookup", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Kiểm tra snapshot", exact: true })
    .click();
  await panel.locator("summary").click();
  const s = JSON.parse(
    (await panel.getByTestId("prepared-snapshot").textContent())!,
  );
  expect(s.lines[0].qty).toBe("3.1250");
  expect(s.lines[0].productId).not.toBe(s.lines[1].productId);
  expect(s.lines[0].clientLineId).not.toBe(s.lines[1].clientLineId);
});

test("two_hundred_lines_cap_and_invalid_last_row_preserves_first", async ({
  page,
}) => {
  const panel = page.getByRole("region", {
    name: "Chứng từ 1001",
    exact: true,
  });
  await page.getByRole("button", { name: "Mẫu 200 dòng", exact: true }).click();
  await expect(panel.getByText("200 dòng", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Thêm dòng", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("không thêm dòng 201");
  await panel.getByLabel("Số lượng dòng 1", { exact: true }).fill("7.0001");
  const viewport = panel.locator(".ag-grid-viewport");
  await viewport.hover();
  await page.mouse.wheel(0, 20000);
  const last = panel.getByLabel("Số lượng dòng 200", { exact: true });
  await expect(last).toBeVisible();
  await last.fill("-");
  await panel
    .getByRole("button", { name: "Kiểm tra snapshot", exact: true })
    .click();
  await expect(panel.getByRole("alert")).toContainText("Số không hợp lệ");
  await last.fill("2");
  await panel
    .getByRole("button", { name: "Kiểm tra snapshot", exact: true })
    .click();
  await panel.locator("summary").click();
  const s = JSON.parse(
    (await panel.getByTestId("prepared-snapshot").textContent())!,
  );
  expect(s.lines).toHaveLength(200);
  expect(
    new Set(s.lines.map((l: { clientLineId: string }) => l.clientLineId)).size,
  ).toBe(200);
  expect(s.lines[0].qty).toBe("7.0001");
  expect(s.lines[199].qty).toBe("2.0000");
});

test("date_composition_blocks_prepare_and_gift_keyboard_publishes_before_save", async ({
  page,
}) => {
  const panel = page.getByRole("region", {
    name: "Chứng từ 1001",
    exact: true,
  });
  const date = panel.getByLabel("Ngày chứng từ", { exact: true });
  await date.dispatchEvent("compositionstart", { data: "" });
  await date.fill("2026-10-30");
  await panel
    .getByRole("button", { name: "Kiểm tra snapshot", exact: true })
    .click();
  await expect(panel.getByRole("alert")).toContainText("Hoàn tất nhập liệu");
  await date.dispatchEvent("compositionend", { data: "0" });
  const cell = panel.locator('.ag-row[row-index="0"] [col-id="isGift"]');
  await cell.click({ position: { x: 4, y: 4 } });
  await cell.press("F2");
  await page.keyboard.press("Space");
  await panel
    .getByRole("button", { name: "Kiểm tra snapshot", exact: true })
    .click();
  await panel.locator("summary").click();
  const s = JSON.parse(
    (await panel.getByTestId("prepared-snapshot").textContent())!,
  );
  expect(s.lines[0].isGift).toBe(true);
});


test("product_keyboard_start_and_inline_row_geometry", async ({ page }) => {
  const cell = page.locator('.ag-row[row-index="0"] [col-id="product"]').first();
  const row = cell.locator("..");
  const before = await row.boundingBox();
  await cell.click();
  await cell.press("T");
  const input = page.getByRole("combobox", { name: "Sản phẩm grid", exact: true });
  await expect(input).toHaveValue("T");
  expect((await row.boundingBox())!.height).toBe(before!.height);
  const inputBox = (await input.boundingBox())!;
  expect(inputBox.y).toBeGreaterThanOrEqual(before!.y);
  expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(before!.y + before!.height);
  await input.fill("SP");
  const popup = page.getByRole("listbox", { name: "Sản phẩm grid", exact: true });
  await expect(popup.getByRole("option").first()).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(popup).toBeVisible();
  const popupBox = (await popup.boundingBox())!;
  expect(popupBox.y).toBeGreaterThanOrEqual(0);
  expect(popupBox.y + popupBox.height).toBeLessThanOrEqual(720);
  const clearBox = (await page.getByRole("button", { name: "Xóa lựa chọn", exact: true }).last().boundingBox())!;
  const resizedInput = (await input.boundingBox())!;
  expect(clearBox.x).toBeGreaterThanOrEqual(resizedInput.x + resizedInput.width);
  await input.press("Escape");
  await input.press("Escape");
  await expect(input).toHaveCount(0);
  await expect(cell).toHaveText("Cà phê sữa");
  expect((await row.boundingBox())!.height).toBe(before!.height);
});

test("reseed_after_raw_and_lookup_edits_can_prepare", async ({ page }) => {
  const panel = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
  await panel.getByLabel("Ghi chú", { exact: true }).fill("Giữ header");
  await panel.getByLabel("Số lượng dòng 1", { exact: true }).fill("-");
  await panel.locator('.ag-row[row-index="0"] [col-id="product"]').dblclick();
  await panel.getByRole("combobox", { name: "Sản phẩm grid", exact: true }).fill("chưa chọn");
  await page.getByRole("button", { name: "Mẫu 200 dòng", exact: true }).click();
  await panel.getByRole("button", { name: "Kiểm tra snapshot", exact: true }).click();
  await panel.locator("summary").click();
  const snapshot = JSON.parse((await panel.getByTestId("prepared-snapshot").textContent())!);
  expect(snapshot.lines).toHaveLength(200);
  expect(snapshot.note).toBe("Giữ header");
});

for (const key of ["Delete", "Backspace"]) {
  test(`tab ${key} uses dirty admission`, async ({ page }) => {
    const panel = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
    await panel.getByLabel("Ghi chú", { exact: true }).fill("Chưa lưu");
    await page.getByRole("tab", { name: "Sales 1001", exact: true }).press(key);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(panel).toBeAttached();
  });
}
