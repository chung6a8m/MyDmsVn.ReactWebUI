import { test, expect } from "@playwright/test";
let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) errors.push(m.text());
  });
});
test.afterEach(() => expect(errors).toEqual([]));
test("field_query_selection_clear_and_modal_escape", async ({ page }) => {
  await page.goto("/lab/components");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  await page
    .getByRole("button", { name: "Kiểm tra lookup", exact: true })
    .click();
  const field = page.getByRole("combobox", {
    name: "Sản phẩm field",
    exact: true,
  });
  await field.click();
  await field.fill("Cà");
  await expect(
    page.getByRole("listbox").getByRole("option").first(),
  ).toBeVisible();
  await field.press("ArrowDown");
  await field.press("Enter");
  await expect(field).toHaveValue("Cà phê sữa");
  await expect(page.getByTestId("field-selected")).not.toHaveText("ID: ∅");
  await field.fill("chưa chọn");
  await page
    .getByRole("button", { name: "Kiểm tra Save lookup", exact: true })
    .click();
  await expect(
    page.getByTestId("lookup-harness").getByRole("alert"),
  ).toContainText("Chọn sản phẩm");
  await page
    .getByRole("button", { name: "Mở modal lookup", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const modal = dialog.getByRole("combobox");
  await modal.fill("Cà");
  await expect(dialog.getByRole("listbox")).toBeVisible();
  await modal.press("ArrowDown");
  await modal.press("Escape");
  await expect(dialog.getByRole("listbox")).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await modal.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("grid_escape_restores_start_and_tab_keeps_unconfirmed_raw", async ({
  page,
}) => {
  await page.goto("/lab/components");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  await page
    .getByRole("button", { name: "Kiểm tra lookup", exact: true })
    .click();
  const cell = page
    .getByTestId("lookup-harness")
    .getByRole("gridcell", { name: "Chọn sản phẩm", exact: true })
    .first();
  await cell.dblclick();
  const editor = page.getByRole("combobox", {
    name: "Sản phẩm grid",
    exact: true,
  });
  await expect(editor).toBeFocused();
  await editor.pressSequentially("C");
  await expect(
    page.getByRole("listbox").getByRole("option").first(),
  ).toBeVisible();
  await editor.press("ArrowDown");
  await editor.press("Enter");
  await expect(editor).toHaveValue("Cà phê sữa");
  await expect(editor).toBeVisible();
  await editor.fill("query dở");
  await editor.press("Escape");
  await expect(editor).toHaveValue("query dở");
  await editor.press("Escape");
  await expect(editor).toHaveCount(0);
  await cell.dblclick();
  await expect(editor).toHaveValue("");
  await editor.fill("chưa xác nhận");
  await editor.press("Tab");
  await expect(editor).toHaveCount(0);
  await cell.dblclick();
  await expect(editor).toHaveValue("chưa xác nhận");
});
test("pointer_selection_empty_error_and_hidden_owner_cleanup", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/lab/components");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  await page
    .getByRole("button", { name: "Kiểm tra lookup", exact: true })
    .click();
  const field = page.getByRole("combobox", {
    name: "Sản phẩm field",
    exact: true,
  });
  await field.click();
  const popup = page.getByRole("listbox");
  await expect(popup.getByRole("option")).toHaveCount(25);
  await popup
    .getByRole("option", { name: "SP001 · Cà phê sữa", exact: true })
    .click();
  await expect(field).toHaveValue("Cà phê sữa");
  await field.fill("query giữ lại");
  await page.getByRole("button", { name: "Mở mẫu 1002", exact: true }).click();
  await expect(popup).toHaveCount(0);
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  await expect(field).toHaveValue("query giữ lại");
  await page
    .getByLabel("Danh mục lookup", { exact: true })
    .selectOption("empty");
  await field.fill("");
  await expect(popup).toContainText("Không có kết quả");
  await page
    .getByLabel("Danh mục lookup", { exact: true })
    .selectOption("error");
  await field.click();
  await expect(popup).toContainText("Danh mục tạm thời");
  await expect(page.getByTestId("field-selected")).not.toHaveText("ID: ∅");
});

test("popup_tracks_resize_scroll_move_and_zero_size_owner", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/lab/components");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  await page
    .getByRole("button", { name: "Kiểm tra lookup", exact: true })
    .click();
  const panel = page.getByRole("region", {
    name: "Chứng từ 1001",
    exact: true,
  });
  const field = panel.getByRole("combobox", {
    name: "Sản phẩm field",
    exact: true,
  });
  await field.click();
  const popup = page.getByRole("listbox");
  await expect(popup).toBeVisible();
  await popup.hover();
  await page.mouse.wheel(0, 200);
  await expect
    .poll(() => popup.evaluate((e) => e.scrollTop))
    .toBeGreaterThan(0);
  await expect(popup).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect
    .poll(async () =>
      Math.abs(
        (await field.boundingBox())!.width - (await popup.boundingBox())!.width,
      ),
    )
    .toBeLessThan(2);
  const owner = panel.locator('[data-testid="lookup-harness"]').locator("..");
  await owner.evaluate((e) => {
    e.style.width = "0px";
    e.style.height = "0px";
  });
  await expect(popup).toHaveCount(0);
  await owner.evaluate((e) => {
    e.style.width = "";
    e.style.height = "";
  });
  await field.click();
  await expect(popup).toBeVisible();
  await field.fill("Cà");
  await page.getByRole("button", { name: "Mở mẫu 1002", exact: true }).click();
  await page
    .getByRole("button", { name: "Tách sang phải", exact: true })
    .click();
  await expect(field).toBeVisible();
  const tab = page.getByRole("tab", { name: "Sales 1001", exact: true });
  const dest = page.getByRole("tab", { name: "Sales 1002", exact: true });
  const destHandle = await dest.elementHandle();
  const source = (await tab.boundingBox())!;
  const target = (await page
    .getByRole("region", { name: "Chứng từ 1002", exact: true })
    .boundingBox())!;
  await page.mouse.move(source.x + 30, source.y + 10);
  await page.mouse.down();
  await page.mouse.move(source.x + 60, source.y + 10, { steps: 5 });
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 20 },
  );
  await page.mouse.move(
    target.x + target.width / 2 + 2,
    target.y + target.height / 2,
    { steps: 2 },
  );
  await page.mouse.up();
  await expect
    .poll(() =>
      tab.evaluate(
        (n, d) => n.closest(".dv-groupview") === d!.closest(".dv-groupview"),
        destHandle,
      ),
    )
    .toBe(true);
  await tab.click();
  await expect(field).toHaveValue("Cà");
  await field.click();
  await expect(popup).toBeVisible();
  expect(
    await popup.evaluate((e) => !!e.closest("[data-lookup-overlay-host]")),
  ).toBe(true);
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await field.click();
  await expect(popup).toBeVisible();
});
test("touch_scroll_and_modal_pointer_keep_owner_focus", async ({
  page,
  context,
}) => {
  await page.goto("/lab/components");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  await page
    .getByRole("button", { name: "Kiểm tra lookup", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mở modal lookup", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const input = dialog.getByRole("combobox");
  await input.click();
  const popup = dialog.getByRole("listbox");
  await expect(popup.getByRole("option")).toHaveCount(25);
  expect(await popup.evaluate((e) => !e.closest("[inert]"))).toBe(true);
  const client = await context.newCDPSession(page);
  const b = (await popup.boundingBox())!;
  const x = b.x + b.width / 2,
    y = b.y + b.height - 25;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let step = 1; step <= 8; step++)
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y - step * 20 }],
    });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(() => popup.evaluate((e) => e.scrollTop))
    .toBeGreaterThan(0);
  await expect(input).toHaveValue("");
  await input.fill("Cà");
  await popup
    .getByRole("option", { name: "SP001 · Cà phê sữa", exact: true })
    .click();
  await expect(input).toHaveValue("Cà phê sữa");
  await expect(input).toBeFocused();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    await expect
      .poll(() => dialog.evaluate((e) => e.contains(document.activeElement)))
      .toBe(true);
  }
  await expect(dialog).toBeVisible();
});

test("synthetic_ime_does_not_commit_grid_and_text_navigation_stays_native", async ({
  page,
}) => {
  await page.goto("/lab/components");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  await page
    .getByRole("button", { name: "Kiểm tra lookup", exact: true })
    .click();
  await page
    .getByTestId("lookup-harness")
    .getByRole("gridcell", { name: "Chọn sản phẩm", exact: true })
    .first()
    .dblclick();
  const input = page.getByRole("combobox", {
    name: "Sản phẩm grid",
    exact: true,
  });
  await input.dispatchEvent("compositionstart", { data: "" });
  await input.fill("Cà phê");
  await input.press("Enter");
  await input.press("Escape");
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("Cà phê");
  await expect(
    page.getByRole("option", { name: "SP001 · Cà phê sữa", exact: true }),
  ).toHaveCount(0);
  await input.dispatchEvent("compositionend", { data: "ê" });
  await expect(
    page.getByRole("listbox").getByRole("option").first(),
  ).toBeVisible();
  await input.press("Home");
  expect(
    await input.evaluate((e) => (e as HTMLInputElement).selectionStart),
  ).toBe(0);
  await input.press("End");
  expect(
    await input.evaluate((e) => (e as HTMLInputElement).selectionStart),
  ).toBe(6);
  await input.press("ArrowLeft");
  expect(
    await input.evaluate((e) => (e as HTMLInputElement).selectionStart),
  ).toBe(5);
  await expect(input).toBeFocused();
});

test("confirmed_grid_selection_survives_harness_remount", async ({ page }) => {
  await page.goto("/lab/components");
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  await page
    .getByRole("button", { name: "Kiểm tra lookup", exact: true })
    .click();
  await page
    .getByTestId("lookup-harness")
    .getByRole("gridcell", { name: "Chọn sản phẩm", exact: true })
    .first()
    .dblclick();
  const input = page.getByRole("combobox", {
    name: "Sản phẩm grid",
    exact: true,
  });
  await input.fill("Cà");
  await page
    .getByRole("listbox")
    .getByRole("option", { name: "SP001 · Cà phê sữa", exact: true })
    .click();
  await expect(input).toBeFocused();
  await input.press("Tab");
  await page
    .getByRole("button", { name: "Đóng lookup harness", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kiểm tra lookup", exact: true })
    .click();
  await expect(
    page
      .getByTestId("lookup-harness")
      .getByRole("gridcell", { name: "Cà phê sữa", exact: true }),
  ).toBeVisible();
});
