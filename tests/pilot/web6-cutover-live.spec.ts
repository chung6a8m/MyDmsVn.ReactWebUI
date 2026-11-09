import { expect, test, type Locator, type Page } from "@playwright/test";
import { randomInt } from "node:crypto";
import { connectPilotPipe } from "./pilot-pipe-connect";
import { manifest, readStore, recordWeb6Check, type DurableOperationRecord } from "./web4-helpers";

type CutoverAction =
  | "oldClientNewHostOn" | "oldClientNewHostOff"
  | "newClientOldHostOn" | "newClientOldHostOff"
  | "sameEpochRestart" | "revokeGrantOn" | "revokeGrantOff"
  | "restoreEpoch" | "committedUnavailable" | "verifyNoCutoverMutation";

if (manifest.mode !== "web6-candidate" || !manifest.cutover) {
  throw Error("Backend-owned WEB6 cutover handles are required.");
}
const cutover = manifest.cutover;

async function cutoverControl(action: CutoverAction, operationId?: string) {
  const id = randomInt(1, 2147483647);
  const payload = Buffer.from(JSON.stringify({ id, token: manifest.recovery.controlToken, action,
    ...(operationId === undefined ? {} : { operationId }) }), "utf8");
  const prefix = Buffer.alloc(4); prefix.writeInt32LE(payload.length);
  const socket = await connectPilotPipe(manifest.recovery.controlPipe);
  return new Promise<{ deploymentEpoch?: string; marker?: string }>((resolve, reject) => {
    let bytes = Buffer.alloc(0), settled = false;
    const fail = () => { if (!settled) { settled = true; reject(Error("Owned WEB6 cutover control failed.")); } socket.destroy(); };
    socket.setTimeout(15_000, fail); socket.on("error", fail); socket.on("end", () => { if (!settled) fail(); });
    socket.write(Buffer.concat([prefix, payload]));
    socket.on("data", chunk => {
      bytes = Buffer.concat([bytes, chunk]); if (bytes.length < 4) return;
      const length = bytes.readInt32LE(0); if (length < 2 || length > 4096 || bytes.length < length + 4) return length < 2 || length > 4096 ? fail() : undefined;
      try {
        const reply = JSON.parse(bytes.subarray(4, length + 4).toString("utf8"));
        if (reply.id !== id || reply.ok !== true) return fail();
        settled = true; resolve({ deploymentEpoch: reply.deploymentEpoch, marker: reply.marker }); socket.end();
      } catch { fail(); }
    });
  });
}

async function select(page: Page, panel: Locator, label: string, code: string) {
  const input = panel.getByRole("combobox", { name: label, exact: true });
  await input.fill(""); await input.pressSequentially(code);
  await page.getByRole("listbox").getByRole("option").filter({ hasText: new RegExp(`^${code} ·`) }).click();
  await input.press("Tab");
}

async function decimal(panel: Locator, column: string, label: string, text: string) {
  await panel.locator(`.ag-row[row-index="0"] [col-id="${column}"]`).dblclick();
  const input = panel.getByLabel(label, { exact: true });
  await input.press("ControlOrMeta+A"); await input.pressSequentially(text); await input.press("Enter");
}

async function loginAt(page: Page, origin: string) {
  await page.goto(origin);
  const credentials = manifest.actors.integratedEditor;
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill(credentials.username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(credentials.password);
  const authenticated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/auth/login" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  expect((await authenticated).status()).toBe(200);
  await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
  expect(new URL(page.url()).origin).toBe(origin);
}

async function createUnknown(page: Page, origin = manifest.origin) {
  await loginAt(page, origin);
  await page.getByRole("button", { name: "Sales mới", exact: true }).click();
  const panel = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  await panel.getByLabel("Ngày chứng từ", { exact: true }).fill("2024-02-29");
  await select(page, panel, "Khách hàng", "PILOT-C");
  await select(page, panel, "Kho", "PILOT-W");
  await select(page, panel, "Nhân viên", "PILOT-E");
  await panel.locator('.ag-row[row-index="0"] [col-id="product"]').dblclick();
  const product = panel.getByRole("combobox", { name: "Sản phẩm grid", exact: true });
  await product.pressSequentially("PILOT-P"); await product.press("ArrowDown"); await product.press("Enter");
  await decimal(panel, "qty", "Số lượng dòng 1", "1.0000");
  await decimal(panel, "unitPrice", "Đơn giá dòng 1", "25.0000");
  let writes = 0;
  const intercept = async (route: import("@playwright/test").Route) => {
    if (route.request().method() !== "POST") return route.continue();
    writes++; await route.abort("failed");
  };
  await page.route("**/api/v1/sales-receipts", intercept);
  await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  await expect(panel).toContainText("Kết quả chưa rõ");
  const operation = (await readStore<DurableOperationRecord>(page, "operations")).find(value => value.frozen.request.operationKind === "Sales.Create" && value.state === "DISPATCHED");
  expect(operation).toBeDefined(); expect(writes).toBe(1);
  return { operation: operation!, writes: () => writes, dispose: () => page.unroute("**/api/v1/sales-receipts", intercept) };
}

async function recovery(page: Page) {
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  return page.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
}

test.afterEach(async () => {
  await cutoverControl("revokeGrantOff").catch(() => undefined);
  await cutoverControl("oldClientNewHostOff").catch(() => undefined);
  await cutoverControl("newClientOldHostOff").catch(() => undefined);
});

test("cached WEB4 client on compatible new host has no resend path", async ({ page }) => {
  test.setTimeout(120_000);
  const switched = await cutoverControl("oldClientNewHostOn");
  expect(switched.marker).toBe("old-client-new-host");
  const unknown = await createUnknown(page);
  const dialog = await recovery(page);
  await expect(dialog.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true })).toHaveCount(0);
  expect(unknown.writes()).toBe(1);
  await cutoverControl("verifyNoCutoverMutation", unknown.operation.operationId);
  recordWeb6Check("web6-cutover-old-client-new-host");
  await unknown.dispose();
});

test("current client on exact12 old host remains fail closed", async ({ page }) => {
  test.setTimeout(120_000);
  const switched = await cutoverControl("newClientOldHostOn");
  expect(switched.marker).toBe("new-client-old-host");
  const unknown = await createUnknown(page, cutover.oldOrigin);
  const dialog = await recovery(page);
  const resend = dialog.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true });
  if (await resend.count()) await resend.click();
  await expect(page.getByRole("dialog", { name: "Gửi lại đúng thao tác gốc?", exact: true })).toHaveCount(0);
  expect(unknown.writes()).toBe(1);
  await cutoverControl("verifyNoCutoverMutation", unknown.operation.operationId);
  recordWeb6Check("web6-cutover-new-client-old-host");
  await unknown.dispose();
});

test("restart preserves UNKNOWN while revoked and restored epochs fail closed", async ({ page }) => {
  test.setTimeout(150_000);
  const unknown = await createUnknown(page);
  const restart = await cutoverControl("sameEpochRestart", unknown.operation.operationId);
  expect(restart.deploymentEpoch).toBe(cutover.currentDeploymentEpoch);
  await page.reload();
  await expect(page.getByRole("button", { name: "Đối soát thao tác", exact: true })).toBeVisible();
  expect(unknown.writes()).toBe(1);

  await cutoverControl("revokeGrantOn", unknown.operation.operationId);
  let dialog = await recovery(page);
  const revoked = dialog.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true });
  if (await revoked.count()) await revoked.click();
  await expect(page.getByRole("dialog", { name: "Gửi lại đúng thao tác gốc?", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape"); await cutoverControl("revokeGrantOff", unknown.operation.operationId);
  recordWeb6Check("web6-cutover-revoked-grant");

  await cutoverControl("committedUnavailable", unknown.operation.operationId);
  dialog = await recovery(page);
  const support = dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true });
  await expect(support).toBeVisible();
  const conclusion = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v2/operations/${unknown.operation.operationId}/resolution`);
  await support.click(); expect((await conclusion).status()).toBe(200);
  let stored = (await readStore<DurableOperationRecord>(page, "operations")).find(value => value.operationId === unknown.operation.operationId);
  expect(stored?.state).not.toBe("SETTLED");
  expect(unknown.writes()).toBe(1);
  recordWeb6Check("web6-cutover-committed-unavailable-protected");
  await page.keyboard.press("Escape");

  const restored = await cutoverControl("restoreEpoch", unknown.operation.operationId);
  expect(restored.deploymentEpoch).toBe(cutover.restoredDeploymentEpoch);
  await page.reload(); dialog = await recovery(page);
  const stale = dialog.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true });
  if (await stale.count()) await stale.click();
  await expect(page.getByRole("dialog", { name: "Gửi lại đúng thao tác gốc?", exact: true })).toHaveCount(0);
  expect(unknown.writes()).toBe(1);
  recordWeb6Check("web6-cutover-same-epoch-restart");
  recordWeb6Check("web6-cutover-restored-epoch-rejected");
  stored = (await readStore<DurableOperationRecord>(page, "operations")).find(value => value.operationId === unknown.operation.operationId);
  expect(stored?.state).not.toBe("SETTLED");
  expect(unknown.writes()).toBe(1);
  await cutoverControl("verifyNoCutoverMutation", unknown.operation.operationId);
  await unknown.dispose();
});
