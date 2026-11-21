import { expect, test, type Locator } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()))
      errors.push(message.text());
  });
  (page as typeof page & { appErrors: string[] }).appErrors = errors;
});

test.afterEach(async ({ page }) => {
  expect((page as typeof page & { appErrors: string[] }).appErrors).toEqual([]);
});

async function textCenter(locator: Locator) {
  return locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const rect = range.getBoundingClientRect();
    return rect.top + rect.height / 2;
  });
}

for (const width of [1920, 1440, 900]) {
  for (const theme of ["Light", "Dark"]) {
    test(`sales list control and footer alignment ${width} ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/lab/sales");
      await page.getByRole("button", { name: theme, exact: true }).click();
      const list = page.locator('section[aria-label="Danh sách Sales"]');
      const count = list.getByText("25 chứng từ trên trang", { exact: true });
      await expect(count).toBeVisible();
      const product = list.getByRole("combobox", { name: "Lọc sản phẩm", exact: true });
      const status = list.getByLabel("Lọc trạng thái", { exact: true });
      const productBox = (await product.boundingBox())!;
      const statusBox = (await status.boundingBox())!;
      // A wrapping FilterBar does not promise that last-row controls share a Y coordinate.
      // Inputs remain compact and accessible at all three responsive widths.
      expect.soft(Math.abs(statusBox.height - productBox.height)).toBeLessThanOrEqual(2);
      const listBox = (await list.boundingBox())!;
      expect.soft(productBox.x).toBeGreaterThanOrEqual(listBox.x);
      expect.soft(statusBox.x + statusBox.width).toBeLessThanOrEqual(listBox.x + listBox.width);
      if (width === 900) {
        const firstBox = (await list
          .getByLabel("Tìm chứng từ", { exact: true })
          .boundingBox())!;
        expect(statusBox.y).toBeGreaterThan(firstBox.y + firstBox.height);
      }
      const previous = list.getByRole("button", {
        name: "Trang trước",
        exact: true,
      });
      const next = list.getByRole("button", { name: "Trang sau", exact: true });
      const reload = list.getByRole("button", {
        name: "Tải lại danh sách",
        exact: true,
      });
      await expect(previous).toBeDisabled();
      await expect(next).toBeEnabled();
      await expect(reload).toBeEnabled();
      const center = await textCenter(count);
      for (const button of [previous, next, reload]) {
        expect
          .soft(Math.abs(center - (await textCenter(button))))
          .toBeLessThanOrEqual(1.5);
      }
      if (width === 1440 && theme === "Light") {
        await page.screenshot({
          path: testInfo.outputPath("sales-list-wide.png"),
        });
      }
    });
  }
}

test("sales status selection resets pagination and keeps native keyboard filtering", async ({
  page,
}) => {
  await page.goto("/lab/sales");
  const list = page.locator('section[aria-label="Danh sách Sales"]');
  const previous = list.getByRole("button", {
    name: "Trang trước",
    exact: true,
  });
  const next = list.getByRole("button", { name: "Trang sau", exact: true });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(previous).toBeEnabled();
  const status = list.getByLabel("Lọc trạng thái", { exact: true });
  await status.focus();
  await status.press("End");
  await expect(status).toHaveValue("Posted");
  await expect(previous).toBeDisabled();
  await expect(next).toBeDisabled();
  await expect
    .poll(() => list.locator('.ag-row [col-id="status"]').allTextContents())
    .toEqual(Array(8).fill("Posted"));
  await status.selectOption("");
  await expect(
    list.getByText("25 chứng từ trên trang", { exact: true }),
  ).toBeVisible();
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
});

test("sales list footer wraps with aligned count and usable actions", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/lab/sales");
  const list = page.locator('section[aria-label="Danh sách Sales"]');
  const count = list.getByText("25 chứng từ trên trang", { exact: true });
  const previous = list.getByRole("button", {
    name: "Trang trước",
    exact: true,
  });
  const reload = list.getByRole("button", {
    name: "Tải lại danh sách",
    exact: true,
  });
  await expect(count).toBeVisible();
  const previousBox = (await previous.boundingBox())!;
  const reloadBox = (await reload.boundingBox())!;
  expect(reloadBox.y).toBeGreaterThan(previousBox.y + previousBox.height);
  expect(
    Math.abs((await textCenter(count)) - (await textCenter(reload))),
  ).toBeLessThanOrEqual(1.5);
  const listBox = (await list.boundingBox())!;
  for (const control of [previous, reload, count]) {
    const box = (await control.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(listBox.x);
    expect(box.x + box.width).toBeLessThanOrEqual(listBox.x + listBox.width);
  }
  await expect(previous).toBeDisabled();
  await reload.click();
  await expect(count).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("sales-list-footer-wrap.png"),
  });
});

test("Sales optional catalog filters only apply an explicit selection or clear", async ({ page }) => {
  await page.goto("/lab/sales");
  const list = page.locator('section[aria-label="Danh sách Sales"]');
  const previous = list.getByRole("button", { name: "Trang trước", exact: true });
  const next = list.getByRole("button", { name: "Trang sau", exact: true });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(previous).toBeEnabled();
  const customer = list.getByRole("combobox", { name: "Lọc khách hàng", exact: true });
  await customer.fill("KH001");
  await expect(previous).toBeEnabled(); // raw/highlight cannot reset an applied cursor
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1);
  await page.getByRole("listbox").getByRole("option").first().click();
  await expect(customer).toHaveValue("Khách hàng mẫu");
  await expect(previous).toBeDisabled(); // committed ID resets the keyset cursor

  const product = list.getByRole("combobox", { name: "Lọc sản phẩm", exact: true });
  await product.fill("SP001");
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1);
  await product.press("ArrowDown");
  await product.press("Enter");
  await expect(product).toHaveValue("Cà phê sữa");
  const lookup = list.locator("[data-lookup]").filter({ has: product });
  await lookup.getByRole("button", { name: "Xóa lựa chọn" }).click();
  await expect(product).toHaveValue("");
  await expect(list).not.toContainText("Cần chọn sản phẩm.");
  await expect(list.getByText("25 chứng từ trên trang", { exact: true })).toBeVisible();
});
