import { expect, test, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { productionHttp } from "./helpers/durableDraftWorkspaceHttp";
import type * as Drafts from "./helpers/durableDraftWorkspaceHarness";
import type * as Recovery from "./helpers/web4RecoveryHarness";

const fixture = (folder: string, name: string) => JSON.parse(readFileSync(new URL(`../fixtures/${folder}/${name}.json`, import.meta.url), "utf8"));
const canonical = (name: string) => fixture("web4-v1/corpus", name);
const epoch = canonical("context-response").data.deploymentEpoch as string;
const replacementEpoch = "7c3baa58-9721-47ee-a1ac-88fc37c06e51";
const draftsPath = "/tests/e2e/helpers/durableDraftWorkspaceHarness.ts";
const recoveryPath = "/tests/e2e/helpers/web4RecoveryHarness.ts";
const records = (page: Page) => page.evaluate(async path => {
  const h: typeof Drafts = await import(/* @vite-ignore */ path); return h.allRecords();
}, draftsPath);
const operations = (page: Page) => page.evaluate(async path => {
  const h: typeof Recovery = await import(/* @vite-ignore */ path); return h.operations();
}, recoveryPath);
const respond = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json",
  headers: { "Cache-Control": "no-store", Pragma: "no-cache", Expires: "0" }, body: JSON.stringify(body) });
const lostResponse = (route: Route) => respond(route, { error: { code: "InternalError", message: "Controlled lost acknowledgement", details: [] } }, 500);
async function seedIntent(page: Page, stem: string, note?: string) {
  await page.evaluate(async input => {
    const h: typeof Recovery = await import(/* @vite-ignore */ input.recoveryPath);
    const d: typeof Drafts = await import(/* @vite-ignore */ input.draftsPath);
    const record = await h.seedIntent(input.stem, input.intent, input.baseline);
    if (input.note !== undefined) {
      record.snapshot.rawBuffers.note = { raw: input.note, composing: false };
      await d.seed(record);
    }
  }, { stem, note, recoveryPath, draftsPath, intent: canonical(`${stem}-intent`),
    baseline: canonical(`${stem.endsWith("post") ? stem.replace("post", "update") : stem}-response`).data });
}
async function restore(page: Page, feature: "sales" | "goods-receipt", id: string) {
  await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
  await dialog.locator("li").filter({ hasText: feature === "sales" ? "Sales ·" : "Phiếu nhập ·" })
    .getByRole("button", { name: "Mở bản nháp", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const panel = page.locator(`section[data-session-id="${id}"]`);
  await expect(panel).toBeVisible();
  return panel;
}
function healthy(server: Awaited<ReturnType<typeof productionHttp>>) {
  expect(server.unexpected).toEqual([]);
  expect(server.businessWrites).toEqual([]);
  expect(server.errors.filter(message => !message.startsWith("Failed to load resource:"))).toEqual([]);
}

// Removing the atomic cross-tab claim must produce two HTTP writes here, even
// though each workspace's own pending-command guard still works independently.
test("two live workspaces racing Save share one durable intent and retain the losing tab input", async ({ page, context }) => {
  const second = await context.newPage();
  const firstServer = await productionHttp(page), secondServer = await productionHttp(second);
  const pages = [page, second], writes: { tab: number; key: string; body: unknown }[] = [];
  for (const [tab, target] of pages.entries()) await target.route("**/api/v1/sales-receipts", async route => {
    if (route.request().method() === "GET") return route.fallback();
    writes.push({ tab, key: route.request().headers()["idempotency-key"], body: route.request().postDataJSON() });
    return lostResponse(route);
  });
  const note = "Nội dung hai tab cùng giữ ệ  ";
  await seedIntent(page, "sales-create", note);
  const panels = [await restore(page, "sales", "sales-create"), await restore(second, "sales", "sales-create")];
  for (const panel of panels) await expect(panel.getByLabel("Ghi chú", { exact: true })).toHaveValue(note);
  await Promise.all(panels.map(panel => panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click()));
  await expect.poll(() => writes.length).toBe(1);
  const winner = pages[writes[0].tab], loser = pages[1 - writes[0].tab], losingPanel = panels[1 - writes[0].tab];
  await expect(winner.getByRole("button", { name: "Đối soát thao tác", exact: true })).toBeVisible();
  await expect(losingPanel).toContainText("Chưa lưu được thao tác trên thiết bị; chưa gửi chứng từ");
  await expect(losingPanel.getByLabel("Ghi chú", { exact: true })).toHaveValue(note);
  await loser.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
  const dialog = loser.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
  await expect(dialog.getByRole("alert").filter({ hasText: "Giữ nguyên trang" })).toBeVisible();
  await loser.keyboard.press("Escape");
  await losingPanel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  await expect(losingPanel).toContainText("Chưa lưu được thao tác trên thiết bị; chưa gửi chứng từ");
  const saved = await operations(page);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ operationId: writes[0].key, state: "DISPATCHED", localDocumentId: "sales-create" });
  expect(saved[0].frozen.request.body).toEqual(writes[0].body);
  expect(writes[0].body).toMatchObject({ note });
  expect((await records(page)).find(record => record.localDocumentId === "sales-create")).toMatchObject({
    unresolvedOperation: true, operationId: writes[0].key, snapshot: { rawBuffers: { note: { raw: note, composing: false } } },
  });
  expect(writes).toHaveLength(1);
  healthy(firstServer); healthy(secondServer);
  await second.close();
});

// The same numeric user and same server ID in a replacement DB must not cause
// any document GET from the former v3 layout or actor-only legacy descriptors.
test("replacement epoch ignores old v3 and actor-only layouts without opening their document IDs", async ({ page }) => {
  const server = await productionHttp(page), detailReads: string[] = [];
  await page.route("**/api/v1/sales-receipts/*", async route => {
    if (route.request().method() === "GET") detailReads.push(new URL(route.request().url()).pathname);
    return route.fallback();
  });
  await page.getByTestId("sales-list-grid").locator('.ag-row [col-id="saleId"]').dblclick();
  await expect(page.getByRole("region", { name: "Chứng từ 9223372036854775807", exact: true })).toBeVisible();
  const oldKey = `mydmsvn.workspace.layout.v3:${epoch}:42`, currentKey = `mydmsvn.workspace.layout.v3:${replacementEpoch}:42`;
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), oldKey)).toContain('"serverId":"9223372036854775807"');
  const oldLayout = (await page.evaluate(key => localStorage.getItem(key), oldKey))!;
  const legacy = await page.evaluate(raw => {
    const v3 = JSON.parse(raw), v2 = { ...v3, schemaVersion: 2, scope: { actorKey: "42" } };
    const v1 = structuredClone(v2); v1.schemaVersion = 1; v1.registryVersion = 1;
    for (const panel of Object.values(v1.layout.panels) as { params?: { kind?: string; serverId?: string; saleId?: string } }[]) {
      if (panel.params?.kind === "document") panel.params = { saleId: panel.params.serverId };
      else delete panel.params;
    }
    const values = { v1: JSON.stringify(v1), v2: JSON.stringify(v2) };
    localStorage.setItem("mydmsvn.workspace.layout.v1:42", values.v1);
    localStorage.setItem("mydmsvn.workspace.layout.v2:42", values.v2);
    return values;
  }, oldLayout);
  await page.evaluate(async path => {
    const h: typeof Drafts = await import(/* @vite-ignore */ path);
    await h.seed(h.localRecord("sales", "old-epoch-private"));
  }, draftsPath);
  server.owner.deploymentEpoch = replacementEpoch;
  detailReads.length = 0;
  await page.reload();
  await expect(page.getByRole("button", { name: "Sales mới", exact: true })).toBeEnabled();
  await expect(page.getByText(/Dùng bố cục mặc định cho cơ sở dữ liệu và tài khoản hiện tại/)).toBeVisible();
  await expect(page.getByTestId("sales-list-grid").locator('.ag-row [col-id="saleId"]')).toHaveText("9223372036854775807");
  await page.getByRole("button", { name: "Khôi phục bố cục", exact: true }).click();
  await expect(page.locator("section[data-session-id]")).toHaveCount(0);
  await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
  await expect(dialog.getByText("Đang đọc bản nháp…", { exact: true })).toHaveCount(0);
  await expect(dialog.locator("li")).toHaveCount(0);
  expect(detailReads).toEqual([]);
  expect(await page.evaluate(({ oldKey, currentKey }) => ({ old: localStorage.getItem(oldKey), current: localStorage.getItem(currentKey),
    v1: localStorage.getItem("mydmsvn.workspace.layout.v1:42"), v2: localStorage.getItem("mydmsvn.workspace.layout.v2:42") }), { oldKey, currentKey }))
    .toMatchObject({ old: oldLayout, v1: legacy.v1, v2: legacy.v2 });
  expect((await records(page)).some(record => record.localDocumentId === "old-epoch-private")).toBe(true);
  healthy(server);
});

// A shape-valid COMMITTED status with a foreign fingerprint or epoch must not
// publish Posted, invalidate stock, or replace another document's dirty raw text.
test("only matching recovered Receipt Post proof refreshes inventory while dirty Sales stays intact", async ({ page }) => {
  const server = await productionHttp(page), intent = canonical("receipt-post-intent");
  const reads: string[] = [], writes: string[] = [], statusReads: string[] = [];
  let proof: "fingerprint" | "epoch" | "valid" = "fingerprint";
  await page.route("**/api/v1/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (path === "/api/v1/catalog/warehouses/lookup" || path === "/api/v1/catalog/products/lookup") {
      const warehouse = path.includes("/warehouses/");
      return respond(route, { data: [{ id: warehouse ? 1 : 7, code: warehouse ? "WH01" : "P7", name: warehouse ? "Kho chính" : "Sản phẩm", isActive: true }] });
    }
    if (path.startsWith("/api/v1/inventory/")) {
      reads.push(path);
      if (path.endsWith("/stock-card")) {
        expect(url.searchParams.get("warehouseId")).toBe("1");
        expect(url.searchParams.get("productId")).toBe("7");
      }
      const value = fixture("web3-v1", path.endsWith("/balances") ? "balances-response" : "stock-card-response");
      value.data.pageNumber = Number(url.searchParams.get("pageNumber")); value.data.pageSize = Number(url.searchParams.get("pageSize"));
      return respond(route, value);
    }
    if (path === `/api/v1/goods-receipts/${intent.requestTargetId}/post`) {
      writes.push(request.headers()["idempotency-key"]); return lostResponse(route);
    }
    if (/^\/api\/v1\/operations\/[0-9a-f-]{36}$/.test(path)) {
      statusReads.push(path);
      const suppliedProof = proof;
      const operation = (await operations(page))[0];
      expect(request.headers()["x-mydmsvn-operation-fingerprint"]).toBe(operation.frozen.requestFingerprint);
      expect(request.headers()["x-mydmsvn-deployment-epoch"]).toBe(epoch);
      return respond(route, { data: { operationId: operation.operationId, deploymentEpoch: suppliedProof === "epoch" ? replacementEpoch : epoch,
        requestFingerprint: suppliedProof === "fingerprint" ? "0".repeat(64) : operation.frozen.requestFingerprint,
        operationKind: intent.operationKind, method: intent.method, routeScope: intent.routeScope, requestTargetId: intent.requestTargetId,
        state: "COMMITTED", outcome: canonical("receipt-post-response") } });
    }
    return route.fallback();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Sales mới", exact: true }).click();
  const sale = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  const saleId = await sale.getAttribute("data-session-id"), raw = "ngày gõ dở ệ  ";
  await sale.getByLabel("Ngày chứng từ", { exact: true }).fill("");
  await sale.getByLabel("Ngày chứng từ", { exact: true }).pressSequentially(raw);
  await sale.getByLabel("Ghi chú", { exact: true }).fill("Sales riêng còn nguyên sau đối soát");
  await expect.poll(async () => (await records(page)).find(record => record.localDocumentId === saleId)?.snapshot.rawBuffers.saleDate?.raw).toBe(raw);
  await expect.poll(async () => (await records(page)).find(record => record.localDocumentId === saleId)?.snapshot.rawBuffers.note?.raw).toBe("Sales riêng còn nguyên sau đối soát");
  const savedSale = (await records(page)).find(record => record.localDocumentId === saleId)!;
  await page.getByRole("button", { name: "Tồn kho", exact: true }).click();
  await expect(page.locator('section[aria-label="Tồn kho"] .ag-row')).toHaveCount(1);
  await page.getByRole("button", { name: "Tách sang phải", exact: true }).click();
  await page.getByRole("button", { name: "Thẻ kho", exact: true }).click();
  const card = page.locator('section[aria-label="Thẻ kho"]');
  for (const label of ["Lọc kho", "Lọc sản phẩm"]) {
    const input = card.getByRole("combobox", { name: label, exact: true });
    await input.fill("REF"); await page.getByRole("listbox").getByRole("option").first().click(); await input.press("Tab");
  }
  await expect(card.locator(".ag-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Tách sang phải", exact: true }).click();
  await expect(page.locator('section[aria-label="Tồn kho"]')).toBeVisible();
  await expect(card).toBeVisible();
  await page.getByRole("tab").filter({ hasText: "Sales mới" }).click();
  await seedIntent(page, "receipt-post");
  const receipt = await restore(page, "goods-receipt", "receipt-post");
  const before = [...reads];
  await receipt.getByRole("button", { name: "Post phiếu nhập", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đối soát thao tác", exact: true })).toBeVisible();
  expect(reads).toEqual(before);
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
  for (const [index, invalid] of (["fingerprint", "epoch"] as const).entries()) {
    proof = invalid;
    await dialog.getByRole("button", { name: "Kiểm tra kết quả", exact: true }).click();
    await expect.poll(() => statusReads.length).toBe(index + 1);
    await expect(dialog.getByText(/Chưa có bằng chứng đã hoàn tất/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Kiểm tra kết quả", exact: true })).toBeEnabled();
    expect((await operations(page))[0].state).toBe("DISPATCHED");
    expect((await records(page)).find(record => record.localDocumentId === "receipt-post")?.unresolvedOperation).toBe(true);
    expect(reads).toEqual(before);
  }
  proof = "valid";
  await dialog.getByRole("button", { name: "Kiểm tra kết quả", exact: true }).click();
  await expect.poll(async () => (await operations(page))[0].state).toBe("SETTLED");
  for (const kind of ["balances", "stock-card"]) {
    await expect.poll(() => reads.filter(path => path.endsWith(`/${kind}`)).length).toBe(before.filter(path => path.endsWith(`/${kind}`)).length + 1);
  }
  await page.keyboard.press("Escape");
  await expect(receipt).toContainText("Posted");
  await page.getByRole("tab").filter({ hasText: "Sales mới" }).click();
  await expect(sale).toHaveAttribute("data-session-id", saleId!);
  await expect(sale.getByLabel("Ngày chứng từ", { exact: true })).toHaveValue(raw);
  await expect(sale.getByLabel("Ghi chú", { exact: true })).toHaveValue("Sales riêng còn nguyên sau đối soát");
  expect((await records(page)).find(record => record.localDocumentId === saleId)?.snapshot).toEqual(savedSale.snapshot);
  expect(writes).toHaveLength(1); expect(statusReads).toHaveLength(3);
  healthy(server);
});
