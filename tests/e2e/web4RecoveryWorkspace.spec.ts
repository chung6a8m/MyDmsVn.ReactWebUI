import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fixture, epoch, opRecords, draftRecords, respond, restore, setup, check } from "./helpers/web4RecoveryWorkspaceSetup";
for (const stem of ["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"]) {
  test(`${stem} recovers after reload using only its original grant, original IDs and no Read permission`, async ({ page }) => {
    const s = await setup(page, stem, "lost", { originalGrantOnly: true }); await s.button.click();
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
    const dialog = await check(page); await expect(dialog.getByText(status === "expired" ? /Máy chủ đã ghi nhận thao tác nhưng kết quả gốc không còn dùng được/ : /Chưa có bằng chứng đã hoàn tất/)).toBeVisible();
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
  await check(page, "local"); await expect.poll(async () => (await opRecords(page))[0].state).toBe("SETTLED");
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
  await expect(dialog).not.toContainText(/Có nội dung chưa lưu máy chủ|Bản lưu cục bộ/);
  await dialog.getByRole("button", { name: "Mở bản nháp", exact: true }).click();
  await expect(dialog).toContainText("Chưa thể đọc hoặc xóa bản nháp");
  await expect(page.locator('section[data-session-id="sales-create"]')).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Xóa bản nháp này", exact: true })).toBeDisabled();
  expect(s.writes).toHaveLength(1); expect(s.reads).toHaveLength(0);
});

// WEB5 F01 checkpoint only: an unsupported context is a failure injection, not
// a proposed B02 version or proof of a real new-host deployment.
for (const stem of ["sales-create", "receipt-post"]) {
  test("WEB5 checkpoint " + stem + ": incompatible context preserves v1 UNKNOWN through compatible recovery", async ({ page }) => {
    const s = await setup(page, stem);
    await s.button.click();
    await expect(page.getByRole("button", { name: "Đối soát thao tác", exact: true })).toBeVisible();
    const originalOperation = (await opRecords(page))[0];
    const originalDraft = (await draftRecords(page)).find(record => record.localDocumentId === stem)!;
    expect(originalOperation).toMatchObject({ schemaVersion: 1, state: "DISPATCHED" });
    expect(originalDraft).toMatchObject({ unresolvedOperation: true, operationId: originalOperation.operationId });
    const contextRoute = "**/api/v1/operations/context";
    let rejectedContexts = 0;
    await page.route(contextRoute, route => {
      rejectedContexts++;
      return respond(route, { data: { actorUserId: 42, deploymentEpoch: epoch, contractVersion: "unsupported-contract" } });
    });

    await page.reload();
    await expect(page.getByRole("region", { name: "Đăng nhập", exact: true })).toBeVisible();
    expect(rejectedContexts).toBe(1);
    await expect(page.getByRole("toolbar", { name: "Workspace", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true })).toHaveCount(0);
    expect(await opRecords(page)).toEqual([originalOperation]);
    expect((await draftRecords(page)).find(record => record.localDocumentId === stem)).toEqual(originalDraft);
    expect(s.writes).toHaveLength(1);
    expect(s.reads).toEqual([]);
    expect(s.details).toEqual([]);

    // The fixture restores the original authenticated context on reload.
    // This is compatible v1 recovery, not strict WEB5 migration acceptance.
    await page.unroute(contextRoute);
    await page.reload();
    const panel = await restore(page, stem);
    await expect(panel.getByRole("button", {
      name: stem === "sales-create" ? "Lưu chứng từ" : "Post phiếu nhập", exact: true,
    })).toBeDisabled();
    expect(await opRecords(page)).toEqual([originalOperation]);
    expect(s.reads).toEqual([]);
    expect(s.writes).toHaveLength(1);
    await check(page);
    await expect.poll(async () => (await opRecords(page))[0].state).toBe("SETTLED");
    expect((await opRecords(page))[0].frozen).toEqual(originalOperation.frozen);
    const settledDraft = (await draftRecords(page)).find(record => record.localDocumentId === stem)!;
    expect(settledDraft.unresolvedOperation).toBe(false);
    expect(settledDraft.snapshot.draft.lines.map(line => line.clientLineId))
      .toEqual(originalDraft.snapshot.draft.lines.map(line => line.clientLineId));
    if (stem === "receipt-post") expect(settledDraft.snapshot.postAcknowledgement).not.toHaveProperty("version");
    expect(s.writes).toHaveLength(1);
    expect(s.reads).toHaveLength(1);
    expect(s.details).toEqual([]);
    expect(s.server.unexpected).toEqual([]);
    expect(s.server.errors.filter(value => !value.startsWith("Failed to load resource:"))).toEqual([]);
  });
}
