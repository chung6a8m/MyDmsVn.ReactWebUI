import { test, expect, type Locator, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { api, login, manifest, openDraft, readStore, recordCheck, recordOperation, recordPost, write, type Actor, type DraftRecord, type DurableOperationRecord, type Web4WireIntent } from "./web4-helpers";

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
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
  await expect(dialog).toContainText(proof.operation.operationId);
  const resolution = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v2/operations/${proof.operation.operationId}/resolution` && response.request().method() === "GET");
  await dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true }).click();
  expect((await resolution).status()).toBe(200);
  await expect.poll(async () => (await readStore<DurableOperationRecord>(page, "operations")).find(value => value.operationId === proof.operation.operationId)?.state).toBe("SETTLED");
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  expect(statusReads).toBe(0); expect(dispatches).toBe(1);
  await page.unroute(`**${path}`, intercept);
  return { panel, ...proof, id };
}

for (const feature of ["goods-receipt", "sales"] as const) {
  test(`${feature}: real Create, Update and Post lost acknowledgements recover through v2 resolution after reload without Read`, async ({ page }) => {
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
    recordCheck(`web5-v2-committed-${feature === "sales" ? "sales" : "receipt"}`);
  });
}
