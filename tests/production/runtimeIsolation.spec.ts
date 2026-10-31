import { test, expect } from "@playwright/test";

test("production entry has no fake workspace, actor or Lab routes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) errors.push(message.text());
  });
  for (const route of ["/", "/lab/sales?scenario=success", "/lab/components"]) {
    await page.goto(route);
    await expect(page).toHaveTitle("MyDmsVn Web UI");
    await expect(page.getByRole("heading", { name: "MyDmsVn", exact: true })).toBeVisible();
    await expect(page.getByText(route === "/" ? "Ứng dụng chưa được kết nối" : "Không tìm thấy trang.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Lab/ })).toHaveCount(0);
    await expect(page.getByRole("grid")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Mở mẫu|Chứng từ mới/ })).toHaveCount(0);
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  }
  await page.getByRole("link", { name: "Ứng dụng", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:5174/");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-ag-theme-mode", "dark");
  expect(errors).toEqual([]);
});
