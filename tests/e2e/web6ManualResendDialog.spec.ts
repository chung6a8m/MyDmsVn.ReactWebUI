import { expect, test, type Page } from "@playwright/test";
import type * as Harness from "./helpers/web6RecoverySupportHarness";

const harness = "/tests/e2e/helpers/web6RecoverySupportHarness.tsx";
const snapshot = (page: Page) =>
  page.evaluate(async path => ((await import(/* @vite-ignore */ path)) as typeof Harness).snapshot(), harness);

test("manual resend dialog requires active confirmation and consumes double click once", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async path => ((await import(/* @vite-ignore */ path)) as typeof Harness).mount(), harness);
  const resend = page.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true });
  await resend.click();
  const dialog = page.getByRole("dialog", { name: "Gửi lại đúng thao tác gốc?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Hủy" })).toBeFocused();
  expect((await snapshot(page)).confirm).toBe(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0); await expect(resend).toBeFocused();
  expect((await snapshot(page)).confirm).toBe(0);
  await resend.click();
  const confirm = dialog.getByRole("button", { name: "Xác nhận gửi thao tác gốc" });
  await confirm.dispatchEvent("compositionstart");
  await confirm.press("Enter");
  expect((await snapshot(page)).confirm).toBe(0);
  await confirm.dispatchEvent("compositionend");
  await confirm.dblclick();
  await expect(page.getByRole("button", { name: "Quyền gửi lại đã dùng" })).toBeDisabled();
  expect((await snapshot(page)).confirm).toBe(1);
});
