import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

type Actor = "integratedEditor" | "balanceReader" | "cardReader";
type Manifest = {
  mode: string; origin: string; resultPath: string;
  actors: Record<Actor, { username: string; password: string }>;
  integratedCatalog: { warehouseId: number; otherWarehouseId: number; employeeId: number; customerId: number; productId: number };
};
type Receipt = { receiptId: string; receiptNumber: string; version: string };
type Sale = { saleId: string; saleNumber: string; version: string };
type CardRow = { ledgerId: string; documentId: string; documentType: string; quantityChange: string; valueChange: string };
const manifest: Manifest = JSON.parse(readFileSync(process.env.MYDMSVN_WEB_PILOT_MANIFEST!, "utf8"));
const receiptRoot = "/api/v1/goods-receipts", saleRoot = "/api/v1/sales-receipts";
const inventoryRoot = "/api/v1/inventory", accessKey = "mydmsvn.access.v1";
const keyQuery = () => `warehouseId=${manifest.integratedCatalog.warehouseId}&productId=${manifest.integratedCatalog.productId}&pageNumber=1&pageSize=25`;

// No intercepted success or direct database write: every response comes from
// the owned HTTPS host. The backend independently verifies physical SQL after us.
async function api(page: Page, path: string, method = "GET", body?: unknown) {
  return page.evaluate(async ({ path, method, body, accessKey }) => {
    const response = await fetch(path, { method, credentials: "omit", headers: {
      Authorization: `Bearer ${localStorage.getItem(accessKey)}`, "Content-Type": "application/json",
    }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, json: await response.json() };
  }, { path, method, body, accessKey });
}
async function login(page: Page, actor: Actor) {
  await page.goto("/");
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill(manifest.actors[actor].username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(manifest.actors[actor].password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/MyDmsVn/);
  expect(new URL(page.url()).origin).toBe(manifest.origin);
}
async function select(page: Page, panel: Locator, label: string, code: string) {
  const input = panel.getByRole("combobox", { name: label, exact: true });
  await input.fill(code);
  await page.getByRole("listbox").getByRole("option").filter({ hasText: new RegExp(`^${code} ·`) }).click();
  await input.press("Tab");
}
async function inventory(page: Page, card: boolean) {
  const name = card ? "Thẻ kho" : "Tồn kho";
  await page.getByRole("button", { name, exact: true }).click();
  return page.locator(`section[aria-label="${name}"]`);
}
async function scroll(panel: Locator, right: boolean) {
  await panel.locator(".ag-body-horizontal-scroll-viewport").evaluate((node, end) => { node.scrollLeft = end ? node.scrollWidth : 0; }, right);
}
function receiptBody(quantity: string, unitCost: string, warehouseId = manifest.integratedCatalog.warehouseId, receiptDate = "2024-03-01") {
  return { receiptDate, warehouseId, employeeId: manifest.integratedCatalog.employeeId, note: "WEB3 integrated",
    lines: [{ productId: manifest.integratedCatalog.productId, quantity, unitCost }] };
}
function saleBody() {
  const { warehouseId, employeeId, customerId, productId } = manifest.integratedCatalog;
  return { saleDate: "2024-03-02", warehouseId, employeeId, customerId, note: "WEB3 integrated sale",
    lines: [{ saleLineId: "0", productId, qty: "4.0000", unitPrice: "25.0000", isGift: false }] };
}
function record(row: { documentType: "GoodsReceipt"; receiptId: string; quantity: string; value: string } | { documentType: "SalesReceipt"; saleId: string; quantity: string; cost: string }) {
  const rows = existsSync(manifest.resultPath) ? JSON.parse(readFileSync(manifest.resultPath, "utf8")) : [];
  rows.push({ ...row, scenario: "integrated", actor: "integratedEditor" });
  writeFileSync(manifest.resultPath, JSON.stringify(rows), "utf8");
}
async function decimal(panel: Locator, column: "quantity" | "unitCost", text: string) {
  await panel.locator(`.ag-row[row-index="0"] [col-id="${column}"]`).dblclick();
  const input = panel.getByLabel(column === "quantity" ? "Số lượng dòng 1" : "Đơn giá nhập dòng 1", { exact: true });
  await input.fill(text);
  await input.press("Enter");
}
async function openReceipt(page: Page, receipt: Receipt) {
  await page.getByRole("button", { name: "Danh sách phiếu nhập", exact: true }).click();
  await page.getByRole("region", { name: "Danh sách phiếu nhập", exact: true }).getByLabel("Tìm phiếu nhập", { exact: true }).fill(receipt.receiptNumber);
  await page.getByTestId("goods-receipt-list-grid").locator('[col-id="receiptId"]').filter({ hasText: new RegExp(`^${receipt.receiptId}$`) }).dblclick();
  const panel = page.getByRole("region", { name: `Phiếu nhập ${receipt.receiptId}`, exact: true });
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toBeVisible();
  return panel;
}
async function postReceipt(page: Page, receipt: Receipt, panel: Locator, quantity: string, value: string) {
  const response = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === `${receiptRoot}/${receipt.receiptId}/post`);
  await panel.getByRole("button", { name: "Post phiếu nhập", exact: true }).click();
  const ack = await response;
  expect(ack.status()).toBe(200);
  expect((await ack.json()).data).not.toHaveProperty("version");
  record({ documentType: "GoodsReceipt", receiptId: receipt.receiptId, quantity, value });
  await expect(panel).toContainText("Posted");
  await expect(panel.getByRole("button", { name: "Post phiếu nhập", exact: true })).toBeDisabled();
}
async function createAndPostReceipt(page: Page, quantity: string, cost: string, value: string, warehouseId?: number, date?: string) {
  const created = await api(page, receiptRoot, "POST", receiptBody(quantity, cost, warehouseId, date));
  expect(created.status).toBe(200);
  const receipt: Receipt = created.json.data;
  await postReceipt(page, receipt, await openReceipt(page, receipt), quantity, value);
  return receipt;
}

test("real Receipt→Inventory→Sales→backdated Receipt preserves valuation, source navigation and dirty Sales", async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const reads = { balances: 0, card: 0 };
  const posts: string[] = [];
  page.on("response", response => {
    const path = new URL(response.url()).pathname;
    if (response.status() === 200 && response.request().method() === "GET") {
      if (path === `${inventoryRoot}/balances`) reads.balances++;
      if (path === `${inventoryRoot}/stock-card`) reads.card++;
    }
    if (response.request().method() === "POST" && path.endsWith("/post")) posts.push(path);
  });
  await login(page, "integratedEditor");
  await page.getByRole("button", { name: "Sales mới", exact: true }).click();
  const dirtySale = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  await dirtySale.getByLabel("Ghi chú", { exact: true }).fill("Sales riêng giữ nguyên qua Receipt và Inventory ệ");

  const balances = await inventory(page, false);
  await select(page, balances, "Lọc kho", "WEB3-IW");
  await select(page, balances, "Lọc sản phẩm", "WEB3-IP");
  await expect(balances.getByRole("status")).toHaveText("Không có dữ liệu.");
  const card = await inventory(page, true);
  await select(page, card, "Lọc kho", "WEB3-IW");
  await select(page, card, "Lọc sản phẩm", "WEB3-IP");
  await expect(card.getByRole("status")).toHaveText("Không có dữ liệu.");

  async function projection(quantity: string, value: string, count: number, before: typeof reads) {
    // Observe refetch before activation, so remount alone cannot satisfy invalidation.
    await expect.poll(() => reads.balances).toBeGreaterThan(before.balances);
    await expect.poll(() => reads.card).toBeGreaterThan(before.card);
    await inventory(page, false);
    await scroll(balances, true);
    await expect(balances.locator('.ag-row [col-id="quantity"]')).toHaveText(quantity);
    await expect(balances.locator('.ag-row [col-id="inventoryValue"]')).toHaveText(value);
    await inventory(page, true);
    await expect(card.locator(".ag-row")).toHaveCount(count);
    await expect(card.getByRole("button", { name: /Lưu|Post/ })).toHaveCount(0);
  }

  // First receipt is created and edited through the production grid and Save barrier.
  await page.getByRole("button", { name: "Phiếu nhập mới", exact: true }).click();
  const fresh = page.getByRole("region", { name: "Phiếu nhập mới", exact: true });
  await fresh.getByLabel("Ngày nhập", { exact: true }).fill("2024-03-01");
  await select(page, fresh, "Kho", "WEB3-IW");
  const employee = fresh.getByRole("combobox", { name: "Nhân viên", exact: true });
  await employee.fill("PILOT");
  await page.getByRole("listbox").getByRole("option").first().click();
  await employee.press("Tab");
  await fresh.locator('.ag-row[row-index="0"] [col-id="product"]').dblclick();
  const product = fresh.getByRole("combobox", { name: "Sản phẩm grid", exact: true });
  await product.pressSequentially("WEB3-IP");
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1);
  await product.press("ArrowDown"); await product.press("Enter");
  await expect(fresh.locator('[col-id="quantity"].ag-cell-focus')).toBeVisible();
  await expect(fresh.getByLabel("Số lượng dòng 1", { exact: true })).toHaveCount(0);
  await decimal(fresh, "quantity", "9.0000"); await decimal(fresh, "unitCost", "10.0000");
  const saving = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === receiptRoot);
  await fresh.getByRole("button", { name: "Lưu phiếu nhập", exact: true }).click();
  const saved = await saving; expect(saved.status()).toBe(200);
  const first: Receipt = (await saved.json()).data;
  const firstPanel = page.getByRole("region", { name: `Phiếu nhập ${first.receiptId}`, exact: true });
  await decimal(firstPanel, "quantity", "10.0000");
  const updating = page.waitForResponse(r => r.request().method() === "PUT" && new URL(r.url()).pathname === `${receiptRoot}/${first.receiptId}/draft`);
  await firstPanel.getByRole("button", { name: "Lưu phiếu nhập", exact: true }).click();
  expect((await updating).status()).toBe(200);
  let before = { ...reads };
  await postReceipt(page, first, firstPanel, "10.0000", "100.0000");
  await projection("10.0000", "100.0000", 1, before);

  before = { ...reads };
  const second = await createAndPostReceipt(page, "10.0000", "20.0000", "200.0000");
  await projection("20.0000", "300.0000", 2, before);

  const createdSale = await api(page, saleRoot, "POST", saleBody());
  expect(createdSale.status).toBe(200);
  const sale: Sale = createdSale.json.data;
  await page.getByRole("button", { name: "Danh sách Sales", exact: true }).click();
  await page.getByRole("region", { name: "Danh sách Sales", exact: true }).getByLabel("Tìm chứng từ", { exact: true }).fill(sale.saleNumber);
  await page.getByTestId("sales-list-grid").locator('[col-id="saleId"]').filter({ hasText: new RegExp(`^${sale.saleId}$`) }).dblclick();
  const salePanel = page.getByRole("region", { name: `Chứng từ ${sale.saleId}`, exact: true, includeHidden: true });
  const postingSale = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === `${saleRoot}/${sale.saleId}/post`);
  before = { ...reads };
  await salePanel.getByRole("button", { name: "Post chứng từ", exact: true }).click();
  expect((await postingSale).status()).toBe(200);
  record({ documentType: "SalesReceipt", saleId: sale.saleId, quantity: "4.0000", cost: "60.0000" });
  await projection("16.0000", "240.0000", 3, before);
  const historical = await api(page, `${saleRoot}/${sale.saleId}`);
  expect(historical.status).toBe(200);
  expect(historical.json.data).toMatchObject({ status: "Posted", totalAmount: "100.0000", totalCost: "60.0000", grossProfit: "40.0000",
    lines: [{ postedUnitCost: "15.00000000", costAmount: "60.0000" }] });

  before = { ...reads };
  const later = await createAndPostReceipt(page, "2.0000", "50.0000", "100.0000", undefined, "2024-02-29");
  await projection("18.0000", "340.0000", 4, before);
  const frozen = await api(page, `${saleRoot}/${sale.saleId}`);
  expect(frozen.status).toBe(200);
  expect(frozen.json.data).toEqual(historical.json.data);

  // A distinct warehouse must not alter the first warehouse's physical projection.
  await createAndPostReceipt(page, "3.0000", "7.0000", "21.0000", manifest.integratedCatalog.otherWarehouseId);
  await inventory(page, false); await select(page, balances, "Lọc kho", "WEB3-IW2"); await scroll(balances, true);
  await expect(balances.locator('.ag-row [col-id="quantity"]')).toHaveText("3.0000");
  await expect(balances.locator('.ag-row [col-id="inventoryValue"]')).toHaveText("21.0000");
  await select(page, balances, "Lọc kho", "WEB3-IW"); await scroll(balances, true);
  await expect(balances.locator('.ag-row [col-id="quantity"]')).toHaveText("18.0000");
  await expect(balances.locator('.ag-row [col-id="inventoryValue"]')).toHaveText("340.0000");

  await inventory(page, true);
  const cardRead = await api(page, `${inventoryRoot}/stock-card?${keyQuery()}`);
  expect(cardRead.status).toBe(200);
  const rows: CardRow[] = cardRead.json.data.items;
  expect(rows).toHaveLength(4);
  expect(new Set(rows.map(r => r.ledgerId)).size).toBe(4);
  expect(rows.map(r => [r.documentType, r.documentId, r.quantityChange, r.valueChange]).sort()).toEqual([
    ["GoodsReceipt", first.receiptId, "10.0000", "100.0000"],
    ["GoodsReceipt", second.receiptId, "10.0000", "200.0000"],
    ["GoodsReceipt", later.receiptId, "2.0000", "100.0000"],
    ["SalesReceipt", sale.saleId, "-4.0000", "-60.0000"],
  ].sort());
  const saleRow = rows.find(row => row.documentType === "SalesReceipt")!;
  await scroll(card, true);
  await expect(card.locator(`.ag-row[row-id="${saleRow.ledgerId}"] [col-id="quantityChange"]`)).toHaveText("-4.0000");
  await expect(card.locator(`.ag-row[row-id="${saleRow.ledgerId}"] [col-id="valueChange"]`)).toHaveText("-60.0000");
  for (const row of [rows.find(r => r.documentId === first.receiptId && r.documentType === "GoodsReceipt")!, saleRow]) {
    await inventory(page, true); await scroll(card, false);
    await card.locator(`.ag-row[row-id="${row.ledgerId}"] [col-id="product"]`).click();
    await card.getByRole("button", { name: "Mở chứng từ", exact: true }).click();
    await expect(page.getByRole("region", { name: `${row.documentType === "GoodsReceipt" ? "Phiếu nhập" : "Chứng từ"} ${row.documentId}`, exact: true })).toBeVisible();
  }
  await page.getByRole("tab").filter({ hasText: "Sales mới" }).click();
  await expect(dirtySale.getByLabel("Ghi chú", { exact: true })).toHaveValue("Sales riêng giữ nguyên qua Receipt và Inventory ệ");
  // Retained Dockview panels hide via visibility; let inherited button transitions
  // settle and prove inactive controls are hidden before capturing the active draft.
  for (const control of [
    salePanel.getByRole("button", { name: "Post chứng từ", exact: true, includeHidden: true }),
    card.getByRole("button", { name: "Mở chứng từ", exact: true, includeHidden: true }),
    balances.getByRole("button", { name: "Tải lại", exact: true, includeHidden: true }),
  ]) {
    await expect(control).toHaveCount(1);
    await expect(control).toBeHidden();
  }
  expect(posts).toHaveLength(5);
  expect(new Set(posts).size).toBe(5);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath("integrated-dirty-sales-preserved.png") });
});

for (const actor of ["balanceReader", "cardReader"] as const) {
  test(`real ${actor} reads only its Inventory feature and cannot read or mutate source documents`, async ({ page }) => {
    await login(page, actor);
    const allowed = actor === "balanceReader" ? "balances" : "stock-card";
    const denied = actor === "balanceReader" ? "stock-card" : "balances";
    expect((await api(page, `${inventoryRoot}/${allowed}?${keyQuery()}`)).status).toBe(200);
    expect((await api(page, `${inventoryRoot}/${denied}?${keyQuery()}`)).status).toBe(403);
    await expect(page.getByRole("button", { name: actor === "balanceReader" ? "Tồn kho" : "Thẻ kho", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: actor === "balanceReader" ? "Thẻ kho" : "Tồn kho", exact: true })).toBeDisabled();
    for (const name of ["Sales mới", "Phiếu nhập mới", "Danh sách Sales", "Danh sách phiếu nhập"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
    }
    const panel = await inventory(page, actor === "cardReader");
    await select(page, panel, "Lọc kho", "WEB3-IW");
    await select(page, panel, "Lọc sản phẩm", "WEB3-IP");
    await expect(panel.getByRole("button", { name: /Lưu|Post/ })).toHaveCount(0);
    for (const [root, body] of [[receiptRoot, receiptBody("1.0000", "1.0000")], [saleRoot, saleBody()]] as const) {
      const query = root === receiptRoot ? "pageNumber=1&pageSize=25" : "pageSize=25";
      expect((await api(page, `${root}?${query}`)).status).toBe(403);
      expect((await api(page, `${root}/1`)).status).toBe(403);
      expect((await api(page, root, "POST", body)).status).toBe(403);
      expect((await api(page, `${root}/1/draft`, "PUT", { ...body, expectedVersion: "AAAAAAAAAAE=" })).status).toBe(403);
      expect((await api(page, `${root}/1/post`, "POST", { expectedVersion: "AAAAAAAAAAE=" })).status).toBe(403);
    }
  });
}
