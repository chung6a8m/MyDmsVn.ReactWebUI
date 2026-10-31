import { test, expect } from "@playwright/test";

test("application entry never composes a fake workspace; Lab remount retains raw buffers", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Đăng nhập MyDmsVn", exact: true })).toBeVisible();
  await expect(page.getByRole("grid")).toHaveCount(0);
  await page.getByRole("link", { name: "Sales Lab", exact: true }).click();
  await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
  const panel = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
  const sessionId = await panel.getAttribute("data-session-id");
  await panel.getByRole("textbox", { name: "Ghi chú", exact: true }).fill("Lab raw survives application navigation");
  await page.getByRole("link", { name: "Ứng dụng", exact: true }).click();
  await expect(page.getByRole("grid")).toHaveCount(0);
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.type());
    await dialog.dismiss();
  });
  await page.evaluate(() => { window.setTimeout(() => window.location.reload(), 0); });
  await expect.poll(() => dialogs).toEqual(["beforeunload"]);
  await page.getByRole("link", { name: "Sales Lab", exact: true }).click();
  await expect(panel).toHaveAttribute("data-session-id", sessionId!);
  await expect(panel.getByRole("textbox", { name: "Ghi chú", exact: true })).toHaveValue("Lab raw survives application navigation");
  await expect(panel.getByText("Chưa lưu", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đóng tài liệu", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
  await page.getByRole("link", { name: "Ứng dụng", exact: true }).click();
  dialogs.length = 0;
  await page.reload();
  expect(dialogs).toEqual([]);
});

for (const scenario of ["delay", "commit-then-response-lost"] as const) {
  test(`Lab ${scenario} still warns on page exit while its workspace is unmounted`, async ({ page }) => {
    await page.goto(`/lab/sales?scenario=${scenario}`);
    await page.getByRole("button", { name: "Mở mẫu 1001", exact: true }).click();
    const panel = page.getByRole("region", { name: "Chứng từ 1001", exact: true });
    await panel.getByRole("textbox", { name: "Ghi chú", exact: true }).fill("Mutation retained across routes");
    await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
    const state = scenario === "delay" ? "Đang lưu chứng từ…" : "Kết quả chưa rõ; phiên đang khóa để đối soát.";
    await expect(panel.getByText(state, { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Ứng dụng", exact: true }).click();
    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => { dialogs.push(dialog.type()); await dialog.dismiss(); });
    await page.evaluate(() => { window.setTimeout(() => window.location.reload(), 0); });
    await expect.poll(() => dialogs).toEqual(["beforeunload"]);
    await page.getByRole("link", { name: "Sales Lab", exact: true }).click();
    await expect(panel.getByText(state, { exact: true })).toBeVisible();
  });
}
