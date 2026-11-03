import { test, expect, type Locator, type Page } from "@playwright/test";
import { randomInt } from "node:crypto";
import { connect } from "node:net";
import { login, manifest, readStore, recordCheck, recordOperation, type DraftRecord, type DurableOperationRecord } from "./web4-helpers";

const receiptRoot = "/api/v1/goods-receipts", saleRoot = "/api/v1/sales-receipts";
type Feature = "sales" | "goods-receipt";
const buttonName = (feature: Feature, post = false) => feature === "sales" ? post ? "Post chứng từ" : "Lưu chứng từ" : post ? "Post phiếu nhập" : "Lưu phiếu nhập";
test.beforeEach(({ page }) => { page.on("dialog", dialog => void dialog.accept()); });
async function select(page: Page, panel: Locator, label: string, code: string) {
  const input = panel.getByRole("combobox", { name: label, exact: true });
  await input.fill(""); await input.pressSequentially(code);
  await page.getByRole("listbox").getByRole("option").filter({ hasText: new RegExp(`^${code} ·`) }).click();
  await input.press("Tab");
}
async function decimal(panel: Locator, column: string, text: string) {
  await panel.locator(`.ag-row[row-index="0"] [col-id="${column}"]`).dblclick();
  const input = panel.getByLabel(column === "unitCost" ? "Đơn giá nhập dòng 1" : column === "unitPrice" ? "Đơn giá dòng 1" : "Số lượng dòng 1", { exact: true });
  await input.press("ControlOrMeta+A"); await input.pressSequentially(text); await input.press("Enter");
}
async function newDocument(page: Page, feature: Feature) {
  await page.getByRole("button", { name: feature === "sales" ? "Sales mới" : "Phiếu nhập mới", exact: true }).click();
  const panel = page.getByRole("region", { name: feature === "sales" ? "Chứng từ mới" : "Phiếu nhập mới", exact: true });
  await panel.getByLabel(feature === "sales" ? "Ngày chứng từ" : "Ngày nhập", { exact: true }).fill("2024-02-29");
  if (feature === "sales") await select(page, panel, "Khách hàng", "PILOT-C");
  await select(page, panel, "Kho", "PILOT-W"); await select(page, panel, "Nhân viên", "PILOT-E");
  await panel.locator('.ag-row[row-index="0"] [col-id="product"]').dblclick();
  const product = panel.getByRole("combobox", { name: "Sản phẩm grid", exact: true });
  await product.pressSequentially(feature === "sales" ? "PILOT-P" : "WEB3-RP");
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1);
  await product.press("ArrowDown"); await product.press("Enter");
  await decimal(panel, feature === "sales" ? "qty" : "quantity", "1.0000");
  await decimal(panel, feature === "sales" ? "unitPrice" : "unitCost", feature === "sales" ? "25.0000" : "20.0000");
  return panel;
}

// Only the owned test process talks to this control; no fixture token reaches the page.
async function negativeControl(action: "resolveNegative" | "verifyNegative", operation: DurableOperationRecord) {
  const id = randomInt(1, 2147483647);
  const frame = action === "resolveNegative" ? { id, token: manifest.recovery.controlToken, action, operation: operation.frozen }
    : { id, token: manifest.recovery.controlToken, action, operationId: operation.operationId };
  const bytes = Buffer.from(JSON.stringify(frame), "utf8"), prefix = Buffer.alloc(4); prefix.writeInt32LE(bytes.length);
  await new Promise<void>((resolve, reject) => {
    const socket = connect(manifest.recovery.controlPipe); let response = Buffer.alloc(0), done = false;
    const fail = () => { if (!done) { done = true; reject(Error("Owned negative control failed")); } socket.destroy(); };
    socket.setTimeout(10000, fail); socket.on("error", fail); socket.on("end", () => { if (!done) fail(); });
    socket.on("connect", () => socket.write(Buffer.concat([prefix, bytes])));
    socket.on("data", part => {
      response = Buffer.concat([response, part]); if (response.length < 4) return;
      const length = response.readInt32LE(0); if (length < 2 || length > 4096) return fail(); if (response.length < length + 4) return;
      try { const reply = JSON.parse(response.subarray(4, length + 4).toString("utf8"));
        if (reply.id !== id || reply.ok !== true) return fail(); done = true; resolve(); socket.end(); } catch { fail(); }
    });
  });
}

test("six negative commands fence late originals in one authenticated session", async ({ page: initialPage, context }) => {
  test.setTimeout(240_000);
  await login(initialPage, "integratedEditor");
  let first = true;
  for (const scenario of [
  { feature: "sales", command: "create" }, { feature: "sales", command: "update" }, { feature: "sales", command: "post" },
  { feature: "goods-receipt", command: "create" }, { feature: "goods-receipt", command: "update" }, { feature: "goods-receipt", command: "post" },
] as const) {
    const page = first ? initialPage : await context.newPage();
    if (!first) {
      page.on("dialog", dialog => void dialog.accept());
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true })).toBeEnabled();
    }
    first = false;
    const newPanel = await newDocument(page, scenario.feature);
    const sessionId = (await newPanel.getAttribute("data-session-id"))!;
    // The accessible region name changes from “new” to the server ID after Create.
    const panel = page.locator(`section[data-session-id="${sessionId}"]`);
    const root = scenario.feature === "sales" ? saleRoot : receiptRoot;
    let target: string | undefined;
    if (scenario.command !== "create") {
      const responsePromise = page.waitForResponse(r => new URL(r.url()).pathname === root && r.request().method() === "POST");
      await panel.getByRole("button", { name: buttonName(scenario.feature), exact: true }).click();
      const response = await responsePromise; expect(response.status()).toBe(200);
      const data = (await response.json()).data;
      target = data.saleId ?? data.receiptId;
      const key = response.request().headers()["idempotency-key"];
      const initial = (await readStore<DurableOperationRecord>(page, "operations")).find(value => value.operationId === key)!;
      expect(initial).toBeDefined(); recordOperation("integratedEditor", initial, target!);
      await expect(panel.getByRole("button", { name: buttonName(scenario.feature, true), exact: true })).toBeEnabled();
      if (scenario.command === "update") await panel.getByLabel("Ghi chú", { exact: true }).pressSequentially("Negative update review");
    }
    const path = scenario.command === "create" ? root : `${root}/${target}/${scenario.command === "update" ? "draft" : "post"}`;
    const method = scenario.command === "update" ? "PUT" : "POST";
    let captured: { url: string; method: string; body: string; headers: Record<string, string> } | undefined;
    let writes = 0;
    await page.route(`**${path}`, async route => {
      const request = route.request(); if (request.method() !== method) return route.continue();
      writes++; const h = request.headers();
      captured = { url: request.url(), method, body: request.postData()!, headers: { authorization: h.authorization,
        "content-type": h["content-type"], "idempotency-key": h["idempotency-key"], "x-mydmsvn-deployment-epoch": h["x-mydmsvn-deployment-epoch"] } };
      await route.abort("failed");
    });
    await panel.getByRole("button", { name: buttonName(scenario.feature, scenario.command === "post"), exact: true }).click();
    await expect(panel).toContainText("Kết quả chưa rõ");
    const operation = (await readStore<DurableOperationRecord>(page, "operations")).find(value => value.operationId === captured?.headers["idempotency-key"])!;
    expect(operation?.state).toBe("DISPATCHED"); expect(writes).toBe(1);
    expect(JSON.parse(captured!.body)).toEqual(operation.frozen.request.body);
    expect(captured!.headers["x-mydmsvn-deployment-epoch"]).toBe(operation.deploymentEpoch);
    const before = (await readStore<DraftRecord>(page, "drafts")).find(value => value.localDocumentId === sessionId)!;
    await negativeControl("resolveNegative", operation);
    await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
    await dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true }).click();
    await expect.poll(async () => (await readStore<DurableOperationRecord>(page, "operations")).find(value => value.operationId === operation.operationId)?.state).toBe("NOT_EXECUTED");
    const after = (await readStore<DraftRecord>(page, "drafts")).find(value => value.localDocumentId === sessionId)!;
    expect(after.snapshot).toEqual(before.snapshot); expect(after.unresolvedOperation).toBe(false); expect(writes).toBe(1);
    await page.unroute(`**${path}`);
    const late = await page.evaluate(async request => {
      const response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body, credentials: "omit" });
      const json = await response.json(); return { status: response.status, code: json.error?.code };
    }, captured!);
    expect(late).toEqual({ status: 503, code: "Operation.ResultUnavailable" });
    await negativeControl("verifyNegative", operation);
    recordCheck(`web5-negative-late-${scenario.feature === "sales" ? "sales" : "receipt"}-${scenario.command}`);
    await page.close();
  }
});
