import { expect, test, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { productionHttp } from "./helpers/durableDraftWorkspaceHttp";
import type * as Harness from "./helpers/web4RecoveryHarness";
import type * as Drafts from "./helpers/durableDraftWorkspaceHarness";
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/web4-v1/corpus/${name}.json`, import.meta.url), "utf8"));
const harness = "/tests/e2e/helpers/web4RecoveryHarness.ts", draftsPath = "/tests/e2e/helpers/durableDraftWorkspaceHarness.ts";
const epoch = fixture("context-response").data.deploymentEpoch;
const opRecords = (page: Page) => page.evaluate(async path => { const h: typeof Harness = await import(/* @vite-ignore */ path); return h.operations(); }, harness);
const draftRecords = (page: Page) => page.evaluate(async path => { const h: typeof Drafts = await import(/* @vite-ignore */ path); return h.allRecords(); }, draftsPath);
const respond = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "no-store", Pragma: "no-cache", Expires: "0" }, body: JSON.stringify(body) });
async function restore(page: Page, stem: string) {
  await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
  await dialog.locator("li").filter({ hasText: stem.startsWith("sales") ? "Sales ·" : "Phiếu nhập ·" }).getByRole("button", { name: "Mở bản nháp", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  return page.locator(`section[data-session-id="${stem}"]`);
}
async function setup(page: Page, stem: string, mode: "lost" | "quota" | "reject" = "lost") {
  const server = await productionHttp(page);
  const writes: { path: string; key: string; body: unknown; epoch: string }[] = [], reads: string[] = [], details: string[] = [];
  const intent = fixture(`${stem}-intent`), response = fixture(`${stem}-response`);
  let status = "committed";
  await page.route("**/api/v1/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === "/api/v1/auth/capabilities" && !new URL(request.url()).searchParams.get("feature")?.startsWith("inventory-")) return respond(route, { data: { read: false, write: true, post: true } });
    if (/^\/api\/v1\/operations\/[0-9a-f-]{36}$/.test(path)) {
      reads.push(path);
      const op = (await opRecords(page))[0];
      expect(request.headers()["x-mydmsvn-deployment-epoch"]).toBe(epoch);
      expect(request.headers()["x-mydmsvn-operation-fingerprint"]).toBe(op.frozen.requestFingerprint);
      if (["404", "403", "500"].includes(status)) return respond(route, { error: { code: status === "404" ? "Operation.NotObserved" : status === "403" ? "Forbidden" : "InternalError", message: "Controlled denial", details: [], correlationId: "recovery-case-1" } }, Number(status));
      const data = { deploymentEpoch: epoch, operationId: op.operationId, requestFingerprint: op.frozen.requestFingerprint,
        operationKind: intent.operationKind, method: intent.method, routeScope: intent.routeScope, requestTargetId: intent.requestTargetId, state: "COMMITTED", outcome: response };
      if (status === "mismatch") data.operationId = "22222222-2222-4222-8222-222222222222";
      if (status === "expired") { data.state = "RESULT_EXPIRED"; data.outcome = null; }
      return respond(route, { data });
    }
    if (/^\/api\/v1\/(sales-receipts|goods-receipts)(\/|$)/.test(path)) {
      if (request.method() === "GET") { details.push(path); return respond(route, { error: { code: "Forbidden", message: "No Read", details: [] } }, 403); }
      writes.push({ path, key: request.headers()["idempotency-key"], body: request.postDataJSON(), epoch: request.headers()["x-mydmsvn-deployment-epoch"] });
      expect((await opRecords(page)).find(record => record.operationId === request.headers()["idempotency-key"])?.state).toBe("DISPATCHED");
      if (mode === "reject") return respond(route, { error: { code: "ValidationError", message: "Inactive product", details: [] } }, 400);
      if (mode === "quota") {
        await page.evaluate(() => { (window as Window & { web4Quota?: boolean }).web4Quota = true; });
        return respond(route, response);
      }
      // The application receives a failed HTTP response after one observed
      // dispatch; only the later explicit protected read supplies a result.
      return respond(route, { error: { code: "InternalError", message: "Controlled lost acknowledgement", details: [] } }, 503);
    }
    return route.fallback();
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Sales mới", exact: true })).toBeEnabled();
  await page.evaluate(async input => {
    const h: typeof Harness = await import(/* @vite-ignore */ input.path);
    await h.seedIntent(input.stem, input.intent, input.baseline);
  }, { path: harness, stem, intent, baseline: fixture(`${stem.endsWith("post") ? stem.replace("post", "update") : stem}-response`).data });
  const panel = await restore(page, stem);
  const button = panel.getByRole("button", { name: stem.startsWith("sales") ? stem.endsWith("post") ? "Post chứng từ" : "Lưu chứng từ" : stem.endsWith("post") ? "Post phiếu nhập" : "Lưu phiếu nhập", exact: true });
  return { server, writes, reads, details, intent, panel, button, setStatus: (value: string) => { status = value; } };
}
async function check(page: Page) {
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
  await dialog.getByRole("button", { name: "Kiểm tra kết quả", exact: true }).click();
  return dialog;
}
for (const stem of ["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"]) {
  test(`${stem} recovers after reload using explicit status, original IDs and no Read permission`, async ({ page }) => {
    const s = await setup(page, stem); await s.button.click();
    await expect(page.getByRole("button", { name: "Đối soát thao tác", exact: true })).toBeVisible();
    const original = (await opRecords(page))[0];
    expect(s.writes).toHaveLength(1); expect(s.writes[0]).toMatchObject({ key: original.operationId, body: s.intent.body, epoch });
    await page.reload(); await restore(page, stem); expect(s.reads).toHaveLength(0); expect(s.writes).toHaveLength(1);
    await check(page);
    await expect.poll(async () => (await opRecords(page))[0].state).toBe("SETTLED");
    const draft = (await draftRecords(page)).find(record => record.localDocumentId === stem)!;
    expect(draft.unresolvedOperation).toBe(false); expect(draft.snapshot.draft.lines.map(line => line.clientLineId)).toEqual(draft.snapshot.draft.lines.map((_, i) => `retained-${i}`));
    if (stem.endsWith("post")) { expect(draft.snapshot.postAcknowledgement?.status).toBe("Posted");
      if (stem.startsWith("receipt")) expect(draft.snapshot.postAcknowledgement).not.toHaveProperty("version");
    } else expect(draft.snapshot.baseline?.version).toBe(fixture(`${stem}-response`).data.version);
    expect(s.writes).toHaveLength(1); expect(s.reads).toHaveLength(1); expect(s.details).toEqual([]); expect(s.server.unexpected).toEqual([]);
    expect(s.server.errors.filter(value => !value.startsWith("Failed to load resource:"))).toEqual([]);
    await page.screenshot({ path: join(tmpdir(), `web4-recovery-${stem}-${test.info().project.name}.png`) });
  });
}
for (const status of ["404", "403", "500", "expired", "mismatch"]) {
  test(`${status} status keeps the restored document locked without rePOST`, async ({ page }) => {
    const s = await setup(page, "sales-create"); await s.button.click();
    await expect(page.getByRole("button", { name: "Đối soát thao tác", exact: true })).toBeVisible();
    await page.reload(); const panel = await restore(page, "sales-create"); s.setStatus(status);
    const dialog = await check(page); await expect(dialog.getByText(/Chưa có bằng chứng đã hoàn tất/)).toBeVisible();
    if (status === "404") await page.screenshot({ path: join(tmpdir(), `web4-recovery-unknown-${test.info().project.name}.png`) });
    expect((await opRecords(page))[0].state).toBe("DISPATCHED"); expect((await draftRecords(page))[0].unresolvedOperation).toBe(true);
    await page.keyboard.press("Escape"); await expect(panel.getByRole("button", { name: "Lưu chứng từ", exact: true })).toBeDisabled();
    expect(s.writes).toHaveLength(1); expect(s.reads).toHaveLength(1);
  });
}
test("settlement quota retains UNKNOWN and explicit local retry performs no status or mutation HTTP", async ({ page }) => {
  const s = await setup(page, "sales-create", "quota"); await s.button.click();
  await expect(page.getByText("Chưa lưu được bản nháp trên thiết bị", { exact: true })).toBeVisible();
  await page.evaluate(() => { (window as Window & { web4Quota?: boolean }).web4Quota = false; });
  await check(page); await expect.poll(async () => (await opRecords(page))[0].state).toBe("SETTLED");
  expect(s.writes).toHaveLength(1); expect(s.reads).toHaveLength(0);
});
for (const stem of ["sales-create", "receipt-create"]) {
  test(`${stem} known first business rejection preserves input and allows a new explicit intent`, async ({ page }) => {
    const s = await setup(page, stem, "reject"); await s.button.click();
    await expect.poll(async () => (await opRecords(page))[0].state).toBe("REJECTED");
    await expect(s.button).toBeEnabled(); const first = s.writes[0].key;
    await s.button.click(); await expect.poll(async () => (await opRecords(page)).length).toBe(2);
    await expect.poll(async () => (await opRecords(page)).every(record => record.state === "REJECTED")).toBe(true);
    expect(s.writes).toHaveLength(2); expect(s.writes[1].key).not.toBe(first); expect(s.reads).toHaveLength(0);
  });
}
test("corrupt frozen intent retains recorded operator identity without opening or sending HTTP", async ({ page }) => {
  const s = await setup(page, "sales-create"); await s.button.click();
  await expect(page.getByRole("button", { name: "Đối soát thao tác", exact: true })).toBeVisible();
  const operation = (await opRecords(page))[0];
  await page.evaluate(async input => {
    const path = "/tests/e2e/helpers/web4OperationRepositoryHarness.ts";
    const h: typeof import("./helpers/web4OperationRepositoryHarness") = await import(/* @vite-ignore */ path);
    await h.rawPut("mydmsvn-drafts-v1", "operations", h.operationKey(input), { ...input, frozen: { ...input.frozen, requestFingerprint: "0".repeat(64) } });
  }, operation);
  await page.reload();
  await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
  await expect(dialog).toContainText(operation.operationId); await expect(dialog).toContainText(epoch);
  await expect(dialog).toContainText("Thông tin đã lưu, chưa xác minh kết quả");
  await dialog.getByRole("button", { name: "Mở bản nháp", exact: true }).click();
  await expect(dialog).toContainText("Chưa thể đọc hoặc xóa bản nháp");
  await expect(page.locator('section[data-session-id="sales-create"]')).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Xóa bản nháp này", exact: true })).toBeDisabled();
  expect(s.writes).toHaveLength(1); expect(s.reads).toHaveLength(0);
});
