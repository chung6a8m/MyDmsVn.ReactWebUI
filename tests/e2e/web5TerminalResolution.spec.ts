import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setupResolution } from "./helpers/web5TerminalResolutionSetup";
import { opRecords, draftRecords } from "./helpers/web4RecoveryWorkspaceSetup";
const commands = ["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"];

for (const stem of commands) test(`${stem}: exact negative commits both stores, preserves raw draft and requires review`, async ({ page }) => {
  const f = await setupResolution(page, stem);
  await f.button.click();
  await expect.poll(async () => (await opRecords(page))[0]?.state).toBe("DISPATCHED");
  const before = (await draftRecords(page))[0], frozen = (await opRecords(page))[0].frozen;
  expect(f.resolutionReads).toHaveLength(0);
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
  await dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true }).click();
  await expect.poll(async () => (await opRecords(page))[0]?.state).toBe("NOT_EXECUTED");
  await expect(dialog.getByText("Máy chủ đã xác nhận thao tác gốc không được thực hiện.", { exact: true })).toBeVisible();
  const after = (await draftRecords(page))[0];
  expect(after.unresolvedOperation).toBe(false);
  expect(after.operationId).toBeNull();
  expect(after.snapshot).toEqual(before.snapshot);
  expect((await opRecords(page))[0].frozen).toEqual(frozen);
  expect(f.writes).toHaveLength(1);
  expect(f.resolutionReads).toHaveLength(1);
  expect(f.details).toHaveLength(0);
  if (["sales-create", "receipt-post"].includes(stem)) {
    await page.setViewportSize(stem === "sales-create" ? { width: 1280, height: 720 } : { width: 1440, height: 900 });
    if (stem === "receipt-post") { await page.keyboard.press("Escape"); await page.getByRole("button", { name: "Dark", exact: true }).click(); await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click(); }
    await page.screenshot({ animations: "disabled", path: join(tmpdir(), `web5-terminal-${stem}-${test.info().project.name}.png`) });
  }
  await page.keyboard.press("Escape");
  await expect(f.button).toBeDisabled();
});

for (const stem of ["sales-create", "receipt-create"]) test(`${stem}: a reviewed new intent needs explicit consent and a separate Save`, async ({ page }) => {
  const f = await setupResolution(page, stem);
  await f.button.click();
  await expect.poll(async () => (await opRecords(page))[0]?.state).toBe("DISPATCHED");
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
  await dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true }).click();
  const confirm = dialog.getByRole("button", { name: "Xác nhận giữ nội dung và tạo ý định mới", exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("checkbox", { name: "Tôi đã xem lại nội dung được giữ và muốn bắt đầu một ý định mới cho chứng từ mới này.", exact: true }).check();
  await confirm.click();
  expect(f.writes).toHaveLength(1);
  await page.keyboard.press("Escape");
  await expect(f.button).toBeEnabled();
  const completedSecondWrite = page.waitForResponse(response => new URL(response.url()).pathname === f.writes[0].path &&
    response.request().method() !== "GET" && response.request().headers()["idempotency-key"] !== f.writes[0].key);
  await f.button.click();
  await expect.poll(() => f.writes.length).toBe(2);
  await completedSecondWrite;
  expect(f.writes[1].key).not.toBe(f.writes[0].key);
  expect(f.writes[1].body).toEqual(f.writes[0].body);
});

for (const stem of ["sales-create", "receipt-post"]) test(`${stem}: negative storage quota retains UNKNOWN and cached retry performs no HTTP`, async ({ page }) => {
  const f = await setupResolution(page, stem);
  await f.button.click();
  await expect.poll(async () => (await opRecords(page))[0]?.state).toBe("DISPATCHED");
  await page.evaluate(() => { (window as Window & { web4Quota?: boolean }).web4Quota = true; });
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
  await dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Thử lại lưu cục bộ", exact: true })).toBeEnabled();
  expect((await opRecords(page))[0].state).toBe("DISPATCHED");
  expect((await draftRecords(page))[0].unresolvedOperation).toBe(true);
  await page.evaluate(() => { (window as Window & { web4Quota?: boolean }).web4Quota = false; });
  await dialog.getByRole("button", { name: "Thử lại lưu cục bộ", exact: true }).click();
  await expect.poll(async () => (await opRecords(page))[0]?.state).toBe("NOT_EXECUTED");
  expect(f.resolutionReads).toHaveLength(1);
  expect(f.reads).toHaveLength(0);
  expect(f.writes).toHaveLength(1);
});

for (const stem of commands) test(`${stem}: v2 recovers the original committed result with ordinary Read denied`, async ({ page }) => {
  const f = await setupResolution(page, stem); f.setResolutionState("committed");
  await f.button.click();
  await expect.poll(async () => (await opRecords(page))[0]?.state).toBe("DISPATCHED");
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
  await dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true }).click();
  await expect.poll(async () => (await opRecords(page))[0]?.state).toBe("SETTLED");
  expect((await draftRecords(page))[0].unresolvedOperation).toBe(false);
  expect(f.writes).toHaveLength(1); expect(f.resolutionReads).toHaveLength(1); expect(f.reads).toHaveLength(0); expect(f.details).toHaveLength(0);
  const settled = (await opRecords(page))[0];
  if (settled.state !== "SETTLED") throw new Error("Expected an exact committed settlement.");
  if (stem === "receipt-post") expect(Object.hasOwn(settled.settlement, "version")).toBe(false);
  if (stem === "sales-post") expect(settled.settlement.version).toBeTruthy();
});

for (const stem of ["sales-create", "receipt-post"]) for (const state of ["404", "indeterminate", "result-expired", "result-unavailable"]) {
  test(`${stem}: v2 ${state} keeps both stores and the original intent protected`, async ({ page }) => {
    const f = await setupResolution(page, stem); f.setResolutionState(state);
    await f.button.click();
    await expect.poll(async () => (await opRecords(page))[0]?.state).toBe("DISPATCHED");
    const before = (await draftRecords(page))[0];
    await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
    await dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true })).toBeEnabled();
    expect((await opRecords(page))[0].state).toBe("DISPATCHED"); expect((await draftRecords(page))[0]).toEqual(before);
    expect(f.writes).toHaveLength(1); expect(f.resolutionReads).toHaveLength(1); expect(f.details).toHaveLength(0);
    await expect(dialog.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Mở khóa thao tác", exact: true })).toBeDisabled();
  });
}

for (const stem of ["sales-create", "receipt-create"]) test(`${stem}: an explicit server permission denial revokes prior negative authority`, async ({ page }) => {
  const f = await setupResolution(page, stem);
  await f.button.click();
  await expect.poll(async () => (await opRecords(page))[0]?.state).toBe("DISPATCHED");
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
  await dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true }).click();
  const confirm = dialog.getByRole("button", { name: "Xác nhận giữ nội dung và tạo ý định mới", exact: true });
  await dialog.getByRole("checkbox", { name: "Tôi đã xem lại nội dung được giữ và muốn bắt đầu một ý định mới cho chứng từ mới này.", exact: true }).check();
  await expect(confirm).toBeEnabled();
  f.setResolutionState("403");
  await dialog.getByRole("button", { name: "Xác minh lại quyết định", exact: true }).click();
  await expect(dialog).toContainText("Quyết định đã lưu chưa được xác minh lại trong phiên hiện tại");
  await expect(confirm).toBeDisabled();
  expect(f.writes).toHaveLength(1); expect(f.details).toHaveLength(0);
  f.setResolutionState("not-executed");
  await dialog.getByRole("button", { name: "Xác minh lại quyết định", exact: true }).click();
  await expect(confirm).toBeEnabled();
  expect(f.writes).toHaveLength(1);
});
