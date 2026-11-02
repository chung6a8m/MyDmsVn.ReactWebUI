import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { check, draftRecords, epoch, fixture, opRecords, respond, setup } from "./helpers/web4RecoveryWorkspaceSetup";
import type { DurableOperationRecord } from "../../src/infrastructure/drafts/web4OperationRepository";

type Scenario = Awaited<ReturnType<typeof setup>>;
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
function healthy(s: Scenario) {
  expect(s.server.unexpected).toEqual([]); expect(s.server.businessWrites).toEqual([]);
  expect(s.server.errors.filter(value => !value.startsWith("Failed to load resource:"))).toEqual([]);
}
async function unknown(s: Scenario, page: Page) {
  await s.button.click();
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
  // Unlike toolbar visibility, this exact coordinator feedback establishes
  // that the observed dispatch/lost response has finished before navigation.
  await expect(dialog.getByText("Kết quả chưa rõ; cần kiểm tra kết quả. Không tự gửi lại.", { exact: true })).toBeVisible();
  expect(s.writes).toHaveLength(1); expect(s.reads).toHaveLength(0);
  return dialog;
}
async function heldStatus(page: Page, stem: string, operation: DurableOperationRecord) {
  const entered = deferred(), release = deferred(), finished = deferred(); let calls = 0;
  await page.route(`**/api/v1/operations/${operation.operationId}`, async route => {
    calls++; entered.resolve();
    expect(route.request().method()).toBe("GET");
    expect(route.request().headers()["x-mydmsvn-deployment-epoch"]).toBe(operation.deploymentEpoch);
    expect(route.request().headers()["x-mydmsvn-operation-fingerprint"]).toBe(operation.frozen.requestFingerprint);
    await release.promise;
    const { operationKind, method, routeScope, requestTargetId } = operation.frozen.request;
    try { await respond(route, { data: { deploymentEpoch: operation.deploymentEpoch, operationId: operation.operationId,
      requestFingerprint: operation.frozen.requestFingerprint, operationKind, method, routeScope, requestTargetId,
      state: "COMMITTED", outcome: fixture(`${stem}-response`) } }); }
    finally { finished.resolve(); }
  });
  return { entered: entered.promise, release: release.resolve, finished: finished.promise, calls: () => calls };
}
const replacementEpoch = "7c3baa58-9721-47ee-a1ac-88fc37c06e51";
for (const stem of ["sales-create", "receipt-post"]) {
  for (const change of ["original-grant", "actor", "epoch"] as const) {
    test(`${stem} late protected result after ${change} change cannot settle or publish into the current workspace`, async ({ page }) => {
      await page.setViewportSize(stem === "sales-create" ? { width: 1280, height: 720 } : { width: 1440, height: 900 });
      const s = await setup(page, stem, "lost", { originalGrantOnly: true, rawNote: true });
      if (stem === "receipt-post") await page.getByRole("button", { name: "Dark", exact: true }).click();
      const dialog = await unknown(s, page), operation = (await opRecords(page))[0], before = (await draftRecords(page))[0];
      const held = await heldStatus(page, stem, operation);
      const action = dialog.getByRole("button", { name: "Kiểm tra kết quả", exact: true });
      await action.focus(); await page.keyboard.press("Enter"); await held.entered;
      await expect(dialog.getByRole("button", { name: "Đang kiểm tra…", exact: true })).toBeDisabled(); await page.keyboard.press("Enter"); await page.keyboard.press("Tab");
      expect(held.calls()).toBe(1);
      if (change === "original-grant") {
        await page.route("**/api/v1/auth/capabilities*", route => respond(route, { data: { read: true, write: stem.endsWith("post"), post: !stem.endsWith("post") } }));
        await page.evaluate(async feature => {
          const path = "/src/app/runtime/browserAuth.ts";
          const h: typeof import("../../src/app/runtime/browserAuth") = await import(/* @vite-ignore */ path);
          await h.getBrowserAuth().loadFeatureCapabilities(feature);
        }, stem.startsWith("sales") ? "sales" as const : "goods-receipt" as const);
        await expect(dialog).not.toContainText(operation.operationId);
      } else {
        if (change === "actor") s.server.owner.actorUserId = 43; else s.server.owner.deploymentEpoch = replacementEpoch;
        await page.evaluate(async () => {
          const path = "/src/app/runtime/browserAuth.ts";
          const h: typeof import("../../src/app/runtime/browserAuth") = await import(/* @vite-ignore */ path); await h.getBrowserAuth().refresh();
        });
        await expect(page.locator(`section[data-session-id="${stem}"]`)).toHaveCount(0);
        // Give the replacement owner an independent editable document. A late
        // original result must not populate or lock it.
        await page.route("**/api/v1/auth/capabilities?feature=sales", route => respond(route, { data: { read: false, write: true, post: false } }));
        await page.evaluate(async () => {
          const path = "/src/app/runtime/browserAuth.ts";
          const h: typeof import("../../src/app/runtime/browserAuth") = await import(/* @vite-ignore */ path); await h.getBrowserAuth().loadFeatureCapabilities("sales");
        });
        await page.getByRole("button", { name: "Sales mới", exact: true }).click();
        await page.getByRole("region", { name: "Chứng từ mới", exact: true }).getByLabel("Ghi chú", { exact: true }).fill("Nội dung riêng của phiên mới ệ");
      }
      held.release(); await held.finished;
      if (change === "original-grant") await expect(dialog.getByRole("button", { name: "Đọc lại danh sách", exact: true })).toBeEnabled();
      else await expect(page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true })).toBeEnabled();
      expect(await opRecords(page)).toEqual([operation]);
      expect((await draftRecords(page)).find(record => record.localDocumentId === stem && record.actorKey === "42" && record.deploymentEpoch === epoch)).toEqual(before);
      await expect(page.locator("body")).not.toContainText(operation.operationId);
      if (change !== "original-grant") await expect(page.getByRole("region", { name: "Chứng từ mới", exact: true }).getByLabel("Ghi chú", { exact: true })).toHaveValue("Nội dung riêng của phiên mới ệ");
      else {
        await page.screenshot({ path: join(tmpdir(), `web5-f03-late-${stem}-${test.info().project.name}.png`) });
        await page.keyboard.press("Escape"); await expect(s.button).toBeDisabled();
        await expect(s.panel.getByLabel("Ghi chú", { exact: true })).toHaveValue(before.snapshot.draft.note ?? "");
      }
      expect(held.calls()).toBe(1); expect(s.writes).toHaveLength(1); expect(s.reads).toHaveLength(0);
      expect(s.details.filter(path => /\/\d+(?:\/|$)/.test(path))).toEqual([]);
      healthy(s);
    });
  }
  test(`${stem} competing workspace settlements accept one CAS winner and preserve the losing raw checkpoint`, async ({ page, context }) => {
    const first = await setup(page, stem, "lost", { originalGrantOnly: true, rawNote: true });
    const firstDialog = await unknown(first, page), operation = (await opRecords(page))[0], before = (await draftRecords(page))[0];
    expect(before.snapshot.rawBuffers.note?.raw).toBe(before.snapshot.draft.note);
    const secondPage = await context.newPage(), second = await setup(secondPage, stem, "lost", { originalGrantOnly: true, seed: false });
    await secondPage.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
    const secondDialog = secondPage.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
    const firstStatus = await heldStatus(page, stem, operation), secondStatus = await heldStatus(secondPage, stem, operation);
    await Promise.all([firstDialog, secondDialog].map(dialog => dialog.getByRole("button", { name: "Kiểm tra kết quả", exact: true }).click()));
    await Promise.all([firstStatus.entered, secondStatus.entered]); firstStatus.release(); secondStatus.release();
    await Promise.all([firstStatus.finished, secondStatus.finished]);
    await expect.poll(async () => (await opRecords(page))[0].state).toBe("SETTLED");
    const dialogs = [firstDialog, secondDialog], scenarios = [first, second];
    await expect.poll(async () => (await Promise.all(dialogs.map(dialog => dialog.getByText("Đã lưu kết quả đối soát trên thiết bị.", { exact: true }).count()))).reduce((sum, count) => sum + count, 0)).toBe(1);
    const winner = await firstDialog.getByText("Đã lưu kết quả đối soát trên thiết bị.", { exact: true }).count() ? 0 : 1, loser = 1 - winner;
    await expect(dialogs[loser].getByText("Bản nháp xung đột với phiên khác", { exact: true })).toBeVisible();
    await expect(dialogs[loser].getByText("Đã có kết quả nhưng chưa lưu được trên thiết bị. Kiểm tra kết quả để thử lưu cục bộ; không gửi lại chứng từ.", { exact: true })).toBeVisible();
    await dialogs[loser].getByRole("button", { name: "Thử lại lưu cục bộ", exact: true }).click();
    // A conflict is not retryable: the persistence admission rejects it before
    // any operation reread, HTTP fallback or attempt to overwrite the winner.
    await expect(dialogs[loser].getByText("Không thể kiểm tra hoặc lưu kết quả; tiếp tục giữ khóa.", { exact: true })).toBeVisible();
    await [page, secondPage][loser].keyboard.press("Escape");
    await expect(scenarios[loser].button).toBeDisabled();
    await expect(scenarios[loser].panel.getByLabel("Ghi chú", { exact: true })).toHaveValue(before.snapshot.rawBuffers.note!.raw);
    const settled = (await opRecords(page))[0], draft = (await draftRecords(page))[0];
    expect(settled).toMatchObject({ localPersistSequence: 2, frozen: operation.frozen });
    expect(draft).toMatchObject({ unresolvedOperation: false, operationId: null, localPersistSequence: before.localPersistSequence + 1 });
    expect(draft.snapshot.rawBuffers).toEqual({}); expect(draft.snapshot.draft.lines.map(line => line.clientLineId)).toEqual(before.snapshot.draft.lines.map(line => line.clientLineId));
    expect(first.writes).toHaveLength(1); expect(second.writes).toHaveLength(0);
    expect(firstStatus.calls()).toBe(1); expect(secondStatus.calls()).toBe(1); expect(first.reads).toHaveLength(0); expect(second.reads).toHaveLength(0);
    healthy(first); healthy(second); await secondPage.close();
  });
  test(`${stem} actual page close and reopen preserves UNKNOWN until a new explicit protected GET`, async ({ page, context }) => {
    const first = await setup(page, stem, "lost", { originalGrantOnly: true, rawNote: true });
    await unknown(first, page); const operation = (await opRecords(page))[0], before = (await draftRecords(page))[0];
    await page.close();
    const reopenedPage = await context.newPage(), reopened = await setup(reopenedPage, stem, "lost", { originalGrantOnly: true, seed: false });
    expect(await opRecords(reopenedPage)).toEqual([operation]); expect((await draftRecords(reopenedPage))[0]).toEqual(before);
    await expect(reopened.panel.getByLabel("Ghi chú", { exact: true })).toHaveValue(before.snapshot.draft.note ?? "");
    await expect(reopened.button).toBeDisabled(); expect(reopened.reads).toHaveLength(0); expect(reopened.writes).toHaveLength(0);
    await check(reopenedPage); await expect.poll(async () => (await opRecords(reopenedPage))[0].state).toBe("SETTLED");
    const draft = (await draftRecords(reopenedPage))[0];
    expect((await opRecords(reopenedPage))[0].frozen).toEqual(operation.frozen);
    expect(draft.snapshot.draft.lines.map(line => line.clientLineId)).toEqual(before.snapshot.draft.lines.map(line => line.clientLineId));
    if (stem === "receipt-post") { expect(draft.snapshot.postAcknowledgement?.status).toBe("Posted"); expect(draft.snapshot.postAcknowledgement).not.toHaveProperty("version"); }
    else expect(draft.snapshot.baseline?.version).toBe(fixture(`${stem}-response`).data.version);
    expect(first.writes).toHaveLength(1); expect(reopened.writes).toHaveLength(0); expect(reopened.reads).toHaveLength(1); expect(reopened.details).toEqual([]);
    healthy(first); healthy(reopened);
  });
  test(`${stem} network-aborted protected GET keeps the original checkpoint locked without replay`, async ({ page }) => {
    const s = await setup(page, stem, "lost", { originalGrantOnly: true, rawNote: true }), dialog = await unknown(s, page);
    const operation = (await opRecords(page))[0], before = (await draftRecords(page))[0]; let requests = 0;
    await page.route(`**/api/v1/operations/${operation.operationId}`, async route => { requests++; await route.abort("timedout"); });
    await dialog.getByRole("button", { name: "Kiểm tra kết quả", exact: true }).click();
    await expect(dialog.getByText("Chưa có bằng chứng đã hoàn tất; tiếp tục giữ khóa. Không tự gửi lại.", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Kiểm tra kết quả", exact: true })).toBeEnabled();
    expect(await opRecords(page)).toEqual([operation]); expect((await draftRecords(page))[0]).toEqual(before);
    await expect(dialog.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape"); await expect(s.button).toBeDisabled();
    expect(requests).toBe(1); expect(s.writes).toHaveLength(1); expect(s.reads).toHaveLength(0); expect(s.details).toEqual([]);
    healthy(s);
  });
}

test("workspace positive settlement transaction abort retains both protections and retries cached proof locally", async ({ page }) => {
  const s = await setup(page, "sales-create", "lost", { rawNote: true }), dialog = await unknown(s, page);
  const operation = (await opRecords(page))[0], before = (await draftRecords(page))[0];
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as Window & { web5RestorePut?: () => void }).web5RestorePut = () => { IDBObjectStore.prototype.put = original; };
    IDBObjectStore.prototype.put = function(...args: Parameters<IDBObjectStore["put"]>) {
      const request = original.apply(this, args);
      if (this.transaction.db.name === "mydmsvn-drafts-v1" && this.name === "operations" && args[0]?.state === "SETTLED") request.addEventListener("success", () => this.transaction.abort());
      return request;
    };
  });
  await dialog.getByRole("button", { name: "Kiểm tra kết quả", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Thử lại lưu cục bộ", exact: true })).toBeEnabled();
  await expect(dialog.getByText("Chưa lưu được bản nháp trên thiết bị", { exact: true })).toBeVisible();
  expect(await opRecords(page)).toEqual([operation]); expect((await draftRecords(page))[0]).toEqual(before);
  await page.keyboard.press("Escape"); await expect(s.button).toBeDisabled();
  expect(s.reads).toHaveLength(1); expect(s.writes).toHaveLength(1);
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  await page.evaluate(() => { (window as Window & { web5RestorePut?: () => void }).web5RestorePut!(); });
  await dialog.getByRole("button", { name: "Thử lại lưu cục bộ", exact: true }).click();
  await expect.poll(async () => (await opRecords(page))[0].state).toBe("SETTLED");
  expect((await opRecords(page))[0].frozen).toEqual(operation.frozen); expect(s.reads).toHaveLength(1); expect(s.writes).toHaveLength(1);
  healthy(s);
});
