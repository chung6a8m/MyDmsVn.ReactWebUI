import { test, expect } from "@playwright/test";
import { productionHttp } from "../e2e/helpers/durableDraftWorkspaceHttp";

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

test("compiled candidate binding gates manual resend for one UNKNOWN operation", async ({ page }) => {
  const server = await productionHttp(page);
  const candidateId = process.env.VITE_MYDMSVN_WEB6_CANDIDATE_ID;
  const candidateEnabled = candidateId === "web6-candidate-plan";
  const v3Reads: string[] = [];
  const identity = (request: import("@playwright/test").Request) => {
    const url = new URL(request.url()), operationId = url.pathname.split("/")[4], headers = request.headers();
    return {
      contractVersion: "web6-resend-eligibility-v1",
      candidateId: "web6-candidate-plan",
      deploymentEpoch: headers["x-mydmsvn-deployment-epoch"],
      actorUserId: 42,
      operationId,
      operationKind: headers["x-mydmsvn-operation-kind"],
      method: "POST",
      routeScope: "/api/v1/sales-receipts",
      requestTargetId: null,
      requestFingerprint: headers["x-mydmsvn-operation-fingerprint"],
    };
  };
  await page.route("**/api/v3/**", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    expect(request.method()).toBe("GET");
    v3Reads.push(path);
    const data = path === "/api/v3/operations/resend-context"
      ? { contractVersion: "web6-resend-eligibility-v1", candidateId: "web6-candidate-plan", deploymentEpoch: "11111111-2222-4333-8444-555555555555",
          actorUserId: 42, serverUtc: "2026-11-10T01:00:00.0000000Z", maximumEligibilitySeconds: 604800, eligibilityEnabled: true }
      : path.endsWith("/resend-receipt")
        ? { ...identity(request), issuedAtUtc: "2026-11-10T01:00:00.0000000Z", eligibleUntilUtc: "2026-11-17T01:00:00.0000000Z", receipt: "header.payload.signature" }
        : { ...identity(request), decision: "ALLOW", reason: "ORIGINAL_NOT_OBSERVED_RECEIPT_VALID",
            serverUtc: "2026-11-10T01:00:01.0000000Z", eligibleUntilUtc: "2026-11-17T01:00:00.0000000Z" };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) });
  });

  await page.getByRole("button", { name: "Sales mới", exact: true }).click();
  const panel = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  for (const label of ["Khách hàng", "Kho", "Nhân viên"]) {
    const input = panel.getByRole("combobox", { name: label, exact: true });
    await input.fill("1");
    await page.getByRole("listbox").getByRole("option").first().click();
    await input.press("Tab");
  }
  await panel.locator('.ag-row[row-index="0"] [col-id="product"]').dblclick();
  const product = panel.getByRole("combobox", { name: "Sản phẩm grid", exact: true });
  await product.fill("SP104");
  await page.getByRole("listbox").getByRole("option").first().click();
  await product.press("Tab");
  await panel.getByLabel("Ghi chú", { exact: true }).fill("Candidate binding UNKNOWN");
  await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  await expect(panel.getByText("Kết quả chưa rõ; phiên đang khóa để đối soát.", { exact: true })).toBeVisible();
  expect(server.businessWrites).toHaveLength(1);

  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const recovery = page.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
  const resend = recovery.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true });
  if (candidateEnabled) {
    await expect(resend).toBeEnabled();
    await resend.click();
    await expect(page.getByRole("dialog", { name: "Gửi lại đúng thao tác gốc?", exact: true })).toBeVisible();
    expect(v3Reads.filter(path => path === "/api/v3/operations/resend-context")).toHaveLength(2);
    expect(v3Reads.filter(path => path.endsWith("/resend-receipt"))).toHaveLength(1);
    expect(v3Reads.filter(path => path.endsWith("/resend-eligibility"))).toHaveLength(1);
  } else {
    await expect(resend).toBeDisabled();
    expect(v3Reads).toEqual([]);
  }
  expect(server.businessWrites).toHaveLength(1);
  expect(server.unexpected).toEqual([]);
});
