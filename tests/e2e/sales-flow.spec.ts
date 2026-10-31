import { test, expect, type Page, type Locator } from "@playwright/test";
import { openDecimal } from "./decimal-helpers";
// Browser plugin not available; run the repository's Chromium Playwright project.
let errors: string[] = [];
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
const button = (panel: Locator, name: string) =>
  panel.getByRole("button", { name, exact: true });
async function controls(page: Page) {
  await page
    .getByText("Điều khiển fake Sales (ngoài sản phẩm)", { exact: true })
    .click();
}
async function open(page: Page, id = "1001") {
  await page.getByRole("button", { name: `Mở mẫu ${id}`, exact: true }).click();
  const p = page.getByRole("region", { name: `Chứng từ ${id}`, exact: true });
  await expect(p.getByLabel("Ghi chú", { exact: true })).toBeVisible();
  return p;
}
async function create(page: Page) {
  await page.getByRole("button", { name: "Chứng từ mới", exact: true }).click();
  const p = page.getByRole("region", { name: "Chứng từ mới", exact: true });
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
  return p;
}

test("create edit save post preserves session and row identity", async ({
  page,
}, testInfo) => {
  let p = await create(page);
  const session = await p.getAttribute("data-session-id");
  const row = await p.locator('.ag-row[row-index="0"]').getAttribute("row-id");
  await (await openDecimal(p, "qty")).fill("2.5000");
  await (await openDecimal(p, "unitPrice")).fill("12.5000");
  await button(p, "Lưu chứng từ").click();
  p = page.locator(`[data-session-id="${session}"]`);
  await expect(p.getByRole("alert")).toContainText("Đã lưu");
  await expect(p.locator('.ag-row[row-index="0"]')).toHaveAttribute(
    "row-id",
    row!,
  );
  await expect(p).toHaveAttribute("data-session-id", session!);
  await expect(p).toContainText("Tổng 31.2500");
  await expect(p.locator('.ag-row[row-index="0"] [col-id="unit"]')).toHaveText(
    "Hộp",
  );
  await p.getByLabel("Ghi chú", { exact: true }).fill("Giao hàng tiếng Việt");
  await button(p, "Lưu chứng từ").click();
  await expect(p.getByRole("alert")).toContainText("Đã lưu");
  await button(p, "Post chứng từ").click();
  await expect(p.getByRole("alert")).toContainText("Đã Post");
  await expect(p.getByLabel("Ghi chú", { exact: true })).toBeDisabled();
  await expect(button(p, "Lưu chứng từ")).toBeDisabled();
  await expect(
    p.locator('.ag-row[row-index="0"] [col-id="isGift"] input'),
  ).toBeDisabled();
  const qtyCell = p.locator('.ag-row[row-index="0"] [col-id="qty"]');
  await qtyCell.click();
  await qtyCell.press("F2");
  await qtyCell.press("9");
  await qtyCell.evaluate((element) => {
    const data = new DataTransfer();
    data.setData("text/plain", "999");
    element.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true }),
    );
  });
  await expect(p.getByLabel("Số lượng dòng 1", { exact: true })).toHaveCount(0);
  await expect(qtyCell).toHaveText("2.5000");
  const giftCell = p.locator('.ag-row[row-index="0"] [col-id="isGift"]');
  await giftCell.click({ position: { x: 4, y: 4 } });
  await giftCell.press("Space");
  await expect(giftCell.locator("input")).not.toBeChecked();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect
    .poll(async () => (await p.boundingBox())!.width)
    .toBeLessThanOrEqual(1280);
  await expect
    .poll(() => p.evaluate((el) => el.scrollWidth - el.clientWidth))
    .toBeLessThanOrEqual(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(0);
  await page.screenshot({
    path: testInfo.outputPath("web06.png"),
  });
});
test("list keyset and filter reset", async ({ page }) => {
  const list = page.getByRole("region", {
    name: "Danh sách Sales",
    exact: true,
  });
  await expect(
    list.getByText("25 chứng từ trên trang", { exact: true }),
  ).toBeVisible();
  const ids = () => list.locator('.ag-row [col-id="saleId"]').allTextContents();
  await expect.poll(ids).toContain("9007199254740994");
  await button(list, "Trang sau").click();
  await expect.poll(ids).not.toContain("9007199254740994");
  await expect(button(list, "Trang trước")).toBeEnabled();
  await list.getByLabel("Product ID", { exact: true }).fill("9007199254740994");
  await expect(button(list, "Trang trước")).toBeDisabled();
  await list
    .getByLabel("Lọc trạng thái", { exact: true })
    .selectOption("Posted");
  await expect
    .poll(() => list.locator('.ag-row [col-id="status"]').allTextContents())
    .toEqual(expect.arrayContaining(["Posted"]));
  await expect(list.locator('.ag-row [col-id="status"]')).not.toContainText([
    "Draft",
  ]);
});
test("independent Write Post denial and known failures preserve input", async ({
  page,
}) => {
  const p = await open(page);
  await controls(page);
  await page.getByLabel("Quyền write", { exact: true }).uncheck();
  await expect(p.getByLabel("Ghi chú", { exact: true })).toBeDisabled();
  await expect(button(p, "Post chứng từ")).toBeEnabled();
  await page.getByLabel("Quyền write", { exact: true }).check();
  await page.getByLabel("Quyền post", { exact: true }).uncheck();
  await expect(button(p, "Post chứng từ")).toBeDisabled();
  await p.getByLabel("Ghi chú", { exact: true }).fill("Không mất buffer");
  const price = await openDecimal(p, "unitPrice");
  await price.fill("3,12500");
  await price.press("Enter");
  for (const mode of [
    "known-failure",
    "version-conflict",
    "reference-conflict",
  ]) {
    await page
      .getByLabel("Kết quả mutation", { exact: true })
      .selectOption(mode);
    await button(p, "Lưu chứng từ").click();
    await expect(p.getByRole("alert")).toContainText(
      mode === "known-failure"
        ? "chưa được thực hiện"
        : mode === "version-conflict"
          ? "đã thay đổi"
          : "tham chiếu",
    );
    await expect(
      p.locator('.ag-row[row-index="0"] [col-id="unitPrice"]'),
    ).toHaveText("3,12500");
    await expect(p.getByLabel("Ghi chú", { exact: true })).toHaveValue(
      "Không mất buffer",
    );
    await expect(button(p, "Lưu chứng từ")).toBeEnabled();
  }
});
test("two delayed sessions reverse completion without retarget or duplicate mutation", async ({
  page,
}) => {
  const a = await open(page);
  await controls(page);
  await page
    .getByLabel("Kết quả mutation", { exact: true })
    .selectOption("delay");
  await a.getByLabel("Ghi chú", { exact: true }).fill("Phiên A");
  await button(a, "Lưu chứng từ").click();
  await expect(button(a, "Lưu chứng từ")).toBeDisabled();
  const b = await open(page, "1002");
  await b.getByLabel("Ghi chú", { exact: true }).fill("Phiên B");
  await button(b, "Lưu chứng từ").click();
  await expect(
    page.getByRole("button", { name: /^Hoàn tất request-/ }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Hoàn tất request-2", exact: true })
    .click();
  await expect(b.getByRole("alert")).toContainText("Đã lưu");
  await page.getByRole("tab", { name: "Sales 1001", exact: true }).click();
  await expect(a.getByLabel("Ghi chú", { exact: true })).toBeDisabled();
  await page
    .getByRole("button", { name: "Hoàn tất request-1", exact: true })
    .click();
  await expect(a.getByLabel("Ghi chú", { exact: true })).toHaveValue("Phiên A");
  await expect(a.getByRole("alert")).toContainText("Đã lưu");
});

test("inactive reference label survives close reopen while catalog excludes it", async ({
  page,
}) => {
  const list = page.getByRole("region", {
    name: "Danh sách Sales",
    exact: true,
  });
  await list.getByLabel("Tìm chứng từ", { exact: true }).fill("Sales 1004");
  await expect(list.locator('.ag-row [col-id="saleId"]')).toHaveText(["1004"]);
  await list.locator('.ag-row [col-id="saleId"]').dblclick();
  const p = page.getByRole("region", { name: "Chứng từ 1004", exact: true });
  const cell = p.locator('.ag-row[row-index="0"] [col-id="product"]');
  await expect(cell).toHaveText("Cà phê ngừng bán");
  await cell.dblclick();
  const input = p.getByRole("combobox", { name: "Sản phẩm grid", exact: true });
  await input.fill("SP004");
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(0);
  await expect(
    page.getByText("Không có kết quả.", { exact: true }),
  ).toBeVisible();
  await input.press("Escape");
  await input.press("Escape");
  await page
    .getByRole("button", { name: "Đóng tài liệu", exact: true })
    .click();
  await expect(p).toHaveCount(0);
  await page.getByRole("tab", { name: "Danh sách Sales", exact: true }).click();
  await list.locator('.ag-row [col-id="saleId"]').dblclick();
  await expect(cell).toHaveText("Cà phê ngừng bán");
});
test("empty header invalid calendar and note block new document save", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "Chứng từ mới", exact: true }).click();
  const p = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  await p.getByLabel("Ngày chứng từ", { exact: true }).fill("2026-02-30");
  await p.getByLabel("Ghi chú", { exact: true }).fill("x".repeat(1001));
  await button(p, "Lưu chứng từ").click();
  await expect(p.getByRole("alert")).toContainText("ngày thật");
  await expect(
    p.getByRole("list", { name: "Lỗi chứng từ", exact: true }),
  ).toContainText("khách hàng");
  await expect(
    p.getByRole("list", { name: "Lỗi chứng từ", exact: true }),
  ).toContainText("1.000");
  await expect(p).toHaveAttribute("aria-label", "Chứng từ mới");
  await expect(p.getByLabel("Ghi chú", { exact: true })).toHaveValue(
    "x".repeat(1001),
  );
  await expect(button(p, "Post chứng từ")).toBeDisabled();
  await expect(button(p, "Lưu chứng từ")).toBeEnabled();
});
