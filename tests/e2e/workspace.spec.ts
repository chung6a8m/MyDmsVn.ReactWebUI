import { decimalCell, openDecimal } from "./decimal-helpers";
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
  const qty = await openDecimal(panel, "qty");
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
  await openDecimal(panel, "qty");
  await expect(qty).toHaveValue("-");
  await expect(qty).toHaveAttribute("data-line-id", line!);
  await expect(panel).toHaveAttribute("data-session-id", identity!);
  await expect(panel).toHaveAttribute("data-generation", "1");
  await expect(panel).toHaveAttribute("data-request-generation", "1");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(decimalCell(panel, "qty")).toHaveText("-");
  await tab.click({ button: "middle" });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Tiếp tục sửa", exact: true }).click();
  await expect(panel).toBeVisible();
});

test("close_x_middle_click_invalid_cancel_and_discard", async ({ page }) => {
  await page.goto("/lab/sales");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Chứng từ 1001",
    exact: true,
  });
  const tab = page.getByRole("tab", { name: "Sales 1001", exact: true });
  const qty = await openDecimal(panel, "qty");
  await qty.fill("-");
  await tab.getByRole("button", { name: "Close tab", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(panel.getByRole("alert").first()).toContainText("Số không hợp lệ");
  await expect(qty).toHaveValue("-");
  await expect(qty).toBeFocused();
  await qty.fill("2.25");
  await qty.press("Enter");
  await expect(qty).toHaveCount(0);
  await expect(decimalCell(panel, "qty")).toHaveText("2.25");
  await openDecimal(panel, "qty");
  await qty.fill("-");
  await panel.getByLabel("Ghi chú").click();
  await page
    .getByRole("button", { name: "Đóng tài liệu", exact: true })
    .click();
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(qty).toBeFocused();
  await tab.click({ button: "middle" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(decimalCell(panel, "qty")).toHaveText("-");
  await tab.click({ button: "middle" });
  await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
  await expect(tab).toHaveCount(0);
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  await expect(decimalCell(panel, "qty")).toHaveText("1.0000");
  await tab.click({ button: "middle" });
  await expect(tab).toHaveCount(0);
});

test("save_failure_then_success_and_repeated_keyboard_close", async ({
  page,
}) => {
  await page.goto("/lab/sales");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Chứng từ 1001",
    exact: true,
  });
  await panel.getByLabel("Ghi chú").fill("Save thất bại vẫn giữ");
  await page.getByText("Điều khiển fake Sales (ngoài sản phẩm)", {exact:true}).click();
  await page.getByLabel("Kết quả mutation", {exact:true}).selectOption("known-failure");
  await page.keyboard.press("Control+Alt+w");
  await page.keyboard.press("Control+Alt+w");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(panel.getByRole("alert").first()).toContainText("chưa được thực hiện");
  await expect(panel.getByLabel("Ghi chú")).toHaveValue(
    "Save thất bại vẫn giữ",
  );
  await page.getByLabel("Kết quả mutation", {exact:true}).selectOption("success");
  await page
    .getByRole("button", { name: "Đóng tài liệu", exact: true })
    .click();
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Sales 1001", exact: true }),
  ).toHaveCount(0);
});

test("close_all_stops_at_cancel_and_inactive_tab_keeps_its_target", async ({
  page,
}) => {
  await page.goto("/lab/sales");
  for (const id of ["1001", "1002"]) {
    await page
      .getByRole("button", { name: `Mở mẫu ${id}`, exact: true })
      .click();
    await page
      .getByRole("region", { name: `Chứng từ ${id}`, exact: true })
      .getByLabel("Ghi chú")
      .fill(`draft ${id}`);
  }
  await page
    .getByRole("button", { name: "Tách sang phải", exact: true })
    .click();
  await page
    .getByRole("tab", { name: "Sales 1001", exact: true })
    .getByRole("button", { name: "Close tab" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Đóng Sales 1001?");
  await page.getByRole("button", { name: "Tiếp tục sửa", exact: true }).click();
  await page.getByRole("button", { name: "Đóng tất cả", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Đóng Sales 1001?");
  await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Đóng Sales 1002?");
  await page.getByRole("button", { name: "Tiếp tục sửa", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Sales 1001", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Chứng từ 1002", exact: true })
      .getByLabel("Ghi chú"),
  ).toHaveValue("draft 1002");
});

test("pending_and_unknown_keep_session_while_other_document_is_usable", async ({
  page,
}) => {
  await page.goto("/lab/sales");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  const a = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
  await a.getByLabel("Ghi chú").fill("snapshot bị khóa");
  await page.getByText("Điều khiển fake Sales (ngoài sản phẩm)", {exact:true}).click();
  await page.getByLabel("Kết quả mutation", {exact:true}).selectOption("delay");
  await page
    .getByRole("button", { name: "Đóng tài liệu", exact: true })
    .click();
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(a.getByLabel("Ghi chú")).toBeDisabled();
  await page.getByRole("button", { name: "Mở mẫu 1002", exact: true }).click();
  await page
    .getByRole("button", { name: "Tách sang phải", exact: true })
    .click();
  const b = page.getByRole("region", { name: "Chứng từ 1002", exact: true });
  await b.getByLabel("Ghi chú").fill("B vẫn nhập được");
  const tabA = page.getByRole("tab", { name: "Sales 1001", exact: true });
  await tabA.getByRole("button", { name: "Close tab" }).click();
  await expect(a.getByRole("alert").first()).toContainText("Đang lưu");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const key of ["Delete", "Backspace"]) {
    await tabA.press(key);
    await expect(tabA).toBeVisible();
    await expect(a).toBeAttached();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page
    .getByRole("button", { name: "Mất phản hồi request-1", exact: true })
    .click();
  await tabA.click({ button: "middle" });
  await expect(a.getByRole("alert").first()).toContainText("Kết quả lưu chưa rõ");
  await page.getByRole("button", { name: "Đóng tất cả", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const key of ["Delete", "Backspace"]) {
    await tabA.press(key);
    await expect(tabA).toBeVisible();
    await expect(a).toBeAttached();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await expect(a.getByLabel("Ghi chú")).toHaveValue("snapshot bị khóa");
  await expect(b.getByLabel("Ghi chú")).toHaveValue("B vẫn nhập được");
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
        // Compare the moved columns that remain rendered in both group widths.
        // AG Grid virtualizes trailing headers when the restored split is narrow.
        .filter((item) => ["index", "unit", "qty", "product"].includes(item.id!))
        .sort((a, b) => a.x - b.x)
        .map((item) => item.id),
    );
  const beforeOrder = await order();
  const productBox = (await header.boundingBox())!;
  const qtyHeaderBox = (await panel
    .getByRole("columnheader", { name: "Số lượng", exact: true })
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
