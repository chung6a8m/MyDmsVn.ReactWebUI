import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

type ActorName = "receiptEditor" | "receiptPoster" | "receiptReader";
type Receipt = {
  receiptId: string; receiptNumber: string; version: string; status: "Draft" | "Posted";
  lines: { receiptLineId: string; lineNumber: number; productId: number; quantity: string; unitCost: string }[];
};
type Manifest = {
  mode: string; origin: string; resultPath: string;
  actors: Record<ActorName, { username: string; password: string }>;
  receiptCatalog: { warehouseId: number; employeeId: number; productId: number };
};
const manifest: Manifest = JSON.parse(readFileSync(process.env.MYDMSVN_WEB_PILOT_MANIFEST!, "utf8"));
const root = "/api/v1/goods-receipts";
const accessKey = "mydmsvn.access.v1";

// Every successful response is from the owned HTTPS host. The only interception
// below discards an already committed response; it never fabricates a commit.
async function api(page: Page, path: string, method = "GET", body?: unknown) {
  return page.evaluate(async ({ path, method, body, accessKey }) => {
    const response = await fetch(path, { method, credentials: "omit", headers: {
      Authorization: `Bearer ${localStorage.getItem(accessKey)}`, "Content-Type": "application/json",
    }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, json: await response.json() };
  }, { path, method, body, accessKey });
}
function draftBody(note = "WEB3 receipt live") {
  const { warehouseId, employeeId, productId } = manifest.receiptCatalog;
  return { receiptDate: "2024-02-29", warehouseId, employeeId, note,
    lines: [{ productId, quantity: "1.0000", unitCost: "20.0000" }] };
}
async function login(page: Page, actor: ActorName = "receiptEditor") {
  await page.goto("/");
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill(manifest.actors[actor].username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(manifest.actors[actor].password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Phiếu nhập mới", exact: true })).toBeVisible();
}
async function create(page: Page, note?: string): Promise<Receipt> {
  const result = await api(page, root, "POST", draftBody(note));
  expect(result.status).toBe(200);
  return result.json.data;
}
async function open(page: Page, receipt: Receipt) {
  await page.getByRole("button", { name: "Danh sách phiếu nhập", exact: true }).click();
  const list = page.getByRole("region", { name: "Danh sách phiếu nhập", exact: true });
  await list.getByLabel("Tìm phiếu nhập", { exact: true }).fill(receipt.receiptNumber);
  await page.getByTestId("goods-receipt-list-grid").locator('[col-id="receiptId"]').filter({ hasText: new RegExp(`^${receipt.receiptId}$`) }).dblclick();
  const panel = page.getByRole("region", { name: `Phiếu nhập ${receipt.receiptId}`, exact: true });
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toBeVisible();
  return panel;
}
async function newReceipt(page: Page) {
  await page.getByRole("button", { name: "Phiếu nhập mới", exact: true }).click();
  const panel = page.getByRole("region", { name: "Phiếu nhập mới", exact: true });
  for (const label of ["Kho", "Nhân viên"]) {
    const input = panel.getByRole("combobox", { name: label, exact: true });
    await input.fill("PILOT");
    await page.getByRole("listbox").getByRole("option").first().click();
    await input.press("Tab");
  }
  await panel.locator('.ag-row[row-index="0"] [col-id="product"]').dblclick();
  const product = panel.getByRole("combobox", { name: "Sản phẩm grid", exact: true });
  await product.pressSequentially("WEB3-RP");
  await expect(product).toHaveValue("WEB3-RP");
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1);
  await product.press("ArrowDown");
  await product.press("Enter");
  await expect(panel.locator('[col-id="quantity"].ag-cell-focus')).toBeVisible();
  await expect(panel.getByLabel("Số lượng dòng 1", { exact: true })).toHaveCount(0);
  return panel;
}
async function decimal(panel: Locator, column: "quantity" | "unitCost", text: string) {
  await panel.locator(`.ag-row[row-index="0"] [col-id="${column}"]`).dblclick();
  const input = panel.getByLabel(column === "quantity" ? "Số lượng dòng 1" : "Đơn giá nhập dòng 1", { exact: true });
  await input.fill(text);
  return input;
}
function recordPost(receiptId: string, quantity: string, value: string, actor: ActorName = "receiptEditor") {
  const rows = existsSync(manifest.resultPath) ? JSON.parse(readFileSync(manifest.resultPath, "utf8")) : [];
  rows.push({ documentType: "GoodsReceipt", receiptId, quantity, value, actor });
  writeFileSync(manifest.resultPath, JSON.stringify(rows), "utf8");
}
async function expectUnknown(panel: Locator) {
  await expect(panel).toContainText("Kết quả chưa rõ");
  await expect(panel.getByRole("button", { name: "Lưu phiếu nhập", exact: true })).toBeDisabled();
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toBeDisabled();
}

test("Receipt Create→replace Update→Post preserves row identity beside dirty Sales on real HTTPS", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await login(page);
  await expect(page).toHaveTitle(/MyDmsVn/);
  expect(new URL(page.url()).origin).toBe(manifest.origin);
  await page.getByRole("button", { name: "Sales mới", exact: true }).click();
  const sale = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  await sale.getByLabel("Ghi chú", { exact: true }).fill("Sales private draft beside Receipt");
  const panel = await newReceipt(page);
  await page.getByRole("button", { name: "Tách sang phải", exact: true }).click();
  await expect(sale.getByLabel("Ghi chú", { exact: true })).toHaveValue("Sales private draft beside Receipt");
  const rowIds = await panel.locator(".ag-row").evaluateAll(rows => rows.map(row => row.getAttribute("row-id")));
  await decimal(panel, "unitCost", "20.0000");
  const createdResponse = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === root);
  await panel.getByRole("button", { name: "Lưu phiếu nhập", exact: true }).click();
  const created = await createdResponse;
  expect(created.status()).toBe(200);
  const receipt: Receipt = (await created.json()).data;
  const active = page.getByRole("region", { name: `Phiếu nhập ${receipt.receiptId}`, exact: true });
  await expect(active).toContainText(receipt.receiptNumber);
  expect(await active.locator(".ag-row").evaluateAll(rows => rows.map(row => row.getAttribute("row-id")))).toEqual(rowIds);
  const quantity = await decimal(active, "quantity", "2.000");
  await quantity.press("End"); await quantity.press("1");
  const updatedResponse = page.waitForResponse(r => r.request().method() === "PUT" && new URL(r.url()).pathname === `${root}/${receipt.receiptId}/draft`);
  await active.getByRole("button", { name: "Lưu phiếu nhập", exact: true }).click();
  const updated = await updatedResponse;
  expect(updated.status()).toBe(200);
  const replacement: Receipt = (await updated.json()).data;
  expect(replacement.lines[0].quantity).toBe("2.0001");
  expect(replacement.lines[0].receiptLineId).not.toBe(receipt.lines[0].receiptLineId);
  expect(Object.keys(updated.request().postDataJSON().lines[0]).sort()).toEqual(["productId", "quantity", "unitCost"]);
  expect(await active.locator(".ag-row").evaluateAll(rows => rows.map(row => row.getAttribute("row-id")))).toEqual(rowIds);
  const postedResponse = page.waitForResponse(r => new URL(r.url()).pathname === `${root}/${receipt.receiptId}/post`);
  await active.getByRole("button", { name: "Post phiếu nhập", exact: true }).click();
  const posted = await postedResponse;
  expect(posted.status()).toBe(200);
  expect(Object.keys((await posted.json()).data).sort()).toEqual(["postedAtUtc", "receiptId", "status"]);
  recordPost(receipt.receiptId, "2.0001", "40.0020");
  await expect(active).toContainText("Posted");
  await expect(active.getByLabel("Ghi chú", { exact: true })).toBeDisabled();
  await expect(sale.getByLabel("Ghi chú", { exact: true })).toHaveValue("Sales private draft beside Receipt");
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath("receipt-posted-beside-sales.png") });
});

test("Receipt stale rowversion returns real 409 and retains local raw edits for explicit review", async ({ page }) => {
  await login(page);
  const receipt = await create(page);
  const panel = await open(page, receipt);
  const changed = await api(page, `${root}/${receipt.receiptId}/draft`, "PUT", { ...draftBody("other writer"), expectedVersion: receipt.version });
  expect(changed.status).toBe(200);
  await panel.getByLabel("Ghi chú", { exact: true }).fill("Bản sửa riêng ệ");
  const response = page.waitForResponse(r => r.request().method() === "PUT");
  await panel.getByRole("button", { name: "Lưu phiếu nhập", exact: true }).click();
  expect((await response).status()).toBe(409);
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toHaveValue("Bản sửa riêng ệ");
  await expect(panel.getByRole("button", { name: "Lưu phiếu nhập", exact: true })).toBeEnabled();
});

for (const operation of ["Create", "Update", "Post"] as const) {
  test(`Receipt committed ${operation} response loss locks close/logout without mutation replay`, async ({ page, context }) => {
    await login(page);
    const receipt = operation === "Create" ? undefined : await create(page);
    const panel = receipt ? await open(page, receipt) : await newReceipt(page);
    if (operation === "Create") await decimal(panel, "unitCost", "20.0000");
    if (operation !== "Post") await panel.getByLabel("Ghi chú", { exact: true }).fill(`WEB3 lost ${operation}`);
    const path = operation === "Create" ? root : `${root}/${receipt!.receiptId}/${operation === "Update" ? "draft" : "post"}`;
    const method = operation === "Update" ? "PUT" : "POST";
    let sends = 0; let committedId = "";
    await context.route(`${manifest.origin}${path}`, async route => {
      if (route.request().method() !== method) return route.continue();
      sends++;
      // APIRequestContext errors may contain Authorization headers. Keep the
      // original exception out of the browser report if transport fails.
      let response;
      try { response = await route.fetch({ maxRetries: 0 }); }
      catch { await route.abort("failed"); throw Error("Receipt fault injection could not obtain a real HTTPS response."); }
      expect(response.status()).toBe(200);
      committedId = (await response.json()).data.receiptId;
      if (operation === "Post") recordPost(committedId, "1.0000", "20.0000");
      await route.abort("failed");
    });
    await panel.getByRole("button", { name: operation === "Post" ? "Post phiếu nhập" : "Lưu phiếu nhập", exact: true }).click();
    await expectUnknown(panel);
    await page.getByRole("button", { name: "Đóng tất cả", exact: true }).click();
    await expectUnknown(panel);
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
    const authoritative = await api(page, `${root}/${committedId}`);
    expect(authoritative.status).toBe(200);
    expect(authoritative.json.data.status).toBe(operation === "Post" ? "Posted" : "Draft");
    if (operation === "Create") {
      await panel.getByRole("button", { name: "Tìm ứng viên qua list", exact: true }).click();
      await panel.getByRole("button", { name: `Đối chiếu ${committedId}`, exact: true }).click();
    } else await panel.getByRole("button", { name: "Đọc lại để đối soát", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Xác nhận dùng bản authoritative", exact: true })).toBeEnabled();
    expect(sends).toBe(1);
  });
}

test("Receipt Write/Post without Read keeps real Post acknowledgement after Get403", async ({ page }, info) => {
  await login(page, "receiptPoster");
  expect((await api(page, `${root}?pageNumber=1&pageSize=25`)).status).toBe(403);
  await expect(page.getByRole("button", { name: "Danh sách phiếu nhập", exact: true })).toBeDisabled();
  const panel = await newReceipt(page);
  await decimal(panel, "unitCost", "20.0000");
  const saveResponse = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === root);
  await panel.getByRole("button", { name: "Lưu phiếu nhập", exact: true }).click();
  const saved = await saveResponse;
  expect(saved.status()).toBe(200);
  const receipt: Receipt = (await saved.json()).data;
  const active = page.getByRole("region", { name: `Phiếu nhập ${receipt.receiptId}`, exact: true });
  const ackResponse = page.waitForResponse(r => new URL(r.url()).pathname === `${root}/${receipt.receiptId}/post`);
  const deniedResponse = page.waitForResponse(r => r.request().method() === "GET" && new URL(r.url()).pathname === `${root}/${receipt.receiptId}`);
  await active.getByRole("button", { name: "Post phiếu nhập", exact: true }).click();
  const ack = await ackResponse;
  expect(ack.status()).toBe(200);
  expect((await ack.json()).data).not.toHaveProperty("version");
  recordPost(receipt.receiptId, "1.0000", "20.0000", "receiptPoster");
  expect((await deniedResponse).status()).toBe(403);
  await expect(active).toContainText("Posted");
  await expect(active.getByLabel("Ghi chú", { exact: true })).toBeDisabled();
  await expect(active.getByRole("button", { name: "Post phiếu nhập", exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath("receipt-post-ack-get403.png") });
});

test("Receipt Read does not grant Write or Post on the real server", async ({ page }) => {
  await login(page);
  const receipt = await create(page);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await login(page, "receiptReader");
  await expect(page.getByRole("button", { name: "Phiếu nhập mới", exact: true })).toBeDisabled();
  const panel = await open(page, receipt);
  await expect(panel.getByLabel("Ghi chú", { exact: true })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "Lưu phiếu nhập", exact: true })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "Post phiếu nhập", exact: true })).toBeDisabled();
  expect((await api(page, root, "POST", draftBody())).status).toBe(403);
  expect((await api(page, `${root}/${receipt.receiptId}/draft`, "PUT", { ...draftBody(), expectedVersion: receipt.version })).status).toBe(403);
  expect((await api(page, `${root}/${receipt.receiptId}/post`, "POST", { expectedVersion: receipt.version })).status).toBe(403);
});
