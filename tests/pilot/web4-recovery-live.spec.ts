import { test, expect, type Locator, type Page } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { api, checkOperation, login, manifest, openDraft, readStore, recordCheck, recordOperation, recordPost, write, type Actor, type DraftRecord, type DurableOperationRecord, type Web4WireIntent } from "./web4-helpers";

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

async function loseAndRecover(page: Page, actor: Actor, feature: Feature, panel: Locator, path: string, method: string, reload: boolean, post = false) {
  const id = (await panel.getAttribute("data-session-id"))!;
  let committed: { wire: any; operation: DurableOperationRecord } | undefined;
  let dispatches = 0;
  const intercept = async (route: import("@playwright/test").Route) => {
    if (route.request().method() !== method) return route.continue();
    dispatches++;
    const key = route.request().headers()["idempotency-key"];
    const operation = (await readStore<DurableOperationRecord>(page, "operations")).find(value => value.operationId === key)!;
    expect(operation?.state).toBe("DISPATCHED");
    expect(operation.frozen.request.body).toEqual(route.request().postDataJSON());
    expect(route.request().headers()["x-mydmsvn-deployment-epoch"]).toBe(operation.deploymentEpoch);
    // Only the real host's already-committed 200 is discarded. There is no
    // fabricated success and no process-crash/Commit claim from this boundary.
    let response;
    try { response = await route.fetch({ maxRetries: 0 }); } catch { throw Error("Owned HTTPS mutation transport failed before response."); }
    expect(response.status()).toBe(200);
    committed = { wire: await response.json(), operation };
    await response.dispose(); await route.abort("failed");
  };
  await page.route(`**${path}`, intercept);
  await panel.getByRole("button", { name: buttonName(feature, post), exact: true }).click();
  await expect(panel).toContainText("Kết quả chưa rõ");
  await expect(panel.getByRole("button", { name: buttonName(feature), exact: true })).toBeDisabled();
  expect(committed).toBeDefined(); expect(dispatches).toBe(1);
  const proof = committed!;
  recordOperation(actor, proof.operation, proof.wire.data.saleId ?? proof.wire.data.receiptId);
  let statusReads = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === `/api/v1/operations/${proof.operation.operationId}`) statusReads++; });
  if (reload) {
    await page.reload(); await expect(page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true })).toBeVisible();
    panel = await openDraft(page, id);
  }
  expect(statusReads).toBe(0); expect(dispatches).toBe(1);
  const dialog = await checkOperation(page, proof.operation.operationId);
  await expect.poll(async () => (await readStore<DurableOperationRecord>(page, "operations")).find(value => value.operationId === proof.operation.operationId)?.state).toBe("SETTLED");
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  expect(statusReads).toBe(1); expect(dispatches).toBe(1);
  await page.unroute(`**${path}`, intercept);
  return { panel, ...proof, id };
}

for (const feature of ["goods-receipt", "sales"] as const) {
  test(`${feature}: real Create, Update and Post lost acknowledgements recover after reload without Read`, async ({ page }, info) => {
    test.setTimeout(90_000);
    const actor = feature === "sales" ? "poster" : "receiptPoster";
    const root = feature === "sales" ? saleRoot : receiptRoot;
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await login(page, actor);
    let panel = await newDocument(page, feature);
    const id = (await panel.getAttribute("data-session-id"))!;
    await expect.poll(async () => (await readStore<DraftRecord>(page, "drafts")).find(value => value.localDocumentId === id)?.snapshot.draft.lines.length).toBe(1);
    const clientIds = (await readStore<DraftRecord>(page, "drafts")).find(value => value.localDocumentId === id)!.snapshot.draft.lines.map(line => line.clientLineId);
    const created = await loseAndRecover(page, actor, feature, panel, root, "POST", true);
    panel = created.panel;
    const serverId = created.wire.data.saleId ?? created.wire.data.receiptId;
    expect((await api(page, `${root}/${serverId}`)).status).toBe(403);
    let draft = (await readStore<DraftRecord>(page, "drafts")).find(value => value.localDocumentId === id)!;
    expect(draft.snapshot.baseline?.version).toBe(created.wire.data.version);
    expect(draft.snapshot.draft.lines.map(line => line.clientLineId)).toEqual(clientIds);
    await panel.getByLabel("Ghi chú", { exact: true }).pressSequentially("Cập nhật giữ dòng ệ");
    await decimal(panel, feature === "sales" ? "qty" : "quantity", "2.0000");
    const updated = await loseAndRecover(page, actor, feature, panel, `${root}/${serverId}/draft`, "PUT", true);
    panel = updated.panel;
    draft = (await readStore<DraftRecord>(page, "drafts")).find(value => value.localDocumentId === id)!;
    expect(updated.wire.data.version).not.toBe(created.wire.data.version);
    expect(draft.snapshot.baseline?.version).toBe(updated.wire.data.version);
    expect(draft.snapshot.draft.lines.map(line => line.clientLineId)).toEqual(clientIds);
    const serverIds = draft.snapshot.draft.lines.map(line => "saleLineId" in line ? line.saleLineId : line.receiptLineId);
    expect(serverIds).toEqual(updated.wire.data.lines.map((line: any) => line.saleLineId ?? line.receiptLineId));
    const posted = await loseAndRecover(page, actor, feature, panel, `${root}/${serverId}/post`, "POST", true, true);
    await expect(posted.panel).toContainText("Posted");
    await expect(posted.panel.getByRole("button", { name: buttonName(feature, true), exact: true })).toBeDisabled();
    draft = (await readStore<DraftRecord>(page, "drafts")).find(value => value.localDocumentId === id)!;
    if (feature === "sales") {
      expect(draft.snapshot.postAcknowledgement).toHaveProperty("version", posted.wire.data.version);
      recordPost({ saleId: serverId, quantity: "2.0000", cost: "30.0000", actor });
    } else {
      expect(posted.wire.data).not.toHaveProperty("version"); expect(draft.snapshot.postAcknowledgement).not.toHaveProperty("version");
      recordPost({ documentType: "GoodsReceipt", receiptId: serverId, quantity: "2.0000", value: "40.0000", actor });
    }
    expect((await readStore<DurableOperationRecord>(page, "operations")).filter(value => value.state === "DISPATCHED")).toHaveLength(0);
    expect(errors).toEqual([]);
    await page.screenshot({ path: join(tmpdir(), `web4-live-${feature}-${info.project.name}.png`) });
    recordCheck(`six-command-recovery-${feature === "sales" ? "sales" : "receipt"}`);
  });
}

test("real recovered Posts refetch Inventory, preserve dirty Sales, and freeze moving-average COGS across warehouses", async ({ page }, info) => {
  test.setTimeout(120_000);
  await login(page);
  await page.getByRole("button", { name: "Sales mới", exact: true }).click();
  const dirty = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  const dirtyId = (await dirty.getAttribute("data-session-id"))!;
  const raw = "Ngày đang nhập ệ  ";
  const date = dirty.getByLabel("Ngày chứng từ", { exact: true }); await date.fill(""); await date.pressSequentially(raw);
  await dirty.getByLabel("Ghi chú", { exact: true }).pressSequentially("Bản Sales riêng không bị Post ghi đè");
  const reads = { balance: 0, card: 0 };
  page.on("request", request => { const path = new URL(request.url()).pathname; if (path === "/api/v1/inventory/balances") reads.balance++; if (path === "/api/v1/inventory/stock-card") reads.card++; });
  async function inventory(card: boolean) {
    const name = card ? "Thẻ kho" : "Tồn kho"; await page.getByRole("button", { name, exact: true }).click();
    return page.locator(`section[aria-label="${name}"]`);
  }
  for (const card of [false, true]) {
    const panel = await inventory(card); await select(page, panel, "Lọc kho", "WEB3-IW"); await select(page, panel, "Lọc sản phẩm", "WEB3-IP");
    await expect(panel.getByRole("status")).toHaveText("Không có dữ liệu.");
    await page.getByRole("button", { name: "Tách sang phải", exact: true }).click();
  }
  await page.getByRole("tab").filter({ hasText: "Sales mới" }).click();
  const catalog = manifest.integratedCatalog;
  async function openServer(feature: Feature, detail: any) {
    // Keep both stock panels observed in their own groups while document tabs
    // open in the dirty Sales group, including after a projection activates Card.
    await page.getByRole("tab").filter({ hasText: "Sales mới" }).click();
    const sales = feature === "sales";
    const listName = sales ? "Danh sách Sales" : "Danh sách phiếu nhập";
    await page.getByRole("button", { name: listName, exact: true }).click();
    await page.getByRole("region", { name: listName, exact: true }).getByLabel(sales ? "Tìm chứng từ" : "Tìm phiếu nhập", { exact: true }).fill(detail.saleNumber ?? detail.receiptNumber);
    await page.getByTestId(sales ? "sales-list-grid" : "goods-receipt-list-grid").locator(`[col-id="${sales ? "saleId" : "receiptId"}"]`).filter({ hasText: new RegExp(`^${detail.saleId ?? detail.receiptId}$`) }).dblclick();
    const panel = page.locator(`section[aria-label="${sales ? "Chứng từ" : "Phiếu nhập"} ${detail.saleId ?? detail.receiptId}"]`);
    await expect(panel.getByLabel("Ghi chú", { exact: true })).toBeVisible();
    return panel;
  }
  async function receipt(quantity: string, unitCost: string, value: string, warehouseId = catalog.warehouseId, receiptDate = "2024-03-01") {
    const intent: Web4WireIntent = { operationKind: "Receipt.Create", method: "POST", routeScope: receiptRoot, requestTargetId: null,
      body: { receiptDate, warehouseId, employeeId: catalog.employeeId, note: "WEB4 physical valuation", lines: [{ productId: catalog.productId, quantity, unitCost }] } };
    const created = await write(page, "integratedEditor", intent); expect(created.status).toBe(200);
    const detail = created.json.data, panel = await openServer("goods-receipt", detail);
    await loseAndRecover(page, "integratedEditor", "goods-receipt", panel, `${receiptRoot}/${detail.receiptId}/post`, "POST", false, true);
    recordPost({ documentType: "GoodsReceipt", receiptId: detail.receiptId, quantity, value, actor: "integratedEditor", scenario: "integrated" });
    return detail;
  }
  async function projection(quantity: string, value: string, count: number, before: typeof reads) {
    await expect.poll(() => reads.balance).toBeGreaterThan(before.balance); await expect.poll(() => reads.card).toBeGreaterThan(before.card);
    const balances = await inventory(false);
    await balances.locator(".ag-body-horizontal-scroll-viewport").evaluate(node => { node.scrollLeft = node.scrollWidth; });
    await expect(balances.locator('.ag-row [col-id="quantity"]')).toHaveText(quantity);
    await expect(balances.locator('.ag-row [col-id="inventoryValue"]')).toHaveText(value);
    const card = await inventory(true); await expect(card.locator(".ag-row")).toHaveCount(count);
  }
  let before = { ...reads }; await receipt("10.0000", "10.0000", "100.0000"); await projection("10.0000", "100.0000", 1, before);
  before = { ...reads }; await receipt("10.0000", "20.0000", "200.0000"); await projection("20.0000", "300.0000", 2, before);
  const sale = await write(page, "integratedEditor", { operationKind: "Sales.Create", method: "POST", routeScope: saleRoot, requestTargetId: null,
    body: { saleDate: "2024-03-02", warehouseId: catalog.warehouseId, employeeId: catalog.employeeId, customerId: catalog.customerId, note: "WEB4 frozen cost",
      lines: [{ saleLineId: "0", productId: catalog.productId, qty: "4.0000", unitPrice: "25.0000", isGift: false }] } });
  expect(sale.status).toBe(200); const saleId = sale.json.data.saleId;
  before = { ...reads };
  await loseAndRecover(page, "integratedEditor", "sales", await openServer("sales", sale.json.data), `${saleRoot}/${saleId}/post`, "POST", false, true);
  recordPost({ documentType: "SalesReceipt", saleId, quantity: "4.0000", cost: "60.0000", actor: "integratedEditor", scenario: "integrated" });
  await projection("16.0000", "240.0000", 3, before);
  before = { ...reads }; await receipt("4.0000", "30.0000", "120.0000", catalog.warehouseId, "2024-02-01"); await projection("20.0000", "360.0000", 4, before);
  await receipt("3.0000", "40.0000", "120.0000", catalog.otherWarehouseId);
  const history = await api(page, `${saleRoot}/${saleId}`);
  expect(history.json.data).toMatchObject({ status: "Posted", totalCost: "60.0000", lines: [{ postedUnitCost: "15.00000000", costAmount: "60.0000" }] });
  // Deliberate concurrent test clients, never product retry: one immutable key
  // must serialize to one source, including duplicate product and gift lines.
  const depletion: Web4WireIntent = { operationKind: "Sales.Create", method: "POST", routeScope: saleRoot, requestTargetId: null,
    body: { saleDate: "2024-03-03", warehouseId: catalog.warehouseId, employeeId: catalog.employeeId, customerId: catalog.customerId, note: "WEB4 duplicate gift full depletion",
      lines: [{ saleLineId: "0", productId: catalog.productId, qty: "7.0000", unitPrice: "25.0000", isGift: false },
        { saleLineId: "0", productId: catalog.productId, qty: "13.0000", unitPrice: "25.0000", isGift: true }] } };
  const sameKey = randomUUID();
  const pair = await Promise.all([write(page, "integratedEditor", depletion, sameKey), write(page, "integratedEditor", depletion, sameKey)]);
  expect(pair.map(reply => reply.status)).toEqual([200, 200]); expect(pair[0].json).toEqual(pair[1].json);
  const conflict = await write(page, "integratedEditor", { ...depletion, body: { ...depletion.body, note: "Different immutable intent" } }, sameKey);
  expect(conflict.status).toBe(409); expect(conflict.json.error.code).toBe("Idempotency.KeyConflict");
  recordCheck("same-key-concurrency");
  const depletedId = pair[0].json.data.saleId;
  before = { ...reads };
  await loseAndRecover(page, "integratedEditor", "sales", await openServer("sales", pair[0].json.data), `${saleRoot}/${depletedId}/post`, "POST", false, true);
  recordPost({ documentType: "SalesReceipt", saleId: depletedId, quantity: "20.0000", cost: "360.0000", actor: "integratedEditor", scenario: "integrated" });
  await projection("0.0000", "0.0000", 6, before);
  const depleted = await api(page, `${saleRoot}/${depletedId}`);
  expect(depleted.json.data).toMatchObject({ status: "Posted", totalCost: "360.0000", lines: [{ qty: "7.0000", costAmount: "126.0000" }, { qty: "13.0000", isGift: true, costAmount: "234.0000" }] });
  expect((await api(page, `${saleRoot}/${saleId}`)).json.data.totalCost).toBe("60.0000");
  const own = await api(page, `/api/v1/inventory/balances?warehouseId=${catalog.otherWarehouseId}&productId=${catalog.productId}&pageNumber=1&pageSize=25`);
  expect(own.status).toBe(200);
  expect(JSON.stringify(own.json)).toContain('"inventoryValue":"120.0000"');
  const draft = (await readStore<DraftRecord>(page, "drafts")).find(value => value.localDocumentId === dirtyId)!;
  expect(draft.snapshot.rawBuffers.saleDate.raw).toBe(raw); expect(draft.snapshot.dirty).toBe(true);
  expect((await readStore<DurableOperationRecord>(page, "operations")).filter(value => value.state === "DISPATCHED")).toHaveLength(0);
  await page.screenshot({ path: join(tmpdir(), `web4-live-valuation-${info.project.name}.png`) });
  recordCheck("valuation-and-inventory");
});
