import { test, expect } from "@playwright/test";

test("production entry has no fake workspace, actor or Lab routes", async ({ page }) => {
  // Static artifact preview has no HTTP host. Model an unauthenticated response;
  // cookie/CSRF enforcement is tested separately on the IIS candidate.
  await page.route("**/api/v1/auth/refresh", route => route.fulfill({
    status: 401, contentType: "application/json",
    body: JSON.stringify({ error: { code: "Auth.Unauthorized", message: "Đăng nhập lại.", details: [] } }),
  }));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.location().url.endsWith("/api/v1/auth/refresh") && message.text().includes("401")) return;
    if (["error", "warning"].includes(message.type())) errors.push(message.text());
  });
  for (const route of ["/", "/lab/sales?scenario=success", "/lab/components"]) {
    await page.goto(route);
    await expect(page).toHaveTitle("MyDmsVn Web UI");
    await expect(page.getByRole("heading", { name: "MyDmsVn", exact: true })).toBeVisible();
    if (route === "/") await expect(page.getByRole("heading", { name: "Đăng nhập MyDmsVn", exact: true })).toBeVisible();
    else await expect(page.getByText("Không tìm thấy trang.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Lab/ })).toHaveCount(0);
    await expect(page.getByRole("grid")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Mở mẫu|Sales mới|Receipt stub|kho stub/ })).toHaveCount(0);
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  }
  await page.getByRole("link", { name: "Ứng dụng", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:5174/");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-ag-theme-mode", "dark");
  expect(errors).toEqual([]);
});
