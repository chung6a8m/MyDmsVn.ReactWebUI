import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { setupResolution } from "./helpers/web5TerminalResolutionSetup";
import { draftRecords, epoch, fixture, opRecords, respond } from "./helpers/web4RecoveryWorkspaceSetup";
import type { DurableOperationRecord } from "../../src/infrastructure/drafts/web4OperationRepository";

type Scenario = Awaited<ReturnType<typeof setupResolution>>;
const dialogFor = (page: Page) => page.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
const confirmName = "Xác nhận giữ nội dung và tạo ý định mới";
const consentName = "Tôi đã xem lại nội dung được giữ và muốn bắt đầu một ý định mới cho chứng từ mới này.";
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
function negative(stem: string, operation: DurableOperationRecord) {
  const body = JSON.parse(readFileSync(new URL(`../fixtures/web5-resolution-v1/${stem}-not-executed.json`, import.meta.url), "utf8"));
  Object.assign(body.data, { actorUserId: Number(operation.actorKey), operationId: operation.operationId,
    deploymentEpoch: operation.deploymentEpoch, requestFingerprint: operation.frozen.requestFingerprint });
  return body;
}
function healthy(s: Scenario) {
  expect(s.server.unexpected).toEqual([]); expect(s.server.businessWrites).toEqual([]);
  expect(s.server.errors.filter(value => !value.startsWith("Failed to load resource:"))).toEqual([]);
}
async function lost(page: Page, s: Scenario) {
  await s.button.click();
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const dialog = dialogFor(page);
  await expect(dialog.getByText("Kết quả chưa rõ; cần kiểm tra kết quả. Không tự gửi lại.", { exact: true })).toBeVisible();
  expect(s.writes).toHaveLength(1); expect(s.resolutionReads).toHaveLength(0);
  return dialog;
}
async function resolve(page: Page, s: Scenario) {
  const dialog = await lost(page, s);
  await dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true }).click();
  await expect(dialog.getByText("Máy chủ đã xác nhận thao tác gốc không được thực hiện.", { exact: true })).toBeVisible();
  await expect.poll(async () => (await opRecords(page))[0].state).toBe("NOT_EXECUTED");
  return dialog;
}
async function grant(page: Page, stem: string, capabilities: { read: boolean; write: boolean; post: boolean }) {
  await page.route("**/api/v1/auth/capabilities*", route => respond(route, { data: capabilities }));
  await page.evaluate(async feature => {
    const path = "/src/app/runtime/browserAuth.ts";
    const h: typeof import("../../src/app/runtime/browserAuth") = await import(/* @vite-ignore */ path);
    await h.getBrowserAuth().loadFeatureCapabilities(feature);
  }, stem.startsWith("sales") ? "sales" as const : "goods-receipt" as const);
}
async function reverify(page: Page) {
  // A capability refresh first publishes denied grants. It intentionally
  // invalidates earlier negative authority, even when Read is subsequently added.
  await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
  const dialog = dialogFor(page);
  await expect(dialog).toContainText("Quyết định đã lưu chưa được xác minh lại trong phiên hiện tại");
  await dialog.getByRole("button", { name: "Xác minh lại quyết định", exact: true }).click();
  await expect(dialog.getByText("Máy chủ đã xác nhận thao tác gốc không được thực hiện.", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
}
async function heldResolution(page: Page, stem: string, operation: DurableOperationRecord) {
  const entered = deferred(), release = deferred(), finished = deferred(); let calls = 0;
  await page.route(`**/api/v2/operations/${operation.operationId}/resolution`, async route => {
    calls++; entered.resolve();
    expect(route.request().method()).toBe("GET"); expect(route.request().postData()).toBeNull();
    expect(route.request().headers()["x-mydmsvn-operation-fingerprint"]).toBe(operation.frozen.requestFingerprint);
    expect(route.request().headers()["x-mydmsvn-deployment-epoch"]).toBe(operation.deploymentEpoch);
    await release.promise;
    try { await respond(route, negative(stem, operation)); } finally { finished.resolve(); }
  });
  return { entered: entered.promise, release: release.resolve, finished: finished.promise, calls: () => calls };
}

for (const stem of ["sales-create", "receipt-post"]) {
  test(`${stem} stored negative after reload requires fresh server authority before restore`, async ({ page }) => {
    const s = await setupResolution(page, stem); await resolve(page, s);
    const operation = (await opRecords(page))[0], before = (await draftRecords(page))[0];
    s.setResolutionState("403"); await page.reload();
    await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
    const dialog = dialogFor(page), row = dialog.locator("li").filter({ hasText: stem.startsWith("sales") ? "Sales ·" : "Phiếu nhập ·" });
    await expect(row.getByRole("button", { name: "Mở bản nháp", exact: true })).toBeEnabled();
    expect(s.resolutionReads).toHaveLength(1); expect(s.reads).toHaveLength(0);
    await row.getByRole("button", { name: "Mở bản nháp", exact: true }).click();
    await expect(dialog).toContainText("Chưa thể đọc hoặc xóa bản nháp trên thiết bị");
    await expect(page.locator(`section[data-session-id="${stem}"]`)).toHaveCount(0);
    expect(await opRecords(page)).toEqual([operation]); expect((await draftRecords(page))[0]).toEqual(before);
    s.setResolutionState("not-executed"); await row.getByRole("button", { name: "Mở bản nháp", exact: true }).click();
    await expect(dialog).toHaveCount(0); await expect(s.button).toBeDisabled();
    await expect(s.panel.getByLabel("Ghi chú", { exact: true })).toHaveValue(before.snapshot.draft.note ?? "");
    expect(s.resolutionReads).toHaveLength(3); expect(s.reads).toHaveLength(0); expect(s.writes).toHaveLength(1); expect(s.details).toEqual([]);
    healthy(s);
  });

  for (const change of ["original-grant", "actor", "epoch"] as const) {
    test(`${stem} late terminal certificate after ${change} change cannot release its owner`, async ({ page }) => {
      const s = await setupResolution(page, stem), dialog = await lost(page, s);
      const operation = (await opRecords(page))[0], before = (await draftRecords(page))[0], held = await heldResolution(page, stem, operation);
      await dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true }).click(); await held.entered;
      if (change === "original-grant") {
        await grant(page, stem, { read: true, write: stem.endsWith("post"), post: !stem.endsWith("post") });
        await expect(dialog).not.toContainText(operation.operationId);
      } else {
        if (change === "actor") s.server.owner.actorUserId = 43; else s.server.owner.deploymentEpoch = "7c3baa58-9721-47ee-a1ac-88fc37c06e51";
        await page.evaluate(async () => { const path = "/src/app/runtime/browserAuth.ts"; const h: typeof import("../../src/app/runtime/browserAuth") = await import(/* @vite-ignore */ path); await h.getBrowserAuth().refresh(); });
        await expect(s.panel).toHaveCount(0);
      }
      held.release(); await held.finished;
      if (change === "original-grant") await expect(dialog.getByRole("button", { name: "Đọc lại danh sách", exact: true })).toBeEnabled();
      else await expect(page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true })).toBeEnabled();
      expect(await opRecords(page)).toEqual([operation]);
      expect((await draftRecords(page)).find(record => record.localDocumentId === stem && record.actorKey === "42" && record.deploymentEpoch === epoch)).toEqual(before);
      await expect(page.locator("body")).not.toContainText(operation.operationId);
      expect(held.calls()).toBe(1); expect(s.writes).toHaveLength(1); expect(s.reads).toHaveLength(0); expect(s.details.filter(path => /\/\d+$/.test(path))).toEqual([]);
      healthy(s);
    });
  }

  for (const fault of ["wrong-fingerprint", "missing-certificate"] as const) {
    test(`${stem} ${fault} versioned negative leaves the exact raw UNKNOWN checkpoint`, async ({ page }) => {
      const s = await setupResolution(page, stem), dialog = await lost(page, s), operation = (await opRecords(page))[0], before = (await draftRecords(page))[0];
      let reads = 0;
      await page.route(`**/api/v2/operations/${operation.operationId}/resolution`, async route => {
        reads++; const body = negative(stem, operation);
        if (fault === "wrong-fingerprint") body.data.requestFingerprint = "0".repeat(64); else delete body.data.terminal;
        await respond(route, body);
      });
      await dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true }).click();
      await expect(dialog.getByText("Chưa có bằng chứng đã hoàn tất; tiếp tục giữ khóa. Không tự gửi lại.", { exact: true })).toBeVisible();
      expect(await opRecords(page)).toEqual([operation]); expect((await draftRecords(page))[0]).toEqual(before);
      await expect(dialog.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true })).toBeDisabled();
      await expect(dialog.getByRole("button", { name: confirmName, exact: true })).toHaveCount(0);
      await page.keyboard.press("Escape"); await expect(s.button).toBeDisabled();
      expect(reads).toBe(1); expect(s.writes).toHaveLength(1); expect(s.details).toEqual([]); healthy(s);
    });
  }

  test(`${stem} two tabs compete for one negative CAS while the loser keeps its raw draft locked`, async ({ page, context }) => {
    const first = await setupResolution(page, stem), firstDialog = await lost(page, first), operation = (await opRecords(page))[0], before = (await draftRecords(page))[0];
    const secondPage = await context.newPage(), second = await setupResolution(secondPage, stem, { seed: false });
    expect(second.resolutionReads).toHaveLength(0); expect(second.reads).toHaveLength(0); // DISPATCHED restore never polls.
    await secondPage.getByRole("button", { name: "Đối soát thao tác", exact: true }).click(); const secondDialog = dialogFor(secondPage);
    const firstRead = await heldResolution(page, stem, operation), secondRead = await heldResolution(secondPage, stem, operation);
    await Promise.all([firstDialog, secondDialog].map(dialog => dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true }).click()));
    await Promise.all([firstRead.entered, secondRead.entered]); firstRead.release(); secondRead.release(); await Promise.all([firstRead.finished, secondRead.finished]);
    const dialogs = [firstDialog, secondDialog], winnerMessage = "Máy chủ đã xác nhận thao tác gốc không được thực hiện.";
    await expect.poll(async () => (await Promise.all(dialogs.map(dialog => dialog.getByText(winnerMessage, { exact: true }).count()))).reduce((sum, n) => sum + n, 0)).toBe(1);
    const winner = await firstDialog.getByText(winnerMessage, { exact: true }).count() ? 0 : 1, loser = 1 - winner;
    await expect(dialogs[loser].getByText("Bản nháp xung đột với phiên khác", { exact: true })).toBeVisible();
    await dialogs[loser].getByRole("button", { name: "Thử lại lưu cục bộ", exact: true }).click();
    await expect(dialogs[loser].getByText("Không thể kiểm tra hoặc lưu kết quả; tiếp tục giữ khóa.", { exact: true })).toBeVisible();
    await [page, secondPage][loser].keyboard.press("Escape");
    await expect([first, second][loser].button).toBeDisabled();
    await expect([first, second][loser].panel.getByLabel("Ghi chú", { exact: true })).toHaveValue(before.snapshot.rawBuffers.note!.raw);
    expect((await draftRecords(page))[0].snapshot).toEqual(before.snapshot);
    expect((await opRecords(page))[0]).toMatchObject({ state: "NOT_EXECUTED", localPersistSequence: 2, frozen: operation.frozen });
    expect(first.writes).toHaveLength(1); expect(second.writes).toHaveLength(0); expect(firstRead.calls()).toBe(1); expect(secondRead.calls()).toBe(1);
    healthy(first); healthy(second); await secondPage.close();
  });
}

for (const stem of ["sales-update", "receipt-update"]) {
  test(`${stem} negative requires fresh Read and explicit baseline confirmation; revoked preview cannot enable Save`, async ({ page }) => {
    const s = await setupResolution(page, stem); await resolve(page, s); const before = (await draftRecords(page))[0];
    await page.keyboard.press("Escape"); await expect(s.button).toBeDisabled();
    await s.panel.locator("summary").filter({ hasText: "Đọc lại / review conflict" }).click();
    const read = s.panel.getByRole("button", { name: "Đọc lại để review", exact: true }), confirm = s.panel.getByRole("button", { name: "Xác nhận bỏ bản sửa và dùng bản đọc", exact: true });
    await read.click(); await expect(confirm).toBeDisabled(); expect(s.details).toEqual([]); // No ordinary Read grant.
    let reads = 0; const path = `/api/v1/${stem.startsWith("sales") ? "sales-receipts" : "goods-receipts"}/${s.intent.requestTargetId}`;
    await page.route(`**${path}`, async route => {
      if (route.request().method() !== "GET") return route.fallback();
      reads++; const body = fixture(`${stem}-response`); body.data.note = reads === 1 ? "Phiên bản máy chủ cần xem lại" : "Phiên bản máy chủ mới nhất";
      body.data.version = reads === 1 ? "AAAAAAAAAAM=" : "AAAAAAAAAAQ="; await respond(route, body);
    });
    await grant(page, stem, { read: true, write: true, post: false });
    await reverify(page);
    await read.click(); await expect(confirm).toBeEnabled();
    await expect(s.panel.getByLabel("Ghi chú", { exact: true })).toHaveValue(before.snapshot.draft.note ?? ""); await expect(s.button).toBeDisabled();
    await grant(page, stem, { read: false, write: true, post: false }); await confirm.click();
    await expect(s.button).toBeDisabled(); await expect(s.panel.getByLabel("Ghi chú", { exact: true })).toHaveValue(before.snapshot.draft.note ?? "");
    expect(s.writes).toHaveLength(1);
    await grant(page, stem, { read: true, write: true, post: false }); await reverify(page); await read.click(); await expect(confirm).toBeEnabled();
    await expect(s.panel.locator("pre")).toContainText("Phiên bản máy chủ mới nhất");
    await confirm.click(); await expect(s.panel.getByLabel("Ghi chú", { exact: true })).toHaveValue("Phiên bản máy chủ mới nhất");
    await expect(s.button).toBeEnabled(); expect(s.writes).toHaveLength(1);
    await s.button.click(); await expect.poll(() => s.writes.length).toBe(2);
    expect(s.writes[1].key).not.toBe(s.writes[0].key); expect(s.writes[1].body).toMatchObject({ expectedVersion: "AAAAAAAAAAQ=" });
    expect(reads).toBe(2); healthy(s);
  });
}

test("negative Create consent is keyboard explicit and restores focus without dispatch", async ({ page }) => {
  const s = await setupResolution(page, "sales-create"); await lost(page, s);
  const dialog = dialogFor(page), firstOpener = page.getByRole("button", { name: "Đối soát thao tác", exact: true });
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(firstOpener).toBeFocused();
  const opener = page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true });
  await opener.focus(); await expect(opener).toBeFocused(); await page.keyboard.press("Enter");
  await dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true }).click();
  const consent = dialog.getByRole("checkbox", { name: consentName, exact: true }), confirm = dialog.getByRole("button", { name: confirmName, exact: true });
  await expect(confirm).toBeDisabled(); await consent.focus(); await page.keyboard.press("Space"); await expect(consent).toBeChecked();
  await page.keyboard.press("Tab"); await expect(confirm).toBeFocused(); await page.keyboard.press("Enter");
  await expect(confirm).toHaveCount(0); expect(s.writes).toHaveLength(1);
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused(); await expect(s.button).toBeEnabled(); healthy(s);
});
