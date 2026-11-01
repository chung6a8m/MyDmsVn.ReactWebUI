import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openDecimal } from "./decimal-helpers";
import { protectedStatusFixture, web4Context, web4Epoch } from "./helpers/web4HttpFixture";

// Immutable upstream wire examples; fault cases mutate per-test clones only.
const fixture = (name: string) => JSON.parse(readFileSync(resolve("tests/fixtures/web2-v1", `${name}.json`), "utf8"));
const saleId = "9223372036854775807";
const token = (sid: string, serial: number) => `e30.${Buffer.from(JSON.stringify({ sid, exp: Math.floor(Date.now() / 1000) + 600, jti: serial })).toString("base64url")}.test-only`;

async function harness(context: BrowserContext) {
  const operations = new Map<string, Awaited<ReturnType<typeof protectedStatusFixture>>>();
  function amounts(detail: ReturnType<typeof fixture>) {
    const scaled = (value: string) => { const [whole, fraction = ""] = value.split("."); return BigInt(whole + fraction.padEnd(4, "0")); };
    const decimal = (value: bigint) => `${value / 10000n}.${String(value % 10000n).padStart(4, "0")}`;
    let total = 0n;
    for (const line of detail.lines) { const amount = line.isGift ? 0n : (scaled(line.qty) * scaled(line.unitPrice) + 5000n) / 10000n; line.lineAmount = decimal(amount); total += amount; }
    detail.totalAmount = decimal(total); return detail;
  }
  const state = {
    signedIn: false, sid: "browser-session-a", serial: 0, refreshes: 0, logouts: 0,
    writes: [] as { method: string; body: Record<string, unknown> }[],
    draft: fixture("sales-get-draft-response").data,
    posted: false, getDenied: false, loseWrite: false, conflict: false,
    read401: false, readForbidden: false, listQueries: [] as string[],
    capabilities: { read: true, write: true, post: true }, catalogDenied: false,
    user: fixture("auth-me-response").data,
  };
  await context.route("**/api/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const reply = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "no-store" }, body: JSON.stringify({ data }) });
    const failure = (status: number, code: string) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: { code, message: code, details: [], correlationId: "browser-test" } }) });
    if (path.includes("/auth/")) {
      const action = path.split("/").at(-1);
      if (request.method() === "POST") {
        expect(request.headers()["x-requested-with"]).toBe("XMLHttpRequest");
        expect(request.headers().origin).toBe(url.origin);
      }
      if (action === "login") {
        state.signedIn = true; state.sid = `browser-session-${++state.serial}`;
        state.user = request.postDataJSON().username === "second.actor" ? { userId: 17, username: "second.actor", displayName: "Người dùng thứ hai" } : fixture("auth-me-response").data;
      }
      if (action === "logout") { state.logouts++; state.signedIn = false; return reply({}); }
      if (action === "refresh") { state.refreshes++; if (!state.signedIn) return failure(401, "Auth.Unauthorized"); }
      if (action === "login" || action === "refresh") return reply({ accessToken: token(state.sid, ++state.serial), expiresAtUtc: new Date(Date.now() + 600000).toISOString(), user: state.user });
      if (action === "me") return reply(state.user);
      if (action === "capabilities") return reply(state.capabilities);
    }
    expect(request.headers().authorization).toMatch(/^Bearer /);
    if (path === "/api/v1/operations/context") return reply(web4Context(state.user.userId).data);
    if (path.startsWith("/api/v1/operations/")) {
      const operation = operations.get(path.split("/").at(-1)!);
      expect(request.headers()["x-mydmsvn-deployment-epoch"]).toBe(web4Epoch);
      expect(request.headers()["x-mydmsvn-operation-fingerprint"]).toBe(operation?.data.requestFingerprint);
      return operation ? reply(operation.data) : failure(404, "Operation.NotObserved");
    }
    if (request.method() === "GET" && state.read401) { state.read401 = false; return failure(401, "Auth.Unauthorized"); }
    if (path === "/api/v1/sales-receipts" && request.method() === "POST") {
      const body = request.postDataJSON(); state.writes.push({ method: "POST", body });
      state.draft = { ...state.draft, saleDate: body.saleDate, note: body.note, version: "AAAAAAAAAAQ=", totalAmount: "0.0000", lines: body.lines.map((line: Record<string, unknown>, i: number) => ({ ...line, saleLineId: String(9007199254740993n + BigInt(i)), lineNo: i + 1, unit: "cái", lineAmount: "0.0000", productDisplayName: "SP104 - Sản phẩm cũ", productIsActive: true })) };
      amounts(state.draft);
      operations.set(request.headers()["idempotency-key"], await protectedStatusFixture(request, state.draft));
      if (state.loseWrite) return route.abort("failed");
      return reply(state.draft);
    }
    if (path === "/api/v1/sales-receipts") {
      state.listQueries.push(url.search);
      if (state.readForbidden) return failure(403, "Auth.Forbidden");
      const page = fixture("sales-list-response").data;
      page.items[0].status = state.posted ? "Posted" : "Draft";
      return reply(page);
    }
    if (path === `/api/v1/sales-receipts/${saleId}`) {
      if (state.getDenied) return failure(403, "Auth.Forbidden");
      return reply(state.posted ? fixture("sales-get-posted-response").data : state.draft);
    }
    if (request.method() === "PUT" || path.endsWith("/post")) {
      const body = request.postDataJSON(); state.writes.push({ method: request.method(), body });
      if (state.conflict) return failure(409, "SalesReceipt.ConcurrencyConflict");
      if (path.endsWith("/post")) state.posted = true;
      else {
        state.draft.note = body.note; state.draft.version = "AAAAAAAAAAQ=";
        state.draft.lines = state.draft.lines.map((line: Record<string, unknown>, index: number) => ({ ...line, ...body.lines[index] }));
        amounts(state.draft);
      }
      operations.set(request.headers()["idempotency-key"], await protectedStatusFixture(request, path.endsWith("/post") ? fixture("sales-post-response").data : state.draft));
      if (state.loseWrite) return route.abort("failed");
      return reply(path.endsWith("/post") ? fixture("sales-post-response").data : state.draft);
    }
    if (path.includes("/catalog/")) return state.catalogDenied ? failure(403, "Auth.Forbidden") : reply(fixture(`catalog-${path.split("/")[4]}-response`).data);
    return failure(404, "NotFound");
  });
  return state;
}
async function login(page: Page, username = "web2.fixture") {
  await page.goto("/");
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("inert-browser-test");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
}
async function openSale(page: Page) {
  await page.getByTestId("sales-list-grid").locator('.ag-row [col-id="saleId"]').dblclick();
  const panel = page.getByRole("region", { name: `Chứng từ ${saleId}`, exact: true });
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toHaveValue("Đã cập nhật");
  return panel;
}
async function reconcile(page: Page) {
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
  await dialog.getByRole("button", { name: "Kiểm tra kết quả", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Kiểm tra kết quả", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
}

test("HTTP login exact read/save and logout Cancel preserve raw document", async ({ page, context }) => {
  const state = await harness(context); await login(page);
  const panel = await openSale(page);
  const rowIds = await panel.locator(".ag-row").evaluateAll(rows => rows.map(row => row.getAttribute("row-id")));
  const quantity = await openDecimal(panel, "qty");
  await quantity.fill("1.250");
  await quantity.press("End"); await quantity.press("1");
  await panel.getByLabel("Ghi chú", { exact: true }).fill("Ký tự cuối cùng ệ");
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Tiếp tục sửa", exact: true }).click();
  expect(state.logouts).toBe(0);
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toHaveValue("Ký tự cuối cùng ệ");
  await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("Đã lưu");
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body.note).toBe("Ký tự cuối cùng ệ");
  expect((state.writes[0].body.lines as { qty: string }[])[0].qty).toBe("1.2501");
  expect(JSON.stringify(state.writes[0].body)).not.toMatch(/clientLineId|actorKey|costAmount/);
  expect(await panel.locator(".ag-row").evaluateAll(rows => rows.map(row => row.getAttribute("row-id")))).toEqual(rowIds);
  const storage = await page.evaluate(() => Object.entries(localStorage));
  expect(storage.some(([, value]) => value.includes("inert-browser-test"))).toBe(false);
  expect(storage.some(([key]) => /refresh/i.test(key))).toBe(false);
});

test("Post ack remains Posted and read-only when authoritative Get is forbidden", async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const state = await harness(context); await login(page); const panel = await openSale(page);
  state.getDenied = true;
  await panel.getByRole("button", { name: "Post chứng từ", exact: true }).click();
  await expect(panel).toContainText("Posted");
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "Post chứng từ", exact: true })).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toEqual({ expectedVersion: "AAAAAAAAAAI=" });
  await page.screenshot({ path: testInfo.outputPath("post-ack-get-denied.png") });
});

test("lost Update response locks recovery and blocks logout without write replay", async ({ page, context }) => {
  const state = await harness(context); await login(page); const panel = await openSale(page);
  state.loseWrite = true;
  await panel.getByLabel("Ghi chú", { exact: true }).fill("Unknown commit");
  await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  await expect(panel.getByText("Kết quả chưa rõ; phiên đang khóa để đối soát.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  expect(state.logouts).toBe(0); expect(state.writes).toHaveLength(1);
  await expect(panel.getByRole("button", { name: "Lưu chứng từ", exact: true })).toBeDisabled();
  await reconcile(page);
  await expect(panel.getByRole("button", { name: "Lưu chứng từ", exact: true })).toBeEnabled();
  expect(state.writes).toHaveLength(1);
});

test("401 read refreshes once while 403 stays an error", async ({ page, context }) => {
  const state = await harness(context); await login(page);
  await expect(page.getByTestId("sales-list-grid").locator(".ag-row")).toHaveCount(1);
  const before = state.refreshes; state.read401 = true;
  await page.getByRole("button", { name: "Tải lại danh sách", exact: true }).click();
  await expect.poll(() => state.refreshes).toBe(before + 1);
  state.readForbidden = true;
  await page.getByRole("button", { name: "Tải lại danh sách", exact: true }).click();
  await expect(page.getByRole("region", { name: "Danh sách Sales", exact: true }).getByRole("alert")).toContainText("Auth.Forbidden");
  expect(state.refreshes).toBe(before + 1);
});

test("two browser tabs coordinate one refresh and cross-tab logout hides protected data", async ({ page, context }) => {
  const state = await harness(context); await login(page);
  const second = await context.newPage(); await second.goto("/");
  await expect(second.getByTestId("sales-list-grid").locator(".ag-row")).toHaveCount(1);
  let received = 0;
  let release!: () => void;
  const bothRequests = new Promise<void>(resolve => { release = resolve; });
  await context.route("**/api/v1/sales-receipts?*", async route => {
    if (received >= 2) return route.fallback();
    received++;
    if (received === 2) release();
    await bothRequests;
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { code: "Auth.Unauthorized", message: "Expired", details: [] } }) });
  });
  const before = state.refreshes;
  await Promise.all([page, second].map(tab => tab.getByRole("button", { name: "Tải lại danh sách", exact: true }).click()));
  await expect.poll(() => state.refreshes).toBe(before + 1);
  await expect(second.getByTestId("sales-list-grid").locator(".ag-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(second.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  await expect(second.getByRole("grid")).toHaveCount(0);
  expect(state.logouts).toBe(1);
});

test("Create lost response retains sent snapshot for explicit protected reconciliation", async ({ page, context }) => {
  const state = await harness(context); await login(page);
  await page.getByRole("button", { name: "Sales mới", exact: true }).click();
  const panel = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  for (const label of ["Khách hàng", "Kho", "Nhân viên"]) {
    const input = panel.getByRole("combobox", { name: label, exact: true });
    await input.fill("1");
    await page.getByRole("listbox").getByRole("option").first().click();
    await input.press("Tab");
  }
  await panel.locator('.ag-row[row-index="0"] [col-id="product"]').dblclick();
  const product = panel.getByRole("combobox", { name: "Sản phẩm grid", exact: true });
  await product.fill("SP104");
  await page.getByRole("listbox").getByRole("option").first().click(); await product.press("Tab");
  state.loseWrite = true;
  await panel.getByLabel("Ghi chú", { exact: true }).fill("Create unknown");
  await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  await expect(panel.getByText("Kết quả chưa rõ; phiên đang khóa để đối soát.", { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect((state.writes[0].body.lines as { saleLineId: string }[])[0].saleLineId).toBe("0");
  await reconcile(page);
  expect(state.writes).toHaveLength(1);
  await expect(page.getByRole("region", { name: `Chứng từ ${saleId}`, exact: true })).toBeVisible();
});

test("Post response loss requires explicit protected proof and never repeats Post", async ({ page, context }) => {
  const state = await harness(context); await login(page); const panel = await openSale(page);
  state.loseWrite = true;
  await panel.getByRole("button", { name: "Post chứng từ", exact: true }).click();
  await expect(panel.getByText("Kết quả chưa rõ; phiên đang khóa để đối soát.", { exact: true })).toBeVisible();
  await reconcile(page);
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toBeDisabled();
  expect(state.writes).toHaveLength(1);
});

test("Write does not imply Sales Read or independent Catalog access", async ({ page, context }) => {
  const state = await harness(context); state.capabilities.read = false; state.catalogDenied = true;
  await login(page);
  await expect(page.getByRole("button", { name: "Sales mới", exact: true })).toBeEnabled();
  expect(state.listQueries).toHaveLength(0);
  await page.getByRole("button", { name: "Sales mới", exact: true }).click();
  const panel = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  await panel.getByRole("combobox", { name: "Khách hàng", exact: true }).fill("KH");
  await expect(page.getByText("Auth.Forbidden", { exact: true })).toBeVisible();
  expect(state.listQueries).toHaveLength(0);
});

test("cross-tab new actor cannot inherit private dirty documents", async ({ page, context }) => {
  await harness(context); await login(page); const panel = await openSale(page);
  await panel.getByLabel("Ghi chú", { exact: true }).fill("Owner A private buffer");
  const second = await context.newPage(); await second.goto("/");
  await expect(second.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
  await second.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  await expect(panel).toHaveCount(0);
  await login(second, "second.actor");
  await expect(page.getByText("Người dùng thứ hai", { exact: true })).toBeVisible();
  expect(await page.locator("input").evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))).not.toContain("Owner A private buffer");
  await expect(page.getByRole("region", { name: `Chứng từ ${saleId}`, exact: true })).toHaveCount(0);
  const dialogs: string[] = [];
  page.on("dialog", async dialog => { dialogs.push(dialog.type()); await dialog.dismiss(); });
  await page.reload();
  await expect(page.getByText("Người dùng thứ hai", { exact: true })).toBeVisible();
  expect(dialogs).toEqual([]); // Actor invalidation clears private RAM immediately.
  await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Mở bản nháp", exact: true })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Owner A private buffer");
});
