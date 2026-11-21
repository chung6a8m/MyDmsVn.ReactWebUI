import { test, expect } from "@playwright/test";

test("DEV Lab read feedback preserves new filter when an older request completes", async ({ page }) => {
  await page.goto("/lab/components");
  const gallery = page.locator("[data-testid='lab-read-states']");
  await page.locator("summary").filter({ hasText: "ReadState · filters" }).click();
  await expect(gallery).toBeVisible();
  const filter = gallery.getByRole("textbox", { name: "Bộ lọc mẫu" });
  await gallery.getByRole("button", { name: "Lỗi", exact: true }).click();
  await expect(gallery.locator("[data-read-state='loading']")).toBeVisible();
  await filter.fill("Bộ lọc mới");
  await expect(gallery.locator("[data-read-state='initial']")).toBeVisible();
  await page.waitForTimeout(550);
  await expect(gallery.locator("[data-read-state='error']")).toHaveCount(0);
  await gallery.getByRole("button", { name: "Lỗi", exact: true }).click();
  await expect(gallery.locator("[data-read-state='error']")).toBeVisible();
  await gallery.getByRole("button", { name: "Thử đọc lại", exact: true }).click();
  await expect(gallery.getByText("Kết quả của bộ lọc: Bộ lọc mới")).toBeVisible();

  await gallery.getByRole("button", { name: "outcome-unknown" }).click();
  await expect(gallery.getByText(/không tự gửi lại/)).toBeVisible();
  await expect(gallery.locator("[data-mutation-state='outcome-unknown'] button")).toHaveCount(0);
});
