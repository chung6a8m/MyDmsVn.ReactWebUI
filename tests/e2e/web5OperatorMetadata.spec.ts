import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setup, epoch, opRecords, restore, respond } from "./helpers/web4RecoveryWorkspaceSetup";
function healthy(s: Awaited<ReturnType<typeof setup>>) {
  expect(s.server.unexpected).toEqual([]);
  expect(s.server.errors.filter(value => !value.startsWith("Failed to load resource:"))).toEqual([]);
}

for (const stem of ["sales-create", "receipt-post"]) {
  test(`${stem} UNKNOWN exposes only identifiers, disabled actions and keyboard focus return`, async ({ page }) => {
    await page.setViewportSize(stem === "sales-create" ? { width: 1280, height: 720 } : { width: 1440, height: 900 });
    const s = await setup(page, stem); await s.button.click();
    if (stem === "receipt-post") await page.getByRole("button", { name: "Dark", exact: true }).click();
    const opener = page.getByRole("button", { name: "Đối soát thao tác", exact: true }); await opener.click();
    const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
    const metadata = dialog.getByRole("region", { name: "Thông tin hỗ trợ đối soát" });
    await expect(metadata).toContainText("UNKNOWN"); await expect(metadata).toContainText((await opRecords(page))[0].operationId);
    await expect(metadata).toContainText(epoch); await expect(metadata).toContainText("chưa xác minh");
    const resend = metadata.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true });
    await expect(resend).toBeDisabled(); await expect(metadata.getByRole("button", { name: "Mở khóa thao tác" })).toBeDisabled();
    await expect(resend).toHaveAccessibleDescription(/Chưa có xác nhận có thẩm quyền/);
    await metadata.getByLabel("Thông tin hỗ trợ chỉ gồm mã định danh").focus();
    await page.keyboard.press("Tab"); await expect(metadata.getByRole("button", { name: "Sao chép thông tin hỗ trợ" })).toBeFocused();
    await page.keyboard.press("Tab"); await expect(dialog.getByRole("button", { name: "Kiểm tra kết quả", exact: true })).toBeFocused();
    await page.screenshot({ path: join(tmpdir(), `web5-metadata-${stem}-${test.info().project.name}.png`) });
    await page.keyboard.press("Escape"); await expect(opener).toBeFocused();
    await page.keyboard.press("Enter"); await expect(dialog).toBeVisible();
    expect(s.writes).toHaveLength(1); expect(s.reads).toHaveLength(0); expect(s.details).toEqual([]);
    healthy(s);
  });
}
for (const status of ["404", "expired"]) {
  test(`${status} keeps UNKNOWN metadata protected and treats correlation as lookup only`, async ({ page }) => {
    const s = await setup(page, "sales-create"); await s.button.click(); s.setStatus(status);
    await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
    await dialog.getByRole("button", { name: "Kiểm tra kết quả", exact: true }).click();
    await expect(dialog).toContainText("Chưa có bằng chứng đã hoàn tất");
    await expect(dialog).toContainText("chưa có xác nhận đã tạo phiếu hỗ trợ");
    if (status === "404") await expect(dialog).toContainText("Mã tương quan: recovery-case-1");
    await expect(dialog.getByRole("button", { name: "Thử lại lưu cục bộ", exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true })).toBeDisabled();
    expect((await opRecords(page))[0].state).toBe("DISPATCHED"); expect(s.writes).toHaveLength(1); expect(s.reads).toHaveLength(1);
    healthy(s);
  });
}
test("cached proof exposes only strict local retry and does not offer a status GET", async ({ page }) => {
  const s = await setup(page, "sales-create", "quota"); await s.button.click();
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
  await expect(dialog.getByRole("button", { name: "Thử lại lưu cục bộ", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Kiểm tra kết quả", exact: true })).toHaveCount(0);
  await page.evaluate(() => { (window as Window & { web4Quota?: boolean }).web4Quota = false; });
  await dialog.getByRole("button", { name: "Thử lại lưu cục bộ", exact: true }).click();
  await expect.poll(async () => (await opRecords(page))[0].state).toBe("SETTLED");
  expect(s.writes).toHaveLength(1); expect(s.reads).toHaveLength(0);
  healthy(s);
});
test("reload without cached proof has GET but no local retry", async ({ page }) => {
  const s = await setup(page, "sales-create", "quota"); await s.button.click();
  await expect(page.getByRole("button", { name: "Đối soát thao tác", exact: true })).toBeVisible();
  await page.reload(); await restore(page, "sales-create");
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
  await expect(dialog.getByRole("button", { name: "Thử lại lưu cục bộ", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Kiểm tra kết quả", exact: true })).toBeEnabled();
  expect(s.reads).toHaveLength(0); expect(s.writes).toHaveLength(1);
  healthy(s);
});
test("unsupported draft exposes only validated primary-key UUIDs, never raw value content", async ({ page }) => {
  const s = await setup(page, "sales-create");
  const id = "22222222-2222-4222-8222-222222222222";
  await page.evaluate(async input => {
    const path = "/tests/e2e/helpers/web4OperationRepositoryHarness.ts";
    const h: typeof import("./helpers/web4OperationRepositoryHarness") = await import(/* @vite-ignore */ path);
    await h.rawPut("mydmsvn-drafts-v1", "drafts", [input.epoch, "42", "sales", input.id], { schemaVersion: 99, localDocumentId: "secret-raw-value", snapshot: "secret-business" });
    await h.rawPut("mydmsvn-drafts-v1", "drafts", [input.epoch, "42", "sales", "private-customer-name"], { schemaVersion: 99, snapshot: "secret-business" });
    await h.rawPut("mydmsvn-drafts-v1", "drafts", [input.epoch, "42", "secret-invalid-feature"], { schemaVersion: 99, snapshot: "secret-business" });
    await h.rawPut("mydmsvn-drafts-v1", "drafts", [input.epoch, "43", "sales", "33333333-3333-4333-8333-333333333333"], { schemaVersion: 99 });
  }, { id, epoch });
  await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
  await expect(dialog).toContainText(`Mã bản nháp: ${id}`); await expect(dialog).toContainText("phiên bản chưa được hỗ trợ");
  await expect(dialog).toContainText("Không có mã định danh an toàn để hiển thị");
  await expect(dialog).not.toContainText("secret"); await expect(dialog).not.toContainText("private-customer-name"); await expect(dialog).not.toContainText("33333333-3333-4333-8333-333333333333");
  expect(s.writes).toHaveLength(0); expect(s.reads).toHaveLength(0);
  healthy(s);
});
test("original grant revoke with ordinary Read hides metadata immediately, actor switch cannot expose it", async ({ page }) => {
  const s = await setup(page, "receipt-post"); await s.button.click();
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const id = (await opRecords(page))[0].operationId;
  await expect(page.getByRole("dialog")).toContainText(id);
  await page.route("**/api/v1/auth/capabilities*", route => respond(route, { data: { read: true, write: true, post: false } }));
  await page.evaluate(async () => { const path = "/src/app/runtime/browserAuth.ts"; const h: typeof import("../../src/app/runtime/browserAuth") = await import(/* @vite-ignore */ path); await h.getBrowserAuth().loadFeatureCapabilities("goods-receipt"); });
  await expect(page.getByRole("dialog")).not.toContainText(id);
  await expect(page.getByRole("button", { name: "Đối soát thao tác", exact: true })).toHaveCount(0);
  s.server.owner.actorUserId = 43;
  await page.evaluate(async () => { const path = "/src/app/runtime/browserAuth.ts"; const h: typeof import("../../src/app/runtime/browserAuth") = await import(/* @vite-ignore */ path); await h.getBrowserAuth().refresh(); });
  await expect(page.getByRole("toolbar", { name: "Workspace", exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(id);
  expect(s.writes).toHaveLength(1); expect(s.reads).toHaveLength(0);
  healthy(s);
});
