import { test, expect, type Page } from "@playwright/test";

function guardApi(page: Page) {
  const requests: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url());
  });
  return requests;
}

test("catalog allowlist opens the real DateField and unknown IDs fall back safely", async ({ page }) => {
  const api = guardApi(page);
  await page.goto("/lab/components?scenario=default&entry=date-field");
  await expect(page.getByRole("navigation", { name: "Lab journeys" })).toBeVisible();
  await expect(page.getByTestId("catalog-example")).toContainText("DateField + Calendar");
  await expect(page.getByTestId("lab-date-field")).toBeVisible();
  await page.getByTestId("lab-date-field").getByRole("button", { name: "Partial" }).click();
  await expect(page.getByTestId("lab-date-state")).toContainText("incomplete");
  await page.goto("/lab/components?entry=unknown-unsafe-key");
  await expect(page.getByText("Catalog entry không hợp lệ; đang hiển thị Button mặc định.")).toBeVisible();
  await expect(page.getByTestId("catalog-native-example").getByRole("button", { name: "Button mẫu" })).toBeVisible();
  expect(api).toEqual([]);
});

test("Receipt recipe uses real feature panel, keeps dirty session across Lab routes", async ({ page }) => {
  const api = guardApi(page);
  await page.goto("/lab/recipes/document-edit");
  await expect(page.getByRole("region", { name: "Document Edit Recipe" })).toBeVisible();
  await page.getByRole("button", { name: "Phiếu nhập mới", exact: true }).click();
  const panel = page.getByRole("region", { name: "Phiếu nhập mới", exact: true });
  await expect(panel.getByRole("button", { name: "Lưu phiếu nhập" })).toBeVisible();
  const id = await panel.getAttribute("data-session-id");
  await panel.getByRole("textbox", { name: "Ghi chú", exact: true }).fill("Giữ raw · WEB7-08");
  await page.getByRole("link", { name: "Inventory Lab", exact: true }).click();
  await expect(page.getByText("Inventory Lab · Real StockBalancesPanel", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Receipt Lab", exact: true }).click();
  await expect(panel).toHaveAttribute("data-session-id", id!);
  await expect(panel.getByRole("textbox", { name: "Ghi chú" })).toHaveValue("Giữ raw · WEB7-08");
  const dialogs: string[] = [];
  page.on("dialog", async dialog => { dialogs.push(dialog.type()); await dialog.dismiss(); });
  await page.evaluate(() => { window.setTimeout(() => window.location.reload(), 0); });
  await expect.poll(() => dialogs).toEqual(["beforeunload"]);
  expect(api).toEqual([]);
});

test("Receipt filter recipe drives actual read states without a write", async ({ page }) => {
  const api = guardApi(page);
  await page.goto("/lab/recipes/filters");
  await page.getByRole("button", { name: "Danh sách nhập kho", exact: true }).click();
  const section = page.getByRole("region", { name: "Danh sách phiếu nhập", exact: true });
  await expect(section.getByTestId("goods-receipt-list-grid")).toBeVisible();
  await expect(section.locator(".ag-row")).toHaveCount(3);
  const mode = page.getByRole("combobox", { name: "Kết quả đọc fake", exact: true });
  // A same-key refresh must not display previously successful rows while
  // the fake read is still pending; a stale cache would conceal "loading".
  await mode.selectOption("latency");
  await expect(section.locator('[data-read-state="loading"]')).toBeVisible();
  await expect(section.locator(".ag-row")).toHaveCount(0);
  await expect(section.locator(".ag-row")).toHaveCount(3);
  await mode.selectOption("error");
  await expect(section.locator('[data-read-state="error"]')).toBeVisible();
  await mode.selectOption("empty");
  await expect(section.locator('[data-read-state="empty"]')).toBeVisible();
  await mode.selectOption("forbidden");
  await expect(section.locator('[data-read-state="forbidden"]')).toBeVisible();
  await expect(section.locator(".ag-row")).toHaveCount(0);
  expect(api).toEqual([]);
});

test("Inventory Lab mounts real AG Grid and committed stock-card lookups", async ({ page }) => {
  const api = guardApi(page);
  await page.goto("/lab/inventory");
  await page.getByRole("button", { name: "Tồn kho", exact: true }).click();
  const balances = page.getByRole("region", { name: "Tồn kho", exact: true });
  await expect(balances.getByTestId("inventory-balances-grid")).toBeVisible();
  await expect(balances.locator(".ag-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Thẻ kho", exact: true }).click();
  const card = page.getByRole("region", { name: "Thẻ kho", exact: true });
  await expect(card.getByTestId("inventory-stock-card-grid")).toBeVisible();
  await expect(card.locator(".ag-row")).toHaveCount(0);
  for (const [label, query] of [["Lọc kho", "Kho"], ["Lọc sản phẩm", "Cà"]] as const) {
    const input = card.getByRole("combobox", { name: label, exact: true });
    await input.fill(query);
    await page.getByRole("listbox").getByRole("option").first().click();
    await input.press("Tab");
  }
  await expect(card.locator(".ag-row")).toHaveCount(2);
  expect(api).toEqual([]);
});
