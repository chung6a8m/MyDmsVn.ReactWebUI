import { test, expect, type Page, type Locator, type APIResponse } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { openDecimal } from "../e2e/decimal-helpers";

type Actor = { username: string; password: string };
type Manifest = {
  origin: string;
  actors: Record<"alice" | "bob" | "poster", Actor>;
  catalog: { customerId: number; warehouseId: number; employeeId: number; productId: number };
  resultPath: string;
};
const manifest: Manifest = JSON.parse(readFileSync(process.env.MYDMSVN_WEB_PILOT_MANIFEST!, "utf8"));
const root = "/api/v1/sales-receipts";
const accessKey = "mydmsvn.access.v1";
const csrf = { "X-Requested-With": "XMLHttpRequest" };
async function securityStatus(send: () => Promise<APIResponse>): Promise<number> {
  // Playwright request errors include headers. Do not persist bearer/cookie
  // values in a report when TLS or the network fails before a response arrives.
  try { const response = await send(); const status = response.status(); await response.dispose(); return status; }
  catch { throw Error("Direct HTTPS security probe failed before HTTP status; check fixture CA/network setup."); }
}
type Line = { saleLineId: string; productId: number; qty: string; unitPrice: string; isGift: boolean };
type Sale = { saleId: string; version: string; status: string; note?: string; totalAmount: string;
  totalCost?: string; lines: (Line & { lineNo: number; costAmount?: string })[] };

// API setup uses the real host and the browser's authenticated session. Nothing
// here supplies successful fake responses or writes business data directly to SQL.
async function api(page: Page, path: string, method = "GET", body?: unknown) {
  return page.evaluate(async ({ path, method, body, accessKey }) => {
    const response = await fetch(path, { method, credentials: "omit",
      headers: { Authorization: `Bearer ${localStorage.getItem(accessKey)}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, json: await response.json() };
  }, { path, method, body, accessKey });
}
function body(count = 2, note = "WEB2 live") {
  return { saleDate: "2024-02-29", ...manifest.catalog, productId: undefined, note,
    lines: Array.from({ length: count }, (_, i) => ({ saleLineId: "0", productId: manifest.catalog.productId,
      qty: "1.0000", unitPrice: "25.0000", isGift: i % 2 === 1 })) };
}
async function create(page: Page, count = 2, note?: string): Promise<Sale> {
  const result = await api(page, root, "POST", body(count, note));
  expect(result.status).toBe(200);
  return result.json.data;
}
async function login(page: Page, actor: keyof Manifest["actors"] = "alice") {
  await page.goto("/");
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill(manifest.actors[actor].username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(manifest.actors[actor].password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
}
async function open(page: Page, sale: Sale) {
  await page.getByRole("button", { name: "Tải lại danh sách", exact: true }).click();
  await page.getByTestId("sales-list-grid").locator('[col-id="saleId"]').filter({ hasText: new RegExp(`^${sale.saleId}$`) }).dblclick();
  const panel = page.getByRole("region", { name: `Chứng từ ${sale.saleId}`, exact: true });
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toBeVisible();
  return panel;
}
function recordPost(saleId: string, quantity: string, cost: string) {
  const rows = existsSync(manifest.resultPath) ? JSON.parse(readFileSync(manifest.resultPath, "utf8")) : [];
  rows.push({ saleId, quantity, cost });
  writeFileSync(manifest.resultPath, JSON.stringify(rows), "utf8");
}
async function newDocument(page: Page) {
  await page.getByRole("button", { name: "Sales mới", exact: true }).click();
  const panel = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  for (const label of ["Khách hàng", "Kho", "Nhân viên"]) {
    const input = panel.getByRole("combobox", { name: label, exact: true });
    await input.fill("PILOT");
    await page.getByRole("listbox").getByRole("option").first().click();
    await input.press("Tab");
  }
  await panel.locator('.ag-row[row-index="0"] [col-id="product"]').dblclick();
  const product = panel.getByRole("combobox", { name: "Sản phẩm grid", exact: true });
  await product.fill("PILOT");
  await page.getByRole("listbox").getByRole("option").first().click();
  await product.press("Tab");
  return panel;
}
async function unknown(panel: Locator) {
  await expect(panel.getByText("Kết quả chưa rõ; phiên đang khóa để đối soát.", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Lưu chứng từ", exact: true })).toBeDisabled();
}

test("trusted HTTPS renders styled production grid; cookie, CSP and logout enforce auth", async ({ page, context }) => {
  const violations: { directive: string; blocked: string; source: string; line: number }[] = [];
  const errors: string[] = [];
  const assets: { path: string; status: number; type: string }[] = [];
  page.on("response", response => {
    if (new URL(response.url()).pathname.startsWith("/assets/")) assets.push({ path: new URL(response.url()).pathname, status: response.status(), type: response.headers()["content-type"] ?? "" });
  });
  await page.exposeFunction("pilotViolation", (event: typeof violations[number]) => violations.push(event));
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", e =>
    (window as unknown as { pilotViolation: (d: unknown) => void }).pilotViolation({ directive: e.effectiveDirective, blocked: e.blockedURI, source: e.sourceFile, line: e.lineNumber })));
  page.on("pageerror", error => errors.push(error.message));
  const response = await page.goto("/");
  expect(response!.headers()["content-security-policy"]).toContain("script-src 'self'");
  expect(response!.headers()["strict-transport-security"]).toContain("max-age=");
  await expect.poll(() => assets.filter(asset => asset.path.endsWith(".js")).length).toBeGreaterThan(0);
  expect(assets.filter(asset => asset.status !== 200)).toEqual([]);
  expect(errors).toEqual([]);
  await expect(page.getByLabel("Tên đăng nhập", { exact: true })).toBeVisible({ timeout: 20_000 });
  await login(page);
  await expect(page).toHaveTitle(/MyDmsVn/);
  expect(new URL(page.url()).origin).toBe(manifest.origin);
  await expect(page.getByTestId("sales-list-grid").getByRole("grid")).toBeVisible();
  expect(errors).toEqual([]);
  expect(violations).toEqual([]);
  const cookie = (await context.cookies()).find(c => c.name === "__Host-mydmsvn-rt")!;
  expect(!!cookie && cookie.httpOnly && cookie.secure && cookie.sameSite === "Strict" && cookie.path === "/").toBe(true);
  expect(await page.evaluate(() => document.cookie.includes("mydmsvn-rt"))).toBe(false);
  expect(await page.evaluate(key => !!localStorage.getItem(key), accessKey)).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
  // An actual inline script must be blocked, while the app itself has no CSP violation.
  await page.evaluate(() => { const s = document.createElement("script"); s.textContent = "window.__pilotXss = true"; document.body.append(s); });
  expect(await page.evaluate(() => "__pilotXss" in window)).toBe(false);
  await expect.poll(() => violations.some(v => v.directive === "script-src-elem")).toBe(true);
  const beforeLogout = await page.evaluate(key => localStorage.getItem(key), accessKey);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  expect(await securityStatus(() => context.request.get(`${manifest.origin}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${beforeLogout}` } }))).toBe(401);
  expect((await context.cookies()).some(c => c.name === "__Host-mydmsvn-rt")).toBe(false);
  expect(await securityStatus(() => context.request.post(`${manifest.origin}/api/v1/auth/refresh`, { headers: csrf }))).toBe(403);
  expect(await securityStatus(() => context.request.post(`${manifest.origin}/api/v1/auth/refresh`, { headers: { ...csrf, Origin: "https://outside.invalid" } }))).toBe(403);
});

test("two tabs rotate once; replay revokes access; distinct browser actors keep private drafts isolated", async ({ page, context, browser }) => {
  await login(page);
  const second = await context.newPage(); await second.goto("/");
  await expect(second.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
  const oldCookie = (await context.cookies()).find(c => c.name === "__Host-mydmsvn-rt")!;
  let refreshes = 0;
  context.on("request", request => { if (request.url().endsWith("/auth/refresh")) refreshes++; });
  await page.evaluate(key => localStorage.removeItem(key), accessKey);
  await Promise.all([page.reload(), second.reload()]);
  for (const tab of [page, second]) await expect(tab.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
  expect(refreshes).toBe(1);
  const sale = await create(page); const panel = await open(page, sale);
  await panel.getByLabel("Ghi chú", { exact: true }).fill("private uncommitted actor A");
  const other = await browser.newContext({ baseURL: manifest.origin, ignoreHTTPSErrors: false });
  try {
    const bob = await other.newPage(); await login(bob, "bob");
    expect((await api(bob, "/api/v1/auth/me")).json.data.username).toBe(manifest.actors.bob.username);
    expect((await api(page, "/api/v1/auth/me")).json.data.username).toBe(manifest.actors.alice.username);
    await expect(bob.getByRole("button", { name: "Sales mới", exact: true })).toBeDisabled();
    expect((await api(bob, root, "POST", body())).status).toBe(403);
    expect(await bob.locator("input").evaluateAll(nodes => nodes.map(n => (n as HTMLInputElement).value))).not.toContain("private uncommitted actor A");
  } finally { await other.close(); }
  const replay = await securityStatus(() => context.request.post(`${manifest.origin}/api/v1/auth/refresh`, {
    headers: { ...csrf, Origin: manifest.origin, Cookie: `${oldCookie.name}=${oldCookie.value}` } }));
  expect(replay).toBe(401);
  expect((await api(page, "/api/v1/auth/me")).status).toBe(401);
  // The document tab is active (the list is hidden). Exercise its next real
  // command; a revoked session must fail before SQL mutation and hide raw data.
  // A concurrent auth observation may already have rendered login instead.
  await page.getByRole("button", { name: /^(Lưu chứng từ|Đăng nhập)$/ }).evaluate(button => {
    if (button.textContent?.trim() === "Lưu chứng từ") (button as HTMLButtonElement).click();
  });
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  await expect(panel).toHaveCount(0);
});

test("200 duplicate gift lines survive grid Save barrier and real Post with exact COGS", async ({ page }, info) => {
  await login(page);
  const sale = await create(page, 200);
  expect(new Set(sale.lines.map(l => l.saleLineId)).size).toBe(200);
  const panel = await open(page, sale);
  await expect(panel).toContainText("200 dòng");
  const qty = await openDecimal(panel, "qty");
  await qty.fill("1.000"); await qty.press("End"); await qty.press("1");
  const saved = page.waitForResponse(r => r.request().method() === "PUT" && r.url().endsWith(`/${sale.saleId}/draft`));
  await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  const document: Sale = (await (await saved).json()).data;
  expect(document.lines[0].qty).toBe("1.0001");
  expect(document.lines).toHaveLength(200);
  expect(document.lines.map(l => l.saleLineId)).toEqual(sale.lines.map(l => l.saleLineId));
  const posted = page.waitForResponse(r => r.url().endsWith(`/${sale.saleId}/post`));
  await panel.getByRole("button", { name: "Post chứng từ", exact: true }).click();
  expect((await posted).status()).toBe(200);
  recordPost(sale.saleId, "200.0001", "3000.0015");
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toBeDisabled();
  const detail = (await api(page, `${root}/${sale.saleId}`)).json.data;
  expect(detail.status).toBe("Posted");
  expect(detail.totalCost).toMatch(/^3000\.00150*$/);
  expect(detail.totalAmount).toMatch(/^2500\.00250*$/);
  await page.screenshot({ path: info.outputPath("posted-200-lines.png") });
});

test("stale rowversion rejects Save and keeps raw text; maximum gift decimal stays exact", async ({ page }) => {
  await login(page);
  const request = body(1); request.lines[0] = { ...request.lines[0], qty: "99999999999999.9999", unitPrice: "999999999999999.9999", isGift: true };
  const created = await api(page, root, "POST", request); expect(created.status).toBe(200);
  const sale: Sale = created.json.data;
  expect(sale.lines[0].qty).toBe("99999999999999.9999");
  expect(sale.lines[0].unitPrice).toBe("999999999999999.9999");
  const panel = await open(page, sale);
  const update = await api(page, `${root}/${sale.saleId}/draft`, "PUT", { ...request, expectedVersion: sale.version, lines: sale.lines.map(({ saleLineId, productId, qty, unitPrice, isGift }) => ({ saleLineId, productId, qty, unitPrice, isGift })), note: "other writer" });
  expect(update.status).toBe(200);
  await panel.getByLabel("Ghi chú", { exact: true }).fill("raw text retained ệ");
  const response = page.waitForResponse(r => r.request().method() === "PUT");
  await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  expect((await response).status()).toBe(409);
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toHaveValue("raw text retained ệ");
});

for (const operation of ["Create", "Update", "Post"] as const) {
  test(`committed ${operation} response loss locks UI and never replays the mutation`, async ({ page, context }) => {
    await login(page);
    const sale = operation === "Create" ? undefined : await create(page);
    const panel = sale ? await open(page, sale) : await newDocument(page);
    if (operation !== "Post") await panel.getByLabel("Ghi chú", { exact: true }).fill(`lost ${operation}`);
    let sends = 0; let committed: Sale | undefined;
    const suffix = operation === "Create" ? root : `${root}/${sale!.saleId}/${operation === "Update" ? "draft" : "post"}`;
    const method = operation === "Update" ? "PUT" : "POST";
    await context.route(`${manifest.origin}${suffix}`, async route => {
      if (route.request().method() !== method) return route.continue();
      sends++;
      const response = await route.fetch({ maxRetries: 0 });
      expect(response.status()).toBe(200);
      committed = (await response.json()).data;
      if (operation === "Post") recordPost(sale!.saleId, "2", "30");
      await route.abort("failed");
    });
    await panel.getByRole("button", { name: operation === "Post" ? "Post chứng từ" : "Lưu chứng từ", exact: true }).click();
    await unknown(panel);
    expect(!!committed).toBe(true);
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
    const authoritative = await api(page, `${root}/${committed!.saleId}`);
    expect(authoritative.status).toBe(200);
    expect(authoritative.json.data.status).toBe(operation === "Post" ? "Posted" : "Draft");
    if (operation === "Create") {
      await panel.getByRole("button", { name: "Tìm ứng viên qua list", exact: true }).click();
      await panel.getByRole("button", { name: `Đối chiếu ${committed!.saleId}`, exact: true }).click();
    } else await panel.getByRole("button", { name: "Đọc lại để đối soát", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Xác nhận dùng bản authoritative", exact: true })).toBeEnabled();
    expect(sends).toBe(1);
  });
}

test("Write and Post without Read: UI Create succeeds, Post ack stays read-only after real Get403", async ({ page }, info) => {
  await login(page, "poster");
  expect((await api(page, root)).status).toBe(403);
  const panel = await newDocument(page);
  const saved = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(root));
  await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  const sale: Sale = (await (await saved).json()).data;
  const active = page.getByRole("region", { name: `Chứng từ ${sale.saleId}`, exact: true });
  const ack = page.waitForResponse(r => r.url().endsWith(`/${sale.saleId}/post`));
  const denied = page.waitForResponse(r => r.request().method() === "GET" && r.url().endsWith(`/${sale.saleId}`));
  await active.getByRole("button", { name: "Post chứng từ", exact: true }).click();
  expect((await ack).status()).toBe(200);
  recordPost(sale.saleId, "1", "15");
  expect((await denied).status()).toBe(403);
  await expect(active).toContainText("Posted");
  await expect(active.getByLabel("Ghi chú", { exact: true })).toBeDisabled();
  await expect(active.getByRole("button", { name: "Post chứng từ", exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath("post-ack-get403.png") });
});
