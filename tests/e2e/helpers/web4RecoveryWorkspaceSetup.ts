import { expect, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { productionHttp } from "./durableDraftWorkspaceHttp";
import type * as Harness from "./web4RecoveryHarness";
import type * as Drafts from "./durableDraftWorkspaceHarness";
export const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/web4-v1/corpus/${name}.json`, import.meta.url), "utf8"));
const harness = "/tests/e2e/helpers/web4RecoveryHarness.ts", draftsPath = "/tests/e2e/helpers/durableDraftWorkspaceHarness.ts";
export const epoch = fixture("context-response").data.deploymentEpoch;
export const opRecords = (page: Page) => page.evaluate(async path => { const h: typeof Harness = await import(/* @vite-ignore */ path); return h.operations(); }, harness);
export const draftRecords = (page: Page) => page.evaluate(async path => { const h: typeof Drafts = await import(/* @vite-ignore */ path); return h.allRecords(); }, draftsPath);
export const respond = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "no-store", Pragma: "no-cache", Expires: "0" }, body: JSON.stringify(body) });
export async function restore(page: Page, stem: string) {
  await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
  await dialog.locator("li").filter({ hasText: stem.startsWith("sales") ? "Sales ·" : "Phiếu nhập ·" }).getByRole("button", { name: "Mở bản nháp", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  return page.locator(`section[data-session-id="${stem}"]`);
}
export async function setup(page: Page, stem: string, mode: "lost" | "quota" | "reject" = "lost") {
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
export async function check(page: Page, mode: "status" | "local" = "status") {
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
  await dialog.getByRole("button", { name: mode === "local" ? "Thử lại lưu cục bộ" : "Kiểm tra kết quả", exact: true }).click();
  return dialog;
}
