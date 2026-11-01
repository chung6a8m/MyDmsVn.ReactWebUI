import { test, expect, type BrowserContext, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const fixture = (folder: string, name: string) => JSON.parse(readFileSync(resolve(`tests/fixtures/${folder}/${name}.json`), "utf8")).data;
const receiptId = "9007199254740993";
const root = "/api/v1/goods-receipts";
const token = () => `e30.${Buffer.from(JSON.stringify({ sid: "receipt-browser", exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url")}.fixture`;
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = []; browserErrors.set(page, errors);
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", e => { if (e.type() === "error" && !/Failed to load resource|net::ERR_FAILED/.test(e.text())) errors.push(e.text()); });
});
test.afterEach(({ page }) => expect(browserErrors.get(page)).toEqual([]));
async function harness(context: BrowserContext) {
  const state = { grants: { read: true, write: true, post: true }, salesGrants: { read: true, write: true, post: true },
    draft: fixture("web3-v1", "receipt-get-draft-response"), writes: [] as { method: string; body: any }[],
    queries: [] as URLSearchParams[], lost: false, conflict: false, getDenied: false, total: "1", listDenied: false, capabilityDelay: 0, read401: false,
    holdWrite: false, releaseWrite: undefined as (() => void) | undefined };
  let lineSerial = 100n; let signedIn = false;
  await context.route("**/api/v1/**", async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const reply = (data: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ data }) });
    const fail = (status: number, code: string) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: { code, message: code, details: [] } }) });
    if (path.includes("/auth/")) {
      const action = path.split("/").at(-1);
      if (action === "refresh" && !signedIn) return fail(401, "Auth.Unauthorized");
      if (action === "login") signedIn = true;
      if (["login", "refresh"].includes(action!)) return reply({ accessToken: token(), expiresAtUtc: new Date(Date.now() + 600000).toISOString(), user: fixture("web2-v1", "auth-me-response") });
      if (action === "me") return reply(fixture("web2-v1", "auth-me-response"));
      if (action === "logout") return reply({});
      if (action === "capabilities") { if (url.searchParams.get("feature") === "goods-receipts") { if (state.capabilityDelay) await new Promise(r => setTimeout(r, state.capabilityDelay)); return reply(state.grants); } return reply(state.salesGrants); }
    }
    if (path.includes("/catalog/")) {
      const product = path.includes("products");
      const query = url.searchParams.get("search") ?? "";
      return reply(product ? [{ id: query.includes("P7") ? 7 : 8, code: query.includes("P7") ? "P7" : "P8", name: query.includes("P7") ? "Sản phẩm bảy" : "Sản phẩm tám", isActive: true }] : [{ id: path.includes("warehouses") ? 1 : 2, code: "REF", name: "Tham chiếu", isActive: true }]);
    }
    if (path === root && req.method() === "GET") {
      state.queries.push(url.searchParams); if (state.listDenied) return fail(403, "Receipt.ReadDenied");
      return reply({ items: [state.draft], pageNumber: Number(url.searchParams.get("pageNumber")), pageSize: Number(url.searchParams.get("pageSize")), totalCount: state.total });
    }
    if (path === `${root}/${receiptId}`) return state.getDenied ? fail(403, "Receipt.ReadDenied") : reply(state.draft);
    if (path.startsWith(root) && ["POST", "PUT"].includes(req.method())) {
      const body = req.postDataJSON(); state.writes.push({ method: req.method(), body });
      if (state.conflict) return fail(409, "GoodsReceipt.ConcurrencyConflict");
      if (path.endsWith("/post")) { state.draft = { ...state.draft, status: "Posted", postedAtUtc: "2026-11-01T01:00:00Z", version: "AAAAAAAAAAQ=" }; if (state.lost) return route.abort(); return reply({ receiptId, status: "Posted", postedAtUtc: state.draft.postedAtUtc }); }
      state.draft = { ...state.draft, ...body, receiptId, receiptNumber: "GR0000000042", version: "AAAAAAAAAAM=", warehouseDisplayName: null, employeeDisplayName: null,
        lines: body.lines.map((line: any, index: number) => ({ ...line, receiptLineId: String(++lineSerial), lineNumber: index + 1, productDisplayName: null, productIsActive: true })) };
      delete state.draft.expectedVersion;
      if (state.holdWrite) await new Promise<void>(resolve => { state.releaseWrite = resolve; });
      if (state.lost) return route.abort(); return reply(state.draft);
    }
    if (path === "/api/v1/sales-receipts") { if (state.read401) { state.read401 = false; return fail(401, "Auth.Unauthorized"); } return reply(fixture("web2-v1", "sales-list-response")); }
    return fail(404, "Fixture.NotFound");
  });
  return state;
}
async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill("receipt.fixture");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("fixture");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("button", { name: "Phiếu nhập mới", exact: true })).toBeVisible();
}
async function open(page: Page) {
  await page.getByRole("button", { name: "Danh sách phiếu nhập", exact: true }).click();
  await page.getByTestId("goods-receipt-list-grid").locator('.ag-row [col-id="receiptId"]').dblclick();
  const panel = page.getByRole("region", { name: `Phiếu nhập ${receiptId}`, exact: true });
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toBeVisible(); return panel;
}
async function newReceipt(page: Page) {
  await page.getByRole("button", { name: "Phiếu nhập mới", exact: true }).click();
  const panel = page.getByRole("region", { name: "Phiếu nhập mới", exact: true }).last();
  await expect(page.getByRole("region", { name: "Phiếu nhập mới", exact: true })).toHaveCount(1);
  for (const name of ["Kho", "Nhân viên"]) {
    const input = panel.getByRole("combobox", { name, exact: true }); await input.fill("REF");
    await page.getByRole("listbox").getByRole("option").first().click(); await input.press("Tab");
  }
  return panel;
}
async function decimal(panel: Locator, column: string, value: string, row = 0) {
  await panel.locator(`.ag-row[row-index="${row}"] [col-id="${column}"]`).dblclick();
  const input = panel.getByLabel(`${column === "quantity" ? "Số lượng" : "Đơn giá nhập"} dòng ${row + 1}`, { exact: true }); await input.fill(value); return input;
}
test("Receipt toolbar is independently available and real product editor preserves typing/caret and selection navigation", async ({ page, context }, info) => {
  await harness(context); const errors: string[] = []; page.on("pageerror", e => errors.push(e.message)); await login(page);
  const panel = await newReceipt(page);
  await panel.locator('.ag-row[row-index="0"] [col-id="product"]').dblclick();
  const product = panel.getByRole("combobox", { name: "Sản phẩm grid", exact: true });
  await product.pressSequentially("P8"); await expect(product).toHaveValue("P8");
  expect(await product.evaluate((input: HTMLInputElement) => input.selectionStart)).toBe(2);
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1);
  const popup = await page.getByRole("listbox").boundingBox(); expect(popup).not.toBeNull(); expect(popup!.x).toBeGreaterThanOrEqual(0); expect(popup!.x + popup!.width).toBeLessThanOrEqual(1280); expect(popup!.y + popup!.height).toBeLessThanOrEqual(720);
  await page.screenshot({ path: info.outputPath("receipt-product-popup-1280.png") });
  await product.press("ArrowDown"); await product.press("Enter");
  await expect(panel.locator('[col-id="quantity"].ag-cell-focus')).toBeVisible();
  await expect(panel.getByLabel("Số lượng dòng 1", { exact: true })).toHaveCount(0);
  await panel.locator('.ag-row[row-index="0"] [col-id="product"]').dblclick(); await product.pressSequentially("P7");
  await product.press("ArrowDown"); await product.press("Escape"); await product.press("Escape");
  await expect(panel.locator('.ag-row[row-index="0"] [col-id="product"]')).toContainText("Sản phẩm tám");
  await panel.locator('.ag-row[row-index="0"] [col-id="product"]').dblclick(); await product.fill("P7"); await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1); await product.press("ArrowDown"); await product.press("Tab");
  await expect(panel.locator('[col-id="quantity"].ag-cell-focus')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 }); await page.screenshot({ path: info.outputPath("receipt-light-1280.png") });
  expect(errors).toEqual([]);
});
test("Create Update replacement IDs and Post ack Get403 retain exact values and client rows", async ({ page, context }, info) => {
  const state = await harness(context); state.grants.read = false; await login(page);
  await expect(page.getByRole("button", { name: "Danh sách phiếu nhập", exact: true })).toBeDisabled();
  const panel = await newReceipt(page); await panel.locator('.ag-row [col-id="product"]').dblclick();
  const product = panel.getByRole("combobox", { name: "Sản phẩm grid", exact: true }); await product.fill("P8"); await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1); await product.press("ArrowDown"); await product.press("Enter");
  const row = await panel.locator(".ag-row").first().getAttribute("row-id");
  await decimal(panel, "unitCost", "12.3456"); await panel.getByRole("button", { name: "Lưu phiếu nhập", exact: true }).click();
  const active = page.getByRole("region", { name: `Phiếu nhập ${receiptId}`, exact: true }); await expect(active).toContainText("Đã lưu");
  const qty = await decimal(active, "quantity", "2.000"); await qty.press("End"); await qty.press("1");
  await active.getByRole("button", { name: "Lưu phiếu nhập", exact: true }).click(); await expect.poll(() => state.writes.length).toBe(2);
  expect(state.writes[1].body.lines[0]).toEqual({ productId: 8, quantity: "2.0001", unitCost: "12.3456" });
  expect(await active.locator(".ag-row").first().getAttribute("row-id")).toBe(row);
  state.getDenied = true; await active.getByRole("button", { name: "Post phiếu nhập", exact: true }).click();
  await expect(active).toContainText("Posted"); await expect(active).toContainText("version chưa có"); await expect(active).toContainText("Receipt.ReadDenied");
  await expect(active.getByLabel("Ghi chú", { exact: true })).toBeDisabled(); expect(state.writes).toHaveLength(3);
  await page.setViewportSize({ width: 1440, height: 900 }); await page.screenshot({ path: info.outputPath("receipt-posted-1440.png") });
});
test("invalid raw Save/close barrier retains text and focuses stable numeric row; duplicates block then remove", async ({ page, context }) => {
  const state = await harness(context); await login(page); const panel = await open(page);
  await decimal(panel, "quantity", "1x"); await panel.getByRole("button", { name: "Lưu phiếu nhập", exact: true }).click();
  await expect(panel.getByLabel("Số lượng dòng 1", { exact: true })).toHaveValue("1x"); await expect(panel.getByLabel("Số lượng dòng 1", { exact: true })).toBeFocused(); expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Đóng tài liệu", exact: true }).click(); await page.getByRole("dialog").getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(panel.getByLabel("Số lượng dòng 1", { exact: true })).toHaveValue("1x");
  const qty = panel.getByLabel("Số lượng dòng 1", { exact: true }); await qty.fill("3"); await qty.press("Escape");
  await decimal(panel, "quantity", "3"); await panel.getByLabel("Ghi chú", { exact: true }).click();
  await panel.locator('.ag-row[row-index="1"] [col-id="product"]').dblclick(); const product = panel.getByRole("combobox", { name: "Sản phẩm grid", exact: true }); await product.fill("P8"); await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1); await product.press("ArrowDown"); await product.press("Enter");
  await panel.getByRole("button", { name: "Lưu phiếu nhập", exact: true }).click(); await expect(panel).toContainText("Sản phẩm không được trùng"); expect(state.writes).toHaveLength(0);
  await panel.getByRole("button", { name: "Xóa dòng 2", exact: true }).click(); await panel.getByRole("button", { name: "Lưu phiếu nhập", exact: true }).click(); await expect.poll(() => state.writes.length).toBe(1);
});
for (const operation of ["Create", "Update", "Post"] as const) test(`unknown ${operation} locks close/reset and reconciles once without replay`, async ({ page, context }) => {
  const state = await harness(context); await login(page); const panel = operation === "Create" ? await newReceipt(page) : await open(page);
  if (operation === "Create") { await panel.locator('.ag-row [col-id="product"]').dblclick(); const p = panel.getByRole("combobox", { name: "Sản phẩm grid" }); await p.fill("P8"); await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1); await p.press("ArrowDown"); await p.press("Enter"); }
  if (operation !== "Post") await panel.getByLabel("Ghi chú", { exact: true }).fill("unknown sent snapshot");
  state.lost = true; await panel.getByRole("button", { name: operation === "Post" ? "Post phiếu nhập" : "Lưu phiếu nhập", exact: true }).click(); await expect(panel).toContainText("Kết quả chưa rõ");
  await page.getByRole("button", { name: "Đóng tất cả", exact: true }).click(); await page.getByRole("button", { name: "Đặt lại bố cục", exact: true }).click();
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toBeDisabled(); expect(state.writes).toHaveLength(1);
  if (operation === "Create") { await panel.getByRole("button", { name: "Tìm ứng viên qua list", exact: true }).click(); await panel.getByRole("button", { name: `Đối chiếu ${receiptId}`, exact: true }).click(); }
  else await panel.getByRole("button", { name: "Đọc lại để đối soát", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Xác nhận dùng bản authoritative", exact: true })).toBeEnabled(); expect(state.writes).toHaveLength(1);
});
test("409 preview is explicit and unsaved raw remains until confirmation", async ({ page, context }) => {
  const state = await harness(context); await login(page); const panel = await open(page); state.conflict = true;
  await panel.getByLabel("Ghi chú", { exact: true }).fill("Bản sửa riêng ệ"); await panel.getByRole("button", { name: "Lưu phiếu nhập", exact: true }).click(); await expect(panel).toContainText("ConcurrencyConflict");
  await panel.locator("summary").filter({ hasText: "Đọc lại / review conflict" }).click(); await panel.getByRole("button", { name: "Đọc lại để review", exact: true }).click(); await expect(panel.getByLabel("Ghi chú", { exact: true })).toHaveValue("Bản sửa riêng ệ");
  await panel.getByRole("button", { name: "Xác nhận bỏ bản sửa và dùng bản đọc", exact: true }).click(); await expect(panel.getByLabel("Ghi chú", { exact: true })).toHaveValue(state.draft.note);
});
test("paging uses exact total and resets on filter/page size; denied errors stay in Receipt", async ({ page, context }) => {
  const state = await harness(context); state.total = "9223372036854775807"; await login(page); await page.getByRole("button", { name: "Danh sách phiếu nhập", exact: true }).click();
  const list = page.getByRole("region", { name: "Danh sách phiếu nhập", exact: true }); await expect(list).toContainText(state.total);
  await list.getByRole("button", { name: "Trang sau", exact: true }).click(); await expect.poll(() => state.queries.at(-1)?.get("pageNumber")).toBe("2");
  await list.getByLabel("Tìm phiếu nhập", { exact: true }).fill("GR"); await expect.poll(() => state.queries.at(-1)?.get("pageNumber")).toBe("1");
  await list.getByLabel("Số dòng mỗi trang", { exact: true }).selectOption("50"); await expect.poll(() => state.queries.at(-1)?.get("pageSize")).toBe("50");
  state.listDenied = true; await list.getByRole("button", { name: "Tải lại danh sách phiếu nhập", exact: true }).click(); await expect(list.getByRole("alert")).toContainText("Receipt.ReadDenied");
  await expect(page.getByRole("button", { name: "Sales mới", exact: true })).toBeEnabled();
});
test("two new Receipts and a Sale retain separate raw through switch/split and close Cancel", async ({ page, context }, info) => {
  await harness(context); await login(page); await page.getByRole("button", { name: "Sales mới", exact: true }).click(); const sale = page.getByRole("region", { name: "Chứng từ mới", exact: true }); await sale.getByLabel("Ghi chú", { exact: true }).fill("Sales riêng");
  const first = await newReceipt(page); const firstId = await first.getAttribute("data-session-id"); await first.getByLabel("Ghi chú", { exact: true }).fill("Phiếu một");
  await newReceipt(page); const second = page.getByRole("region", { name: "Phiếu nhập mới", exact: true }).last(); await second.getByLabel("Ghi chú", { exact: true }).fill("Phiếu hai");
  await page.getByRole("button", { name: "Tách sang phải", exact: true }).click();
  const retained = page.locator(`[data-session-id="${firstId}"]`); await page.getByRole("tab").filter({ hasText: "Phiếu nhập mới" }).first().click(); await expect(retained.getByLabel("Ghi chú", { exact: true })).toHaveValue("Phiếu một");
  await page.getByRole("button", { name: "Đóng tất cả", exact: true }).click(); await page.getByRole("dialog").getByRole("button", { name: "Tiếp tục sửa", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("tab").filter({ hasText: "Sales mới" }).click(); await expect(sale.getByLabel("Ghi chú", { exact: true })).toHaveValue("Sales riêng");
  await page.setViewportSize({ width: 1440, height: 900 }); await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.getByRole("button", { name: "Lưu chứng từ", exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath("receipt-dark-narrow-groups.png") });
});
test("actual AG Grid renders 200 unique receipt rows and refuses row201", async ({ page, context }) => {
  const state = await harness(context); state.draft.lines = Array.from({ length: 200 }, (_, i) => ({ ...state.draft.lines[0], receiptLineId: String(1000 + i), lineNumber: i + 1, productId: i + 1, productDisplayName: `Sản phẩm ${i + 1}` }));
  await login(page); const panel = await open(page); await expect(panel).toContainText("200 dòng"); await expect(panel.getByRole("button", { name: "Thêm dòng", exact: true })).toBeDisabled();
  await expect(panel.getByRole("grid")).toHaveAttribute("aria-rowcount", "201");
  await panel.getByLabel("Ghi chú", { exact: true }).fill("200 dòng riêng"); await panel.getByRole("button", { name: "Lưu phiếu nhập", exact: true }).click(); await expect.poll(() => state.writes.length).toBe(1); expect(state.writes[0].body.lines).toHaveLength(200);
  await expect(panel.locator('.ag-row[row-index="0"] [col-id="product"]')).toContainText("ID 1");
});
test("pending Receipt mutation blocks close-all/reset and preserves dispatched session", async ({ page, context }) => {
  const state = await harness(context); await login(page); const panel = await open(page); const session = await panel.getAttribute("data-session-id");
  await panel.getByLabel("Ghi chú", { exact: true }).fill("Đang chờ ghi"); state.holdWrite = true;
  await panel.getByRole("button", { name: "Lưu phiếu nhập", exact: true }).click(); await expect.poll(() => !!state.releaseWrite).toBe(true);
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Đóng tất cả", exact: true }).click(); await page.getByRole("button", { name: "Đặt lại bố cục", exact: true }).click();
  await expect(panel).toHaveAttribute("data-session-id", session!); expect(state.writes).toHaveLength(1);
  state.releaseWrite!(); await expect(panel).toContainText("Đã lưu");
});
test("restored Receipt waits for initial capability attempt and canonical layout roundtrips", async ({ page, context }) => {
  const state = await harness(context); await login(page); await open(page);
  await expect.poll(() => page.evaluate(() => Object.entries(localStorage).some(([key, value]) => key.startsWith("mydmsvn.workspace.layout.v2:") && value.includes('"module":"goods-receipt"')))).toBe(true);
  state.capabilityDelay = 500; await page.reload();
  await expect(page.getByText("Đang đọc quyền phiếu nhập…", { exact: true })).toBeVisible();
  const panel = page.getByRole("region", { name: `Phiếu nhập ${receiptId}`, exact: true });
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toHaveValue(state.draft.note);
  await expect(page.getByText(/module chưa khả dụng/)).toHaveCount(0);
});
for (const dirty of [true, false]) test(`same-token refresh retains ${dirty ? "dirty" : "clean"} Receipt and independent Post-only permission`, async ({ page, context }) => {
  const state = await harness(context); await login(page); const panel = await open(page);
  const session = await panel.getAttribute("data-session-id");
  if (dirty) await panel.getByLabel("Ghi chú", { exact: true }).fill("Giữ bản sửa qua refresh");
  state.read401 = true; state.grants = { read: false, write: false, post: true };
  await page.getByRole("tab").filter({ hasText: "Danh sách Sales" }).click(); await page.getByRole("button", { name: "Tải lại danh sách", exact: true }).click();
  await expect(page.getByRole("button", { name: "Phiếu nhập mới", exact: true })).toBeDisabled();
  await page.getByRole("tab").filter({ hasText: "Phiếu nhập GR" }).click();
  await expect(panel).toHaveAttribute("data-session-id", session!); await expect(panel.getByLabel("Ghi chú", { exact: true })).toHaveValue(dirty ? "Giữ bản sửa qua refresh" : state.draft.note);
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toBeDisabled();
  if (dirty) await expect(panel.getByRole("button", { name: "Post phiếu nhập", exact: true })).toBeDisabled();
  else { state.getDenied = true; await panel.getByRole("button", { name: "Post phiếu nhập", exact: true }).click(); await expect(panel).toContainText("Posted"); expect(state.writes).toHaveLength(1); }
});
