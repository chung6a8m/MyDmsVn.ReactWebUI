import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { productionHttp } from "./helpers/durableDraftWorkspaceHttp";
import { draftRecords, opRecords, respond } from "./helpers/web4RecoveryWorkspaceSetup";
import type * as Harness from "./helpers/web5HistoricalRecoveryHarness";

const vector = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/web5-resolution-v1/${name}.json`, import.meta.url), "utf8"));
const harnessPath = "/tests/e2e/helpers/web5HistoricalRecoveryHarness.ts";

for (const [historicalStem, currentStem, capabilities] of [
  ["receipt-post", "receipt-update", { read: false, write: true, post: false }],
  ["sales-update", "sales-post", { read: false, write: false, post: true }],
] as const) {
  test(`${historicalStem} negative cannot block current ${currentStem} protected recovery after historical grant revocation`, async ({ page }) => {
    const server = await productionHttp(page, { capabilities });
    const resolutionReads: string[] = [], legacyReads: string[] = [], publicReads: string[] = [];
    await page.route("**/api/v1/**", async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (/^\/api\/v1\/operations\/[0-9a-f-]{36}$/.test(path)) {
        legacyReads.push(path); return respond(route, { error: { code: "Forbidden", message: "No implicit status read", details: [] } }, 403);
      }
      if (request.method() === "GET" && /^\/api\/v1\/(sales-receipts|goods-receipts)(\/|$)/.test(path)) {
        publicReads.push(path); return respond(route, { error: { code: "Forbidden", message: "Ordinary Read denied", details: [] } }, 403);
      }
      return route.fallback();
    });
    await page.route("**/api/v2/**", async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      expect(request.method()).toBe("GET"); expect(request.postData()).toBeNull();
      if (path === "/api/v2/operations/context") return respond(route, vector("context-response"));
      resolutionReads.push(path);
      const operation = (await opRecords(page)).find(record => path === `/api/v2/operations/${record.operationId}/resolution`);
      if (!operation || operation.state !== "DISPATCHED") throw Error("Only the current pending operation may be read");
      expect(request.headers()["x-mydmsvn-deployment-epoch"]).toBe(operation.deploymentEpoch);
      expect(request.headers()["x-mydmsvn-operation-fingerprint"]).toBe(operation.frozen.requestFingerprint);
      const [module, command] = operation.frozen.request.operationKind.split(".");
      const response = vector(`${module === "Sales" ? "sales" : "receipt"}-${command.toLowerCase()}-committed`);
      Object.assign(response.data, { actorUserId: Number(operation.actorKey), deploymentEpoch: operation.deploymentEpoch,
        operationId: operation.operationId, requestFingerprint: operation.frozen.requestFingerprint });
      return respond(route, response);
    });

    await page.goto("/lab/components");
    await expect(page.getByText("Components Lab · Nova / Dockview / Quartz", { exact: true })).toBeVisible();
    const id = `historical-${currentStem}`;
    const seeded = await page.evaluate(async ({ path, historicalStem, currentStem, id }) => {
      const h: typeof Harness = await import(/* @vite-ignore */ path);
      return h.seedHistoricalNegative(historicalStem, currentStem, id);
    }, { path: harnessPath, historicalStem, currentStem, id });
    expect(seeded.historical.operation.state).toBe("NOT_EXECUTED"); expect(seeded.current.operation.state).toBe("DISPATCHED");
    expect(seeded.current.draft.localPersistSequence).toBe(4); expect(seeded.current.draft.editRevision).toBe(8);
    expect(seeded.current.operation.operationId).not.toBe(seeded.historical.operation.operationId);
    await page.goto("/");
    await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
    const row = dialog.locator("li").filter({ hasText: currentStem.startsWith("sales") ? "Sales ·" : "Phiếu nhập ·" });
    await expect(row).toContainText("Chứng từ được bảo vệ");
    await expect(row.getByRole("button", { name: "Xóa bản nháp này", exact: true })).toBeDisabled();
    await row.getByRole("button", { name: "Mở bản nháp", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const panel = page.locator(`section[data-session-id="${id}"]`);
    await expect(panel.getByLabel("Ghi chú", { exact: true })).toBeDisabled();
    expect(resolutionReads).toEqual([]); expect(legacyReads).toEqual([]); expect(publicReads).toEqual([]);
    expect((await draftRecords(page))[0]).toEqual(seeded.current.draft);
    expect((await opRecords(page)).find(record => record.operationId === seeded.historical.operation.operationId)).toEqual(seeded.historical.operation);
    await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
    await expect(dialog).toContainText(seeded.current.operation.operationId);
    await expect(dialog).not.toContainText(seeded.historical.operation.operationId);
    await expect(dialog.getByRole("region", { name: "Xác nhận thao tác không thực hiện", exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true }).click();
    await expect.poll(async () => (await opRecords(page)).find(record => record.operationId === seeded.current.operation.operationId)?.state).toBe("SETTLED");
    const settled = (await opRecords(page)).find(record => record.operationId === seeded.current.operation.operationId)!;
    expect(settled.frozen).toEqual(seeded.current.operation.frozen);
    expect(settled.settlement).toMatchObject({ draftSequence: 5, status: currentStem.endsWith("post") ? "Posted" : "Draft", version: vector(`${currentStem}-committed`).data.outcome.data.version });
    const draft = (await draftRecords(page))[0];
    expect(draft).toMatchObject({ unresolvedOperation: false, operationId: null, localPersistSequence: 5 });
    expect(resolutionReads).toEqual([`/api/v2/operations/${seeded.current.operation.operationId}/resolution`]);
    await expect(dialog).not.toContainText(seeded.historical.operation.operationId);
    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
    await expect(panel.getByLabel("Ghi chú", { exact: true })).toBeDisabled();
    await expect(panel.getByRole("button", { name: currentStem.startsWith("sales") ? "Post chứng từ" : "Lưu phiếu nhập", exact: true })).toBeDisabled();
    const protection = await page.evaluate(async ({ path, draft }) => {
      const h: typeof Harness = await import(/* @vite-ignore */ path); return h.probeHistoricalProtection(draft);
    }, { path: harnessPath, draft });
    expect(protection).toEqual({ write: "protected", deletion: "protected", retained: { kind: "available", record: draft } });
    expect((await opRecords(page)).find(record => record.operationId === seeded.historical.operation.operationId)).toEqual(seeded.historical.operation);
    expect((await opRecords(page)).find(record => record.operationId === seeded.current.operation.operationId)).toEqual(settled);
    expect(resolutionReads).toHaveLength(1); expect(legacyReads).toEqual([]); expect(publicReads).toEqual([]);
    expect(server.businessWrites).toEqual([]); expect(server.unexpected).toEqual([]);
    expect(server.errors.filter(value => !value.startsWith("Failed to load resource:"))).toEqual([]);
  });
}
