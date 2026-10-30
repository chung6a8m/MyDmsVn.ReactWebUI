import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
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

test("reopen_record_activates_existing_session", async ({ page }) => {
  await page.goto("/lab/sales");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Chứng từ 1001",
    exact: true,
  });
  await panel.getByLabel("Ghi chú").fill("Bản nháp tiếng Việt");
  const session = await panel.getAttribute("data-session-id");
  await page.getByRole("button", { name: "Mở mẫu 1002", exact: true }).click();
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  await expect(panel.getByLabel("Ghi chú")).toHaveValue("Bản nháp tiếng Việt");
  await expect(panel).toHaveAttribute("data-session-id", session!);
  await expect(
    page.getByRole("tab", { name: "Sales 1001", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("link", { name: "Components Lab", exact: true }).click();
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  await expect(panel.getByLabel("Ghi chú")).toHaveValue("Bản nháp tiếng Việt");
  await expect(panel).toHaveAttribute("data-session-id", session!);
});

test("move_panel_does_not_close_session", async ({ page }) => {
  await page.goto("/lab/sales");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Chứng từ 1001",
    exact: true,
  });
  const qty = panel.getByLabel("Số lượng dòng 1", { exact: true });
  await qty.fill("-");
  const identity = await panel.getAttribute("data-session-id");
  const line = await qty.getAttribute("data-line-id");
  await page.getByRole("button", { name: "Mở mẫu 1002", exact: true }).click();
  await page
    .getByRole("button", { name: "Tách sang phải", exact: true })
    .click();
  await expect(panel).toBeVisible();
  const tab = page.getByRole("tab", { name: "Sales 1001", exact: true });
  const destination = page.getByRole("tab", {
    name: "Sales 1002",
    exact: true,
  });
  const destinationElement = await destination.elementHandle();
  expect(
    await tab.evaluate(
      (node, destination) =>
        node.closest(".dv-groupview") === destination!.closest(".dv-groupview"),
      destinationElement,
    ),
  ).toBe(false);
  const sourceBox = (await tab.boundingBox())!;
  const targetBox = (await page
    .getByRole("region", { name: "Chứng từ 1002", exact: true })
    .boundingBox())!;
  await page.mouse.move(sourceBox.x + 30, sourceBox.y + 10);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + 60, sourceBox.y + 10, { steps: 5 });
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 20 },
  );
  await page.mouse.move(
    targetBox.x + targetBox.width / 2 + 2,
    targetBox.y + targetBox.height / 2,
    { steps: 2 },
  );
  await page.mouse.up();
  await expect
    .poll(() =>
      tab.evaluate(
        (node, destination) =>
          node.closest(".dv-groupview") ===
          destination!.closest(".dv-groupview"),
        destinationElement,
      ),
    )
    .toBe(true);
  await tab.click();
  await expect(qty).toHaveValue("-");
  await expect(qty).toHaveAttribute("data-line-id", line!);
  await expect(panel).toHaveAttribute("data-session-id", identity!);
  await expect(panel).toHaveAttribute("data-generation", "1");
  await expect(panel).toHaveAttribute("data-request-generation", "1");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(qty).toHaveValue("-");
  await tab.click({ button: "middle" });
  await expect(panel).toBeVisible();
});

test("column_and_scroll_state_survive_hide_resize_and_route_remount", async ({
  page,
}) => {
  await page.goto("/lab/sales");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Chứng từ 1001",
    exact: true,
  });
  const header = panel.getByRole("columnheader", {
    name: "Sản phẩm",
    exact: true,
  });
  const handle = panel.locator(
    '.ag-header-cell[col-id="product"] .ag-header-cell-resize',
  );
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  const width = (await header.boundingBox())!.width;
  expect(width).toBeGreaterThan(350);
  const headers = panel.getByRole("columnheader");
  const order = () =>
    headers.evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          id: node.getAttribute("col-id"),
          x: node.getBoundingClientRect().x,
        }))
        .sort((a, b) => a.x - b.x)
        .map((item) => item.id),
    );
  const beforeOrder = await order();
  const productBox = (await header.boundingBox())!;
  const qtyHeaderBox = (await panel
    .getByRole("columnheader", { name: "Số lượng · raw harness", exact: true })
    .boundingBox())!;
  await page.mouse.move(productBox.x + 50, productBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(
    qtyHeaderBox.x + qtyHeaderBox.width - 20,
    qtyHeaderBox.y + 20,
    { steps: 20 },
  );
  await page.mouse.up();
  await expect.poll(order).not.toEqual(beforeOrder);
  const changedOrder = await order();
  const viewport = panel.locator(".ag-grid-viewport");
  await viewport.hover();
  await page.mouse.wheel(0, 600);
  await expect
    .poll(() => viewport.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(300);
  const scroll = await viewport.evaluate((node) => node.scrollTop);
  await page.getByRole("button", { name: "Mở mẫu 1002", exact: true }).click();
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  await expect
    .poll(async () => (await header.boundingBox())!.width)
    .toBe(width);
  await expect
    .poll(() => viewport.evaluate((node) => node.scrollTop))
    .toBe(scroll);
  await page
    .getByRole("button", { name: "Tách sang phải", exact: true })
    .click();
  await expect
    .poll(async () => (await header.boundingBox())!.width)
    .toBe(width);
  await expect
    .poll(() => viewport.evaluate((node) => node.scrollTop))
    .toBe(scroll);
  const sash = (await page.locator(".dv-sash.dv-enabled").boundingBox())!;
  const panelWidth = (await panel.boundingBox())!.width;
  await page.mouse.move(sash.x + sash.width / 2, sash.y + 80);
  await page.mouse.down();
  await page.mouse.move(sash.x + 110, sash.y + 80, { steps: 10 });
  await page.mouse.up();
  await expect
    .poll(async () => (await panel.boundingBox())!.width)
    .not.toBe(panelWidth);
  await expect
    .poll(async () => (await header.boundingBox())!.width)
    .toBe(width);
  await expect
    .poll(() => viewport.evaluate((node) => node.scrollTop))
    .toBe(scroll);
  await page.getByRole("link", { name: "Components Lab", exact: true }).click();
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  await expect
    .poll(async () => (await header.boundingBox())!.width)
    .toBe(width);
  await expect
    .poll(() => viewport.evaluate((node) => node.scrollTop))
    .toBe(scroll);
  await expect.poll(order).toEqual(changedOrder);
});

test("two_groups_route_to_focused_document", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  await page.getByRole("button", { name: "Mở mẫu 1002", exact: true }).click();
  await page
    .getByRole("button", { name: "Tách sang phải", exact: true })
    .click();
  const a = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
  const b = page.getByRole("region", { name: "Chứng từ 1002", exact: true });
  await expect(a).toBeVisible();
  await expect(b).toBeVisible();
  await a.getByLabel("Ghi chú").click();
  await page
    .getByRole("button", { name: "Đánh dấu phiên", exact: true })
    .click();
  await expect(a.getByText("Lệnh đã nhận: 1", { exact: true })).toBeVisible();
  await expect(b.getByText("Lệnh đã nhận: 0", { exact: true })).toBeVisible();
  await b.getByLabel("Ghi chú").click();
  await page.keyboard.press("Control+Alt+m");
  await expect(b.getByText("Lệnh đã nhận: 1", { exact: true })).toBeVisible();
});
