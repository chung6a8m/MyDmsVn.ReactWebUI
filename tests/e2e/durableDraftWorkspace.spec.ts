import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { productionHttp } from "./helpers/durableDraftWorkspaceHttp";
import type * as Harness from "./helpers/durableDraftWorkspaceHarness";
import { openDecimal } from "./decimal-helpers";

const harnessPath = "/tests/e2e/helpers/durableDraftWorkspaceHarness.ts";
async function records(page: Page) {
  return page.evaluate(async path => {
    const h: typeof Harness = await import(/* @vite-ignore */ path);
    return h.allRecords();
  }, harnessPath);
}
async function seed(page: Page, feature: "sales" | "goods-receipt", id: string, count = 1, composing = false) {
  await page.evaluate(async args => {
    const h: typeof Harness = await import(/* @vite-ignore */ args.path);
    await h.seed(h.localRecord(args.feature, args.id, args.count, args.composing));
  }, { path: harnessPath, feature, id, count, composing });
}
async function preview(page: Page) {
  await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Đang đọc bản nháp…", { exact: true })).toHaveCount(0);
  return dialog;
}
async function restore(page: Page, feature: "sales" | "goods-receipt") {
  const dialog = await preview(page);
  const item = dialog.locator("li").filter({ hasText: feature === "sales" ? "Sales ·" : "Phiếu nhập ·" });
  await item.getByRole("button", { name: "Mở bản nháp", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const panel = page.locator(`section[data-session-id][aria-label^="${feature === "sales" ? "Chứng từ" : "Phiếu nhập"}"]`).filter({ visible: true });
  await expect(panel).toBeVisible();
  return panel;
}
function healthy(server: Awaited<ReturnType<typeof productionHttp>>) {
  expect(server.errors).toEqual([]);
  expect(server.unexpected).toEqual([]);
  expect(server.businessWrites).toEqual([]);
}

for (const feature of ["sales", "goods-receipt"] as const) {
  test(`${feature} restored composition marker clears only after fresh ordinary typing`, async ({ page }) => {
    const server = await productionHttp(page), id = `${feature}-composing`;
    await seed(page, feature, id, 1, true);
    const panel = await restore(page, feature), note = panel.getByLabel("Ghi chú", { exact: true });
    await expect(note).toHaveValue("Nội dung cục bộ ệ  ");
    expect((await records(page)).find(record => record.localDocumentId === id)?.snapshot.rawBuffers.note.composing).toBe(true);
    await note.press("End"); await note.pressSequentially(" mới");
    await expect.poll(async () => (await records(page)).find(record => record.localDocumentId === id)?.snapshot.rawBuffers.note).toEqual({ raw: "Nội dung cục bộ ệ   mới", composing: false });
    healthy(server);
  });
}

test("Receipt date clears a restored unfinished composition marker on a fresh edit", async ({ page }) => {
  const server = await productionHttp(page), id = "receipt-composing-date";
  await page.evaluate(async args => {
    const h: typeof Harness = await import(/* @vite-ignore */ args.path);
    const record = h.localRecord("goods-receipt", args.id);
    record.snapshot.rawBuffers.receiptDate = { raw: "ngày đang gõ", composing: true };
    await h.seed(record);
  }, { path: harnessPath, id });
  const panel = await restore(page, "goods-receipt"), date = panel.getByLabel("Ngày nhập", { exact: true });
  await expect(date).toHaveValue("ngày đang gõ");
  expect((await records(page)).find(record => record.localDocumentId === id)?.snapshot.rawBuffers.receiptDate.composing).toBe(true);
  await date.fill("2026-11-03");
  await expect.poll(async () => (await records(page)).find(record => record.localDocumentId === id)?.snapshot.rawBuffers.receiptDate).toEqual({ raw: "2026-11-03", composing: false });
  healthy(server);
});

test("Sales key-by-key invalid raw and unconfirmed lookup survive reload and explicit restore", async ({ page }) => {
  const server = await productionHttp(page);
  await page.getByRole("button", { name: "Sales mới", exact: true }).click();
  const panel = page.locator('section[aria-label="Chứng từ mới"]');
  const date = panel.getByLabel("Ngày chứng từ", { exact: true });
  await date.fill(""); await date.pressSequentially("ngày chưa hợp lệ  ");
  const customer = panel.getByRole("combobox", { name: "Khách hàng", exact: true });
  await customer.fill(""); await customer.pressSequentially("khách gõ dở  ");
  await panel.getByLabel("Ghi chú", { exact: true }).fill("Bản riêng của tôi ệ  ");
  const id = await panel.getAttribute("data-session-id");
  await expect.poll(async () => (await records(page)).find(record => record.localDocumentId === id)?.snapshot.lookupBuffers.customerId?.query).toBe("khách gõ dở  ");
  await expect.poll(async () => (await records(page)).find(record => record.localDocumentId === id)?.snapshot.rawBuffers.note?.raw).toBe("Bản riêng của tôi ệ  ");
  await page.reload();
  await expect(page.getByRole("button", { name: "Sales mới", exact: true })).toBeEnabled();
  await expect(page.locator('section[aria-label="Chứng từ mới"]')).toHaveCount(0);
  const restored = await restore(page, "sales");
  await expect(restored.getByLabel("Ngày chứng từ", { exact: true })).toHaveValue("ngày chưa hợp lệ  ");
  await expect(restored.getByRole("combobox", { name: "Khách hàng", exact: true })).toHaveValue("khách gõ dở  ");
  await expect(restored.getByLabel("Ghi chú", { exact: true })).toHaveValue("Bản riêng của tôi ệ  ");
  expect((await records(page)).find(record => record.localDocumentId === id)?.snapshot.lookupBuffers.customerId?.confirmed).toBe(false);
  expect(JSON.stringify(await records(page))).not.toMatch(/accessToken|refreshToken|Bearer|capabilities|actorGeneration/);
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await page.screenshot({ path: join(tmpdir(), `web4-durable-restore-${test.info().project.name}.png`), fullPage: false });
  healthy(server);
});

for (const feature of ["sales", "goods-receipt"] as const) {
  test(`${feature} restores 200 native IndexedDB lines with stable IDs and exact invalid raw`, async ({ page }) => {
    const server = await productionHttp(page), id = `${feature}-200-lines`;
    await page.evaluate(async args => {
      const h: typeof Harness = await import(/* @vite-ignore */ args.path);
      const record = h.localRecord(args.feature, args.id, 200);
      const line = record.snapshot.draft.lines[0].clientLineId;
      record.snapshot.rawBuffers[`${args.feature === "sales" ? "qty" : "quantity"}:${line}`] = { raw: "1e3  ", composing: false };
      await h.seed(record);
    }, { path: harnessPath, feature, id });
    const panel = await restore(page, feature);
    await expect(panel.getByText(/^200 dòng/)).toBeVisible();
    if (feature === "sales") await expect(await openDecimal(panel, "qty")).toHaveValue("1e3  ");
    else {
      await panel.locator('.ag-row[row-index="0"] [col-id="quantity"]').dblclick();
      await expect(panel.getByRole("textbox", { name: "Số lượng dòng 1", exact: true })).toHaveValue("1e3  ");
    }
    const previousSequence = (await records(page)).find(record => record.localDocumentId === id)!.localPersistSequence;
    await panel.getByLabel("Ghi chú", { exact: true }).fill("Chỉnh mới sau khôi phục 200 dòng");
    await expect.poll(async () => (await records(page)).find(record => record.localDocumentId === id)?.snapshot.rawBuffers.note.raw).toBe("Chỉnh mới sau khôi phục 200 dòng");
    const persisted = (await records(page)).find(record => record.localDocumentId === id)!;
    expect(persisted.localPersistSequence).toBeGreaterThan(previousSequence);
    expect(persisted.snapshot.draft.lines).toHaveLength(200);
    expect(new Set(persisted.snapshot.draft.lines.map(line => line.clientLineId)).size).toBe(200);
    expect(persisted.snapshot.draft.lines[199].clientLineId).toBe(feature === "sales" ? "sales-line-199" : "receipt-line-199");
    healthy(server);
  });
}

test("same user in a replacement database and another actor cannot preview prior drafts", async ({ page }) => {
  const server = await productionHttp(page);
  await seed(page, "sales", "private-old-owner");
  server.owner.deploymentEpoch = "7c3baa58-9721-47ee-a1ac-88fc37c06e51";
  await page.reload();
  let dialog = await preview(page);
  await expect(dialog.getByRole("button", { name: "Mở bản nháp", exact: true })).toHaveCount(0);
  await expect(dialog.locator("li")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Nội dung cục bộ ệ");
  await expect(page.locator("body")).not.toContainText("private-old-owner");
  expect((await records(page)).map(record => record.localDocumentId)).toEqual(["private-old-owner"]);
  server.owner.deploymentEpoch = "11111111-2222-4333-8444-555555555555"; server.owner.actorUserId = 43;
  await page.reload(); dialog = await preview(page);
  await expect(dialog.getByRole("button", { name: "Mở bản nháp", exact: true })).toHaveCount(0);
  await expect(dialog.locator("li")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Nội dung cục bộ ệ");
  await expect(page.locator("body")).not.toContainText("private-old-owner");
  expect((await records(page)).map(record => record.localDocumentId)).toEqual(["private-old-owner"]);
  server.owner.actorUserId = 42;
  await page.reload();
  await expect((await restore(page, "sales")).getByLabel("Ghi chú", { exact: true })).toHaveValue("Nội dung cục bộ ệ  ");
  healthy(server);
});

test("quota keeps RAM, blocks server writes, warns before copying and retries only local persistence", async ({ page, context }) => {
  const server = await productionHttp(page);
  await seed(page, "sales", "quota-document");
  const panel = await restore(page, "sales"), note = panel.getByLabel("Ghi chú", { exact: true });
  await page.evaluate(() => { (window as Window & { web4Quota?: boolean }).web4Quota = true; });
  await note.fill("RAM chưa lưu khi hết dung lượng");
  await expect(page.getByText("Chưa lưu được bản nháp trên thiết bị", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  await expect(note).toHaveValue("RAM chưa lưu khi hết dung lượng");
  expect(server.businessWrites).toEqual([]);
  const dialog = await preview(page);
  await expect(dialog.getByRole("alert").filter({ hasText: "Giữ nguyên trang" })).toBeVisible();
  const copy = dialog.getByRole("button", { name: "Sao chép bản nháp đang mở", exact: true });
  await expect(copy).toBeDisabled();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await dialog.getByRole("checkbox").check(); await expect(copy).toBeEnabled(); await copy.click();
  await expect(dialog.getByText("Đã sao chép bản nháp đang mở.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("RAM chưa lưu khi hết dung lượng");
  await page.evaluate(() => { (window as Window & { web4Quota?: boolean }).web4Quota = false; });
  await dialog.getByRole("button", { name: "Thử lại lưu cục bộ", exact: true }).click();
  await expect(dialog.getByText("Đã lưu bản nháp trên thiết bị", { exact: true })).toBeVisible();
  expect((await records(page)).find(record => record.localDocumentId === "quota-document")?.snapshot.rawBuffers.note.raw).toBe("RAM chưa lưu khi hết dung lượng");
  healthy(server);
});

test("a newer native IndexedDB revision prevents close Discard and keeps the open raw text", async ({ page, context }) => {
  const server = await productionHttp(page);
  await seed(page, "sales", "close-cas");
  const panel = await restore(page, "sales"), note = panel.getByLabel("Ghi chú", { exact: true });
  await note.fill("RAM còn nguyên khi đóng thất bại");
  await expect.poll(async () => (await records(page)).find(record => record.localDocumentId === "close-cas")?.snapshot.rawBuffers.note.raw).toBe("RAM còn nguyên khi đóng thất bại");
  const competitor = await context.newPage(); await competitor.goto("/favicon.svg");
  await competitor.evaluate(async path => {
    const h: typeof Harness = await import(/* @vite-ignore */ path); await h.compete("close-cas");
  }, harnessPath);
  await competitor.close();
  await page.getByRole("button", { name: "Đóng tài liệu", exact: true }).click();
  await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
  await expect(note).toHaveValue("RAM còn nguyên khi đóng thất bại");
  await expect(panel).toBeVisible();
  await expect.poll(async () => (await records(page)).find(record => record.localDocumentId === "close-cas")?.snapshot.rawBuffers.note.raw).toBe("Bản đã lưu ở tab khác");
  healthy(server);
});

test("draft list can retry storage access without an open document", async ({ page }) => {
  const server = await productionHttp(page, { storageDenied: true });
  const dialog = await preview(page);
  await expect(dialog.getByText(/Chưa thể đọc hoặc xóa bản nháp/)).toBeVisible();
  await expect(dialog.getByRole("region", { name: "Bản nháp đang mở", exact: true })).toHaveCount(0);
  await page.evaluate(() => { (window as Window & { web4ReadDenied?: boolean }).web4ReadDenied = false; });
  await seed(page, "sales", "recovered-storage-without-document");
  await dialog.getByRole("button", { name: "Đọc lại danh sách", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Mở bản nháp", exact: true })).toHaveCount(1);
  await expect(page.locator("section[data-session-id]")).toHaveCount(0);
  healthy(server);
});
