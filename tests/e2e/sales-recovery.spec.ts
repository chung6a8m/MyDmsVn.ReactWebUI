import { test, expect, type Page, type Locator } from "@playwright/test";
// Browser plugin not available; exercise only rendered UI/public port results.
let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) errors.push(m.text());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/lab/sales");
  await page
    .getByText("Điều khiển fake Sales (ngoài sản phẩm)", { exact: true })
    .click();
});
test.afterEach(() => expect(errors).toEqual([]));
const b = (p: Locator, name: string) =>
  p.getByRole("button", { name, exact: true });
async function open(page: Page) {
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  const p = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
  await expect(p.getByLabel("Ghi chú", { exact: true })).toBeVisible();
  return p;
}
async function mode(page: Page, value: string) {
  await page
    .getByLabel("Kết quả mutation", { exact: true })
    .selectOption(value);
}
async function readMode(page: Page, value: string) {
  await page.getByLabel("Kết quả đọc", { exact: true }).selectOption(value);
}
async function locked(p: Locator) {
  await expect(b(p, "Lưu chứng từ")).toBeDisabled();
  await expect(p.getByLabel("Ghi chú", { exact: true })).toBeDisabled();
}
for (const operation of ["update", "post"] as const) {
  test(`unknown ${operation} requires positive read and explicit confirmation`, async ({
    page,
  }) => {
    const p = await open(page);
    if (operation === "update")
      await p.getByLabel("Ghi chú", { exact: true }).fill("Snapshot bất biến");
    await mode(page, "commit-then-response-lost");
    await b(
      p,
      operation === "update" ? "Lưu chứng từ" : "Post chứng từ",
    ).click();
    await expect(
      p.getByRole("region", { name: "Đối soát kết quả", exact: true }),
    ).toBeVisible();
    await locked(p);
    for (const rm of [
      "old-version",
      "error",
      "deny",
      ...(operation === "update" ? ["mismatch"] : []),
    ]) {
      await readMode(page, rm);
      await b(p, "Đọc lại để đối soát").click();
      await expect(b(p, "Xác nhận dùng bản authoritative")).toBeDisabled();
      await locked(p);
    }
    await readMode(page, "success");
    await b(p, "Đọc lại để đối soát").click();
    await expect(b(p, "Xác nhận dùng bản authoritative")).toBeEnabled();
    await locked(p);
    await expect(p.getByTestId("mutation-snapshot")).toContainText(
      operation === "update" ? "Snapshot bất biến" : "1001",
    );
    await b(p, "Xác nhận dùng bản authoritative").click();
    await expect(
      p.getByRole("region", { name: "Đối soát kết quả", exact: true }),
    ).toHaveCount(0);
    if (operation === "update")
      await expect(p.getByLabel("Ghi chú", { exact: true })).toBeEnabled();
    else await expect(p.getByLabel("Ghi chú", { exact: true })).toBeDisabled();
  });
}
test("eventual commit leaves old Get locked until external release", async ({
  page,
}) => {
  const p = await open(page);
  await p.getByLabel("Ghi chú", { exact: true }).fill("Commit sau Get");
  await mode(page, "eventual-commit");
  await b(p, "Lưu chứng từ").click();
  await b(p, "Đọc lại để đối soát").click();
  await expect(b(p, "Xác nhận dùng bản authoritative")).toBeDisabled();
  await locked(p);
  await page
    .getByRole("button", { name: "Hoàn tất request-1", exact: true })
    .click();
  await b(p, "Đọc lại để đối soát").click();
  await expect(b(p, "Xác nhận dùng bản authoritative")).toBeEnabled();
  await b(p, "Xác nhận dùng bản authoritative").click();
  await expect(p.getByLabel("Ghi chú", { exact: true })).toHaveValue(
    "Commit sau Get",
  );
  await expect(b(p, "Lưu chứng từ")).toBeEnabled();
});
test("create unknown list empty error and many never replay; chosen candidate requires Get and confirmation", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Chứng từ mới", exact: true }).click();
  let p = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  const session = await p.getAttribute("data-session-id");
  for (const [label, query] of [
    ["Khách hàng", "KH001"],
    ["Kho", "K001"],
    ["Nhân viên", "NV001"],
  ]) {
    const input = p.getByRole("combobox", { name: label, exact: true });
    await input.fill(query);
    await page.getByRole("listbox").getByRole("option").first().click();
    await input.press("Tab");
  }
  await p.locator('.ag-row[row-index="0"] [col-id="product"]').dblclick();
  const product = p.getByRole("combobox", {
    name: "Sản phẩm grid",
    exact: true,
  });
  await product.fill("SP001");
  await page.getByRole("listbox").getByRole("option").first().click();
  await product.press("Tab");
  await p.getByLabel("Ghi chú", { exact: true }).fill("Ứng viên tạo chưa rõ");
  await mode(page, "commit-then-response-lost");
  await b(p, "Lưu chứng từ").click();
  await locked(p);
  for (const rm of ["empty-list", "error", "success"]) {
    await readMode(page, rm);
    await b(p, "Tìm ứng viên qua list").click();
    await expect(b(p, "Xác nhận dùng bản authoritative")).toBeDisabled();
    await locked(p);
    if (rm === "success")
      await expect(p.getByRole("button", { name: /^Đối chiếu / })).toHaveCount(
        10,
      );
  }
  await p.getByLabel("ID ứng viên", { exact: true }).fill("1001");
  await b(p, "Đọc lại để đối soát").click();
  await expect(b(p, "Xác nhận dùng bản authoritative")).toBeDisabled();
  await p.getByLabel("ID ứng viên", { exact: true }).fill("9007199254741100");
  await b(p, "Đọc lại để đối soát").click();
  await expect(b(p, "Xác nhận dùng bản authoritative")).toBeEnabled();
  await p.getByLabel("ID ứng viên", { exact: true }).fill("1001");
  await expect(b(p, "Xác nhận dùng bản authoritative")).toBeDisabled();
  await p.getByLabel("ID ứng viên", { exact: true }).fill("9007199254741100");
  await expect(b(p, "Xác nhận dùng bản authoritative")).toBeEnabled();
  await locked(p);
  await b(p, "Xác nhận dùng bản authoritative").click();
  p = page.locator(`[data-session-id="${session}"]`);
  await expect(p).toHaveAttribute("aria-label", "Chứng từ 9007199254741100");
  await expect(p.getByLabel("Ghi chú", { exact: true })).toHaveValue(
    "Ứng viên tạo chưa rõ",
  );
  await expect(
    p.getByRole("region", { name: "Đối soát kết quả", exact: true }),
  ).toHaveCount(0);
});
