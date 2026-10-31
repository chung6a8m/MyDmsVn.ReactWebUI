import { test, expect } from "@playwright/test";

let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) errors.push(m.text());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/lab/sales");
});
test.afterEach(() => expect(errors).toEqual([]));
for (const [label, noun] of [["Khách hàng", "khách hàng"], ["Kho", "kho"], ["Nhân viên", "nhân viên"]]) {
  test(`header ${label} compact actions and contextual validation`, async ({ page }) => {
    await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
    const panel = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
    const input = panel.getByRole("combobox", { name: label, exact: true });
    const field = panel.locator("[data-lookup]").filter({ has: page.getByRole("combobox", { name: label, exact: true }) });
    const clear = field.getByRole("button", { name: "Xóa lựa chọn", exact: true });
    const restore = field.getByRole("button", { name: "Khôi phục lựa chọn", exact: true });
    await expect(restore).toBeDisabled();
    await expect(input).toHaveAttribute("aria-invalid", "false");
    const a = (await input.boundingBox())!, b = (await clear.boundingBox())!;
    expect(Math.abs(a.y + a.height / 2 - b.y - b.height / 2)).toBeLessThan(2);
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.width);
    await input.fill("chưa xác nhận");
    await input.press("Escape");
    await expect(field.getByRole("status")).toHaveText(`Chọn ${noun} hoặc khôi phục lựa chọn.`);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAttribute("aria-describedby", await field.getByRole("status").getAttribute("id") ?? "");
    await expect(restore).toBeEnabled();
    await input.press("Tab");
    await expect(clear).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(restore).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(input).toHaveAttribute("aria-invalid", "false");
    await clear.click();
    await expect(field.getByRole("status")).toHaveText(`Cần chọn ${noun}.`);
    const font = await field.getByRole("status").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const labelFont = await field.locator("label").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(font).toBeLessThan(labelFont);
    await panel.getByRole("button", { name: "Kiểm tra snapshot", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText(`Cần chọn ${noun}.`);
    await input.fill("chưa xác nhận");
    await panel.getByRole("button", { name: "Lưu chứng từ (stub)", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText(`Chọn ${noun} hoặc khôi phục lựa chọn.`);
  });
}

test("note_status_and_line_count_align_with_controls_when_wrapping", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Chứng từ mới", exact: true }).click();
  const panel = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  for (const noun of ["khách hàng", "kho", "nhân viên"])
    await expect(panel.getByText(`Cần chọn ${noun}.`, { exact: true })).toBeVisible();
  const note = panel.getByLabel("Ghi chú", { exact: true });
  for (const dirty of [false, true]) {
    if (dirty) await note.fill("Kiểm tra căn hàng");
    const box = (await note.boundingBox())!;
    const status = (await panel.getByText(dirty ? "Chưa lưu" : "Chưa thay đổi", { exact: true }).boundingBox())!;
    expect(Math.abs(box.y + box.height / 2 - status.y - status.height / 2)).toBeLessThan(2);
  }
  const add = panel.getByRole("button", { name: "Thêm dòng", exact: true });
  for (const count of [1, 6]) {
    if (count === 6) for (let i = 0; i < 5; i++) await add.click();
    const button = (await add.boundingBox())!, text = (await panel.getByText(`${count} dòng`, { exact: true }).boundingBox())!;
    expect(Math.abs(button.y + button.height / 2 - text.y - text.height / 2)).toBeLessThan(2);
  }
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(add).toBeVisible();
  await expect(panel.getByText("6 dòng", { exact: true })).toBeVisible();
  const noteBox = (await note.boundingBox())!;
  const statusBox = (await panel.getByText("Chưa lưu", { exact: true }).boundingBox())!;
  expect(Math.abs(noteBox.y + noteBox.height / 2 - statusBox.y - statusBox.height / 2)).toBeLessThan(2);
  await page.setViewportSize({ width: 600, height: 1100 });
  const first = (await panel.getByRole("button", { name: "Lưu chứng từ (stub)", exact: true }).boundingBox())!;
  const last = (await panel.getByRole("button", { name: "Kiểm tra lookup", exact: true }).boundingBox())!;
  expect(last.y).toBeGreaterThan(first.y);
  const button = (await add.boundingBox())!, count = (await panel.getByText("6 dòng", { exact: true }).boundingBox())!;
  expect(Math.abs(button.y + button.height / 2 - count.y - count.height / 2)).toBeLessThan(2);
  await page.setViewportSize({ width: 900, height: 900 });
  await page.screenshot({ path: testInfo.outputPath("review-3-header.png") });
});
