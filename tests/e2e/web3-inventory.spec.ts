import { test, expect, type BrowserContext, type Page, type Locator } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Parse a fresh copy on every call: the pinned corpus files are never rewritten.
const fixture = (folder: string, name: string): any => JSON.parse(readFileSync(resolve(`tests/fixtures/${folder}/${name}.json`), "utf8")).data;
const receiptId = "9007199254740993";
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const messages: string[] = []; errors.set(page, messages);
  page.on("pageerror", e => messages.push(e.message));
  page.on("console", e => { if (e.type() === "error" && !/Failed to load resource|net::ERR_FAILED/.test(e.text())) messages.push(e.text()); });
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

async function harness(context: BrowserContext) {
  const state = {
    grants: { balances: true, card: true, receipt: true, sales: true },
    balances: fixture("web3-v1", "balances-response"), card: fixture("web3-v1", "stock-card-response"),
    receipt: fixture("web3-v1", "receipt-get-draft-response"),
    queries: [] as { path: string; params: URLSearchParams }[], writes: [] as string[],
    balanceDenied: false, cardDenied: false, sourceDenied: false, read401: false,
    actor: "inventory-browser", refreshes: 0, holdBalances: false, releaseBalances: undefined as (() => void) | undefined,
  };
  let signedIn = false;
  const token = () => `e30.${Buffer.from(JSON.stringify({ sid: state.actor, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url")}.fixture`;
  await context.route("**/api/v1/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const reply = (data: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ data }) });
    const fail = (status: number, code: string) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: { code, message: code, details: [] } }) });
    if (path.includes("/auth/")) {
      const action = path.split("/").at(-1);
      if (action === "refresh" && !signedIn) return fail(401, "Auth.Unauthorized");
      if (action === "login") signedIn = true;
      if (action === "login" || action === "refresh") {
        if (action === "refresh") state.refreshes++;
        return reply({ accessToken: token(), expiresAtUtc: new Date(Date.now() + 600000).toISOString(), user: fixture("web2-v1", "auth-me-response") });
      }
      if (action === "me") return reply(fixture("web2-v1", "auth-me-response"));
      if (action === "logout") { signedIn = false; return reply({}); }
      if (action === "capabilities") {
        const feature = url.searchParams.get("feature");
        const read = feature === "inventory-balances" ? state.grants.balances : feature === "inventory-stock-card" ? state.grants.card : feature === "goods-receipts" ? state.grants.receipt : state.grants.sales;
        return reply(feature?.startsWith("inventory-") ? { read } : { read, write: true, post: true });
      }
    }
    if (path.includes("/catalog/")) {
      const product = path.includes("products"), id = product ? 7 : path.includes("warehouses") ? 1 : 2;
      return reply([{ id, code: product ? "P7" : "WH01", name: product ? "Sản phẩm" : "Kho chính", isActive: true }]);
    }
    if (path.startsWith("/api/v1/inventory/")) {
      state.queries.push({ path, params: new URLSearchParams(url.searchParams) });
      if (state.read401) { state.read401 = false; return fail(401, "Auth.Unauthorized"); }
      const balances = path.endsWith("/balances");
      if (balances ? state.balanceDenied : state.cardDenied) return fail(403, "Inventory.ReadDenied");
      const data = structuredClone(balances ? state.balances : state.card);
      data.pageNumber = Number(url.searchParams.get("pageNumber")); data.pageSize = Number(url.searchParams.get("pageSize"));
      if (balances && state.holdBalances) await new Promise<void>(resolve => { state.releaseBalances = resolve; });
      return reply(data);
    }
    if (path === `/api/v1/goods-receipts/${receiptId}/post`) {
      state.writes.push(path); return reply(fixture("web3-v1", "receipt-post-response"));
    }
    if (path === `/api/v1/goods-receipts/${receiptId}`) return state.sourceDenied ? fail(403, "Receipt.ReadDenied") : reply(state.receipt);
    if (path === "/api/v1/goods-receipts") return reply(fixture("web3-v1", "receipt-list-response"));
    if (path === "/api/v1/sales-receipts") return reply(fixture("web2-v1", "sales-list-response"));
    if (path.startsWith("/api/v1/sales-receipts/")) return state.sourceDenied ? fail(403, "Sales.ReadDenied") : reply(fixture("web2-v1", "sales-get-posted-response"));
    if (request.method() !== "GET") state.writes.push(path);
    return fail(404, "Fixture.NotFound");
  });
  return state;
}
async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill("inventory.fixture");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("fixture");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("button", { name: "Tồn kho", exact: true })).toBeVisible();
  await expect(page).toHaveURL("http://127.0.0.1:5173/"); await expect(page).toHaveTitle("MyDmsVn Web UI");
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
}
async function balances(page: Page) {
  await page.getByRole("button", { name: "Tồn kho", exact: true }).click();
  return page.locator('section[aria-label="Tồn kho"]');
}
async function card(page: Page) {
  await page.getByRole("button", { name: "Thẻ kho", exact: true }).click();
  return page.locator('section[aria-label="Thẻ kho"]');
}
async function select(panel: Locator, page: Page, label: string) {
  const input = panel.getByRole("combobox", { name: label, exact: true });
  await input.fill("REF"); await page.getByRole("listbox").getByRole("option").first().click(); await input.press("Tab");
}
async function scrollGrid(panel: Locator, end: boolean) {
  await panel.locator(".ag-body-horizontal-scroll-viewport").evaluate((node, right) => { node.scrollLeft = right ? node.scrollWidth : 0; }, end);
}
const queries = (state: Awaited<ReturnType<typeof harness>>, kind: "balances" | "stock-card") => state.queries.filter(q => q.path.endsWith(`/${kind}`));

test("balances show authoritative inactive names, exact large decimals, null average and long total", async ({ page, context }) => {
  const state = await harness(context);
  const large = structuredClone(state.balances.items[0]);
  large.quantity = "1.0000"; large.inventoryValue = "9007199254740993.1234"; large.averageUnitCost = "9007199254740993.12340000";
  state.balances.items = [large, { ...fixture("web3-v1", "balances-zero-response").items[0], productId: 8, productCode: "P8" }];
  state.balances.totalCount = "9223372036854775807";
  await login(page); const panel = await balances(page);
  await expect(panel.getByRole("grid")).toBeVisible();
  await expect(panel).toContainText("Kho chính"); await expect(panel).toContainText("Sản phẩm");
  await expect(panel.locator('.ag-row[row-index="0"] [col-id="warehouse"]')).toContainText("Ngừng hoạt động"); await expect(panel.locator('.ag-row[row-index="0"] [col-id="product"]')).toContainText("Ngừng hoạt động");
  await expect(panel).toContainText("9007199254740993.1234"); await expect(panel).toContainText(state.balances.totalCount);
  await expect(panel.locator('.ag-row[row-index="1"] [col-id="averageUnitCost"]')).toHaveText("—");
  expect(queries(state, "balances")[0].params.get("pageNumber")).toBe("1"); expect(queries(state, "balances")[0].params.get("pageSize")).toBe("25");
});

test("balances warehouse product search and page-size filters reset offset paging", async ({ page, context }) => {
  const state = await harness(context); state.balances.totalCount = "100"; await login(page); const panel = await balances(page);
  await panel.getByRole("button", { name: "Trang sau", exact: true }).click(); await expect.poll(() => queries(state, "balances").at(-1)?.params.get("pageNumber")).toBe("2");
  await panel.getByLabel("Tìm tồn kho", { exact: true }).fill("P7"); await expect.poll(() => queries(state, "balances").at(-1)?.params.get("search")).toBe("P7");
  expect(queries(state, "balances").at(-1)?.params.get("pageNumber")).toBe("1");
  await select(panel, page, "Lọc kho"); await expect.poll(() => queries(state, "balances").at(-1)?.params.get("warehouseId")).toBe("1");
  await select(panel, page, "Lọc sản phẩm"); await expect.poll(() => queries(state, "balances").at(-1)?.params.get("productId")).toBe("7");
  await panel.getByLabel("Số dòng mỗi trang", { exact: true }).selectOption("50"); await expect.poll(() => queries(state, "balances").at(-1)?.params.get("pageSize")).toBe("50");
  expect(queries(state, "balances").at(-1)?.params.get("pageNumber")).toBe("1");
});

test("card requires both committed keys, validates fractional UTC order and preserves signed ledger", async ({ page, context }) => {
  const state = await harness(context); state.card.totalCount = "100"; await login(page); const panel = await card(page);
  await expect(panel).toBeVisible(); expect(queries(state, "stock-card")).toHaveLength(0);
  await select(panel, page, "Lọc kho"); expect(queries(state, "stock-card")).toHaveLength(0);
  await select(panel, page, "Lọc sản phẩm"); await expect(panel.locator(".ag-row")).toHaveCount(2);
  await scrollGrid(panel, true); await expect(panel).toContainText("-4.0000"); await expect(panel).toContainText("-60.0000");
  await scrollGrid(panel, false);
  await expect(panel).toContainText("2026-11-01T02:03:05.1234567Z");
  await panel.getByRole("button", { name: "Trang sau", exact: true }).click(); await expect.poll(() => queries(state, "stock-card").at(-1)?.params.get("pageNumber")).toBe("2");
  const count = queries(state, "stock-card").length;
  await panel.getByLabel("Từ UTC", { exact: true }).fill("2026-11-01T02:03:04.1234568Z");
  await panel.getByLabel("Đến UTC", { exact: true }).fill("2026-11-01T02:03:04.1234567Z");
  await expect(panel.getByRole("status")).toContainText(/UTC|trước|sau|Từ/);
  expect(queries(state, "stock-card").slice(count).every(q => !(q.params.has("fromUtc") && q.params.has("toUtc")))).toBe(true);
  await panel.getByLabel("Đến UTC", { exact: true }).fill("2026-11-01T02:03:04.1234569Z");
  await panel.getByRole("button", { name: "Tải lại", exact: true }).click();
  await expect.poll(() => queries(state, "stock-card").at(-1)?.params.get("toUtc")).toBe("2026-11-01T02:03:04.1234569Z");
  expect(queries(state, "stock-card").at(-1)?.params.get("pageNumber")).toBe("1");
});

test("independent inventory grants leave Receipt and Sales available", async ({ page, context }) => {
  const state = await harness(context); state.grants.balances = false; await login(page);
  await expect(page.getByRole("button", { name: "Tồn kho", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Thẻ kho", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Sales mới", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Phiếu nhập mới", exact: true })).toBeEnabled();
  expect(queries(state, "balances")).toHaveLength(0);
});

test("403 reload hides previous inventory rows without poisoning other modules", async ({ page, context }) => {
  const state = await harness(context); await login(page); const panel = await balances(page); await expect(panel).toContainText("16.0000");
  state.balanceDenied = true; await panel.getByRole("button", { name: "Tải lại", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("Inventory.ReadDenied"); await expect(panel.locator(".ag-row")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Phiếu nhập mới", exact: true })).toBeEnabled();
});

test("balance row opens and retargets singleton card; source Get403 leaves card intact", async ({ page, context }) => {
  const state = await harness(context); state.balances.items.push({...state.balances.items[0], productId: 8, productCode: "P8"}); state.balances.totalCount = "2";
  await login(page); const panel = await balances(page); await expect(panel.locator(".ag-row")).toHaveCount(2);
  await panel.locator('.ag-row[row-index="0"] [col-id="product"]').click(); await panel.getByRole("button", { name: "Mở thẻ kho", exact: true }).click();
  const stock = page.locator('section[aria-label="Thẻ kho"]'); await expect(stock.locator(".ag-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Thẻ kho", exact: true }).click(); await expect(stock.locator(".ag-row")).toHaveCount(2);
  await page.getByRole("tab").filter({ hasText: "Tồn kho" }).click(); await panel.locator('.ag-row[row-index="1"] [col-id="product"]').click(); await panel.getByRole("button", { name: "Mở thẻ kho", exact: true }).click();
  await expect(stock).toHaveCount(1); await expect.poll(() => queries(state, "stock-card").at(-1)?.params.get("productId")).toBe("8"); await expect(stock.locator(".ag-row")).toHaveCount(2);
  state.sourceDenied = true; await stock.locator('.ag-row[row-index="0"] [col-id="product"]').click(); await stock.getByRole("button", { name: "Mở chứng từ", exact: true }).click();
  await expect(page.getByText(/Receipt.ReadDenied/)).toBeVisible(); await page.getByRole("tab").filter({ hasText: "Thẻ kho" }).click();
  await scrollGrid(stock, true); await expect(stock).toContainText("-4.0000");
  expect(state.writes).toHaveLength(0);
});

test("separate source Read permissions suppress navigation only", async ({ page, context }) => {
  const state = await harness(context); state.grants.receipt = false; state.grants.sales = false;
  await login(page); const panel = await card(page); await select(panel, page, "Lọc kho"); await select(panel, page, "Lọc sản phẩm");
  await expect(panel.locator(".ag-row")).toHaveCount(2); await panel.locator('.ag-row[row-index="0"] [col-id="product"]').click();
  await expect(panel.getByRole("button", { name: "Mở chứng từ", exact: true })).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});

test("permitted Receipt and Sales sources open centrally while unknown type has no action", async ({ page, context }) => {
  const state = await harness(context);
  state.card.items.push({ ...state.card.items[1], ledgerId: "9223372036854775806", postedAtUtc: "2026-11-01T02:03:06Z", documentType: "UnknownSource" });
  state.card.totalCount = "3";
  await login(page); const panel = await card(page); await select(panel, page, "Lọc kho"); await select(panel, page, "Lọc sản phẩm"); await expect(panel.locator(".ag-row")).toHaveCount(3);
  await panel.locator('.ag-row[row-index="0"] [col-id="product"]').click(); await panel.getByRole("button", { name: "Mở chứng từ", exact: true }).click();
  await expect(page.getByRole("region", { name: `Phiếu nhập ${receiptId}`, exact: true }).getByLabel("Ghi chú", { exact: true })).toHaveValue(state.receipt.note);
  await page.getByRole("tab").filter({ hasText: "Thẻ kho" }).click(); await panel.locator('.ag-row[row-index="1"] [col-id="product"]').click(); await panel.getByRole("button", { name: "Mở chứng từ", exact: true }).click();
  await expect(page.getByRole("region", { name: "Chứng từ 9223372036854775807", exact: true })).toBeVisible();
  await page.getByRole("tab").filter({ hasText: "Thẻ kho" }).click(); await panel.locator('.ag-row[row-index="2"] [col-id="product"]').click();
  await expect(panel.getByRole("button", { name: "Mở chứng từ", exact: true })).toHaveCount(0); expect(state.writes).toHaveLength(0);
});

test("inventory grids remain read-only for editing keyboard and paste routes", async ({ page, context }) => {
  const state = await harness(context); await login(page); const panel = await balances(page);
  const cell = panel.locator('.ag-row [col-id="quantity"]').first(); await cell.dblclick(); await cell.press("F2"); await cell.press("9"); await cell.press("Control+v"); await cell.press("Enter");
  await expect(cell).toHaveText("16.0000"); await expect(panel.locator(".ag-cell-inline-editing")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /Lưu|Post/ })).toHaveCount(0); expect(state.writes).toHaveLength(0);
  const stock = await card(page); await select(stock, page, "Lọc kho"); await select(stock, page, "Lọc sản phẩm"); await expect(stock.locator(".ag-row")).toHaveCount(2); await scrollGrid(stock, true);
  const signed = stock.locator('.ag-row[row-index="1"] [col-id="quantityChange"]'); await signed.dblclick(); await signed.press("F2"); await signed.press("9"); await signed.press("Control+v");
  await expect(signed).toHaveText("-4.0000"); await expect(stock.locator(".ag-cell-inline-editing")).toHaveCount(0); expect(state.writes).toHaveLength(0);
});

test("refresh capability revocation removes cached balances", async ({ page, context }) => {
  const state = await harness(context); await login(page); const panel = await balances(page); await expect(panel).toContainText("16.0000");
  state.grants.balances = false; state.read401 = true;
  await panel.getByRole("button", { name: "Tải lại", exact: true }).click(); await expect.poll(() => state.refreshes).toBe(1);
  await expect(page.getByRole("button", { name: "Tồn kho", exact: true })).toBeDisabled();
  await expect(panel.locator(".ag-row")).toHaveCount(0);
});

test("confirmed Receipt Post with Get403 invalidates inventory and preserves dirty Sales", async ({ page, context }) => {
  const state = await harness(context); await login(page); await balances(page);
  await page.getByRole("button", { name: "Tách sang phải", exact: true }).click();
  await card(page); const stock = page.locator('section[aria-label="Thẻ kho"]'); await select(stock, page, "Lọc kho"); await select(stock, page, "Lọc sản phẩm");
  await expect(stock.locator(".ag-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Sales mới", exact: true }).click(); const sale = page.getByRole("region", { name: "Chứng từ mới", exact: true }); await sale.getByLabel("Ghi chú", { exact: true }).fill("Sales giữ sau Post");
  await page.getByRole("button", { name: "Danh sách phiếu nhập", exact: true }).click(); await page.getByTestId("goods-receipt-list-grid").locator('.ag-row [col-id="receiptId"]').dblclick();
  const receipt = page.getByRole("region", { name: `Phiếu nhập ${receiptId}`, exact: true }); await expect(receipt.getByLabel("Ghi chú", { exact: true })).toBeVisible();
  const beforeBalances = queries(state, "balances").length, beforeCard = queries(state, "stock-card").length;
  state.sourceDenied = true; await receipt.getByRole("button", { name: "Post phiếu nhập", exact: true }).click();
  await expect(receipt).toContainText("Posted"); await expect(receipt).toContainText("Receipt.ReadDenied");
  await page.getByRole("tab").filter({ hasText: "Tồn kho" }).click(); await expect.poll(() => queries(state, "balances").length).toBeGreaterThan(beforeBalances);
  await page.getByRole("tab").filter({ hasText: "Thẻ kho" }).click(); await expect.poll(() => queries(state, "stock-card").length).toBeGreaterThan(beforeCard);
  await page.getByRole("tab").filter({ hasText: "Sales mới" }).click(); await expect(sale.getByLabel("Ghi chú", { exact: true })).toHaveValue("Sales giữ sau Post");
  expect(state.writes).toEqual([`/api/v1/goods-receipts/${receiptId}/post`]);
});

test("late inventory response from previous actor cannot populate the new actor panel", async ({ page, context }) => {
  const state = await harness(context); await login(page); const panel = await balances(page); await expect(panel).toContainText("16.0000");
  state.holdBalances = true; await panel.getByRole("button", { name: "Tải lại", exact: true }).click(); await expect.poll(() => !!state.releaseBalances).toBe(true);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click(); await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  state.actor = "inventory-other-actor"; state.holdBalances = false; state.balances = fixture("web3-v1", "balances-zero-response");
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill("other.fixture"); await page.getByLabel("Mật khẩu", { exact: true }).fill("fixture"); await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  const current = await balances(page); await expect(current).toContainText("0.0000"); state.releaseBalances!(); await expect(current).not.toContainText("16.0000");
});

test("light dark desktop and split Inventory panels remain usable beside dirty Sales", async ({ page, context }, info) => {
  const screenshots = process.env.WEB3_SCREENSHOT_DIR ?? info.outputPath("screenshots"); mkdirSync(screenshots, { recursive: true });
  const state = await harness(context); await login(page); await page.setViewportSize({ width: 1280, height: 720 });
  const panel = await balances(page); await expect(panel.getByRole("grid")).toBeVisible(); await expect(panel.locator(".ag-row")).toHaveCount(1); await expect(panel.getByLabel("Tìm tồn kho", { exact: true })).toBeEnabled();
  const probe = await panel.getByLabel("Số dòng mỗi trang", { exact: true }).evaluate(node => { const box = node.getBoundingClientRect(); const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2); return { box: { x: box.x, y: box.y, width: box.width, height: box.height }, hitTag: hit?.tagName, hitLabel: hit?.getAttribute("aria-label") }; });
  expect(probe.hitTag).toBe("SELECT"); expect(probe.hitLabel).toBe("Số dòng mỗi trang");
  await expect(panel).not.toContainText(/Cần chọn kho|Cần chọn sản phẩm/);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: `${screenshots}/inventory-light-1280.png` });
  await page.setViewportSize({ width: 1440, height: 900 }); await page.screenshot({ path: `${screenshots}/inventory-light-1440.png` });
  await page.getByRole("button", { name: "Sales mới", exact: true }).click(); const sale = page.getByRole("region", { name: "Chứng từ mới", exact: true }); await sale.getByLabel("Ghi chú", { exact: true }).fill("Sales riêng ệ");
  const stock = await card(page); await select(stock, page, "Lọc kho"); await select(stock, page, "Lọc sản phẩm"); await expect(stock.locator(".ag-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Tách sang phải", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 }); await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(stock.getByRole("combobox", { name: "Lọc kho", exact: true })).toBeEnabled();
  await expect(stock.getByRole("button", { name: "Tải lại", exact: true })).toBeEnabled();
  await page.screenshot({ path: `${screenshots}/inventory-dark-split-1440.png` });
  await page.setViewportSize({ width: 1280, height: 720 }); await page.screenshot({ path: `${screenshots}/inventory-dark-split-1280.png` });
  const pageSize = stock.getByLabel("Số dòng mỗi trang", { exact: true }); await pageSize.scrollIntoViewIfNeeded();
  const footerBox = await pageSize.boundingBox(); expect(footerBox).not.toBeNull(); expect(footerBox!.y).toBeGreaterThanOrEqual(0); expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(720);
  await pageSize.selectOption("50"); await expect.poll(() => queries(state, "stock-card").at(-1)?.params.get("pageSize")).toBe("50");
  await stock.getByRole("button", { name: "Tải lại", exact: true }).click(); await expect(stock.locator(".ag-row")).toHaveCount(2);
  await expect(stock.getByRole("button", { name: "Tải lại", exact: true })).toBeEnabled();
  await page.screenshot({ path: `${screenshots}/inventory-dark-split-footer-1280.png` });
  await page.getByRole("tab").filter({ hasText: "Sales mới" }).click(); await expect(sale.getByLabel("Ghi chú", { exact: true })).toHaveValue("Sales riêng ệ");
  expect(state.writes).toHaveLength(0);
});
