import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { randomInt } from "node:crypto";
import { fingerprintWeb4Request, web4OperationPath } from "../../src/infrastructure/http/web4OperationCodec";
import type { ManualResendClaim, ManualResendReceipt } from "../../src/infrastructure/drafts/web6ManualResendRepository";
import { createCutoverControlFrame, requestCutoverControl, type CommittedSetupEvidence } from "./web6-cutover-control";
import { createCutoverScenarioDeadline, type CutoverAction } from "./web6-cutover-deadline";
import { manifest, readStore, recordWeb6Check, type DurableOperationRecord } from "./web4-helpers";
import { captureProtectedCutoverState, selectCurrentRecoveryResend, selectDispatchedSalesCreateByWire, verifyAuthenticCommittedCutoverSetup,
  verifyProtectedCutoverState, type ProtectedCutoverBaseline } from "./web6-cutover-helpers";

if (manifest.mode !== "web6-candidate" || !manifest.cutover) {
  throw Error("Backend-owned WEB6 cutover handles are required.");
}
const cutover = manifest.cutover;

const cachedWeb4 = "cached WEB4 client on compatible new host has no resend path";
const currentClient = "current client on exact12 old host remains fail closed";
const restartRevokeRestore = "restart preserves UNKNOWN while revoked and restored epochs fail closed";
const budgets = new Map<string, readonly [totalMs: number, resetReserveMs: number]>([
  [cachedWeb4, [420_000, 180_000]],
  [currentClient, [420_000, 180_000]],
  [restartRevokeRestore, [690_000, 60_000]],
]);
const scenarios = new WeakMap<TestInfo, ReturnType<typeof createCutoverScenarioDeadline>>();

function sendCutoverFrame(
  action: CutoverAction, requestAllowanceMs: number, allowanceSampledAt: number,
  operationId?: string, committedSetup?: CommittedSetupEvidence,
) {
  const id = randomInt(1, 2147483647);
  const request = createCutoverControlFrame(id, manifest.recovery.controlToken, action, requestAllowanceMs, operationId, committedSetup);
  return requestCutoverControl(action, manifest.recovery.controlPipe, id, request, requestAllowanceMs, undefined, undefined, allowanceSampledAt);
}

function cutoverControl(testInfo: TestInfo, action: Exclude<CutoverAction, "resetCutover">, operationId?: string, committedSetup?: CommittedSetupEvidence) {
  const scenario = scenarios.get(testInfo);
  if (!scenario) throw Error("Missing WEB6 cutover scenario deadline.");
  return scenario.body(action, (requestAllowanceMs, allowanceSampledAt) =>
    sendCutoverFrame(action, requestAllowanceMs, allowanceSampledAt, operationId, committedSetup));
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

async function readManualRecord<T>(page: Page, store: "manualResendReceipts" | "manualResendClaims", operation: DurableOperationRecord): Promise<T | undefined> {
  return page.evaluate(async ({ store, key }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("mydmsvn-drafts-v1"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const request = db.transaction(store).objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }, { store, key: [operation.deploymentEpoch, operation.actorKey, operation.operationId] }) as T | undefined;
}

async function protectedState(page: Page, baseline: ProtectedCutoverBaseline) {
  const operation = (await readStore<DurableOperationRecord>(page, "operations")).find(value =>
    value.deploymentEpoch === baseline.deploymentEpoch && value.actorKey === baseline.actorKey && value.operationId === baseline.operationId);
  const key = operation ?? { deploymentEpoch: baseline.deploymentEpoch, actorKey: baseline.actorKey, operationId: baseline.operationId } as DurableOperationRecord;
  const receipt = await readManualRecord<ManualResendReceipt>(page, "manualResendReceipts", key);
  const claim = await readManualRecord<ManualResendClaim>(page, "manualResendClaims", key);
  return { operation, receipt, claim };
}

async function prepareSalesCreate(page: Page) {
  await page.getByRole("button", { name: "Sales mới", exact: true }).click();
  const panel = page.getByRole("region", { name: "Chứng từ mới", exact: true });
  await panel.getByLabel("Ngày chứng từ", { exact: true }).fill("2024-02-29");
  await select(page, panel, "Khách hàng", "PILOT-C");
  await select(page, panel, "Kho", "PILOT-W");
  await select(page, panel, "Nhân viên", "PILOT-E");
  await panel.locator('.ag-row[row-index="0"] [col-id="product"]').dblclick();
  const product = panel.getByRole("combobox", { name: "Sản phẩm grid", exact: true });
  await product.pressSequentially("PILOT-P");
  const productOption = page.getByRole("listbox").getByRole("option").filter({ hasText: /^PILOT-P ·/ });
  await expect(productOption).toHaveCount(1);
  await productOption.click();
  await product.press("Tab");
  await decimal(panel, "qty", "Số lượng dòng 1", "1.0000");
  await decimal(panel, "unitPrice", "Đơn giá dòng 1", "25.0000");
  return panel;
}

async function createUnknown(page: Page, origin = manifest.origin, requireManualReceipt = false, authenticate = true) {
  if (authenticate) await loginAt(page, origin);
  const panel = await prepareSalesCreate(page);
  let writes = 0, wire: { method: string; pathname: string; body: unknown; operationId: string | undefined; deploymentEpoch: string | undefined } | undefined;
  const intercept = async (route: import("@playwright/test").Route) => {
    if (route.request().method() !== "POST") return route.continue();
    writes++;
    wire = { method: route.request().method(), pathname: new URL(route.request().url()).pathname,
      body: route.request().postDataJSON(), operationId: route.request().headers()["idempotency-key"],
      deploymentEpoch: route.request().headers()["x-mydmsvn-deployment-epoch"] };
    await route.abort("failed");
  };
  await page.route("**/api/v1/sales-receipts", intercept);
  await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  await expect(panel).toContainText("Kết quả chưa rõ");
  expect(writes).toBe(1); expect(wire).toBeDefined();
  const operation = selectDispatchedSalesCreateByWire(await readStore<DurableOperationRecord>(page, "operations"), wire!.operationId);
  expect(wire!.deploymentEpoch).toBe(operation.deploymentEpoch);
  expect(wire!.method).toBe(operation.frozen.request.method); expect(wire!.pathname).toBe(web4OperationPath(operation.frozen.request));
  const transmitted = { ...operation.frozen.request, body: wire!.body };
  expect(await fingerprintWeb4Request(transmitted)).toBe(operation.frozen.requestFingerprint);
  let baseline: ProtectedCutoverBaseline | undefined;
  if (requireManualReceipt) {
    await expect.poll(async () => !!await readManualRecord<ManualResendReceipt>(page, "manualResendReceipts", operation)).toBe(true);
    const receipt = await readManualRecord<ManualResendReceipt>(page, "manualResendReceipts", operation);
    const claim = await readManualRecord<ManualResendClaim>(page, "manualResendClaims", operation);
    expect(receipt).toBeDefined(); expect(claim).toBeUndefined();
    baseline = captureProtectedCutoverState(operation, receipt!);
  }
  return { operation, baseline, writes: () => writes, dispose: () => page.unroute("**/api/v1/sales-receipts", intercept) };
}

async function createAuthenticCommittedLoss(page: Page, origin = manifest.origin) {
  await loginAt(page, origin);
  const panel = await prepareSalesCreate(page);
  let writes = 0;
  let wire: { status: number; method: string; pathname: string; body: unknown; operationId: string | undefined; deploymentEpoch: string | undefined } | undefined;
  const intercept = async (route: import("@playwright/test").Route) => {
    if (route.request().method() !== "POST") return route.continue();
    writes++;
    const request = route.request();
    const response = await route.fetch({ maxRetries: 0 });
    wire = { status: response.status(), method: request.method(), pathname: new URL(request.url()).pathname,
      body: request.postDataJSON(), operationId: request.headers()["idempotency-key"],
      deploymentEpoch: request.headers()["x-mydmsvn-deployment-epoch"] };
    if (response.status() !== 200) { await response.dispose(); throw Error("Cutover committed setup requires a real 200."); }
    await response.json();
    await response.dispose();
    await route.abort("failed");
  };
  await page.route("**/api/v1/sales-receipts", intercept);
  await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  await expect(panel).toContainText("Kết quả chưa rõ");
  expect(wire).toBeDefined(); expect(writes).toBe(1);
  const operation = (await readStore<DurableOperationRecord>(page, "operations")).find(value => value.operationId === wire!.operationId);
  expect(operation).toBeDefined();
  const evidence = await verifyAuthenticCommittedCutoverSetup(operation!, wire!);
  return { operation: operation!, evidence, writes: () => writes, dispose: () => page.unroute("**/api/v1/sales-receipts", intercept) };
}

async function recovery(page: Page, operationId: string) {
  if (await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).count() === 0) {
    await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
    const drafts = page.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
    const protectedDraft = drafts.getByRole("listitem")
      .filter({ hasText: "Chứng từ được bảo vệ" }).filter({ hasText: operationId });
    await expect(protectedDraft).toHaveCount(1);
    await protectedDraft.getByRole("button", { name: "Mở bản nháp", exact: true }).click();
    await expect(drafts).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  return page.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
}

test.beforeEach(({}, testInfo) => {
  const budget = budgets.get(testInfo.title);
  if (!budget) throw Error("Missing WEB6 cutover scenario budget.");
  const [totalMs, resetReserveMs] = budget;
  scenarios.set(testInfo, createCutoverScenarioDeadline(totalMs, resetReserveMs));
  testInfo.setTimeout(totalMs);
});

test.afterEach(async ({}, testInfo) => {
  const scenario = scenarios.get(testInfo);
  if (!scenario) return;
  // The hook and fixture teardown share this slot. Playwright interprets zero as unlimited.
  testInfo.setTimeout(Math.max(1, scenario.remainingTotalMs()));
  try {
    await scenario.reset((requestAllowanceMs, allowanceSampledAt) =>
      sendCutoverFrame("resetCutover", requestAllowanceMs, allowanceSampledAt));
  } catch (error) {
    if (testInfo.errors.length === 0) throw error;
    testInfo.annotations.push({ type: "web6-cutover-reset-failed" });
  }
});

test(cachedWeb4, async ({ page }, testInfo) => {
  const switched = await cutoverControl(testInfo, "oldClientNewHostOn");
  expect(switched.marker).toBe("old-client-new-host");
  const unknown = await createUnknown(page);
  const dialog = await recovery(page, unknown.operation.operationId);
  await expect(dialog.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true })).toHaveCount(0);
  expect(unknown.writes()).toBe(1);
  await cutoverControl(testInfo, "verifyNoCutoverMutation", unknown.operation.operationId);
  recordWeb6Check("web6-cutover-old-client-new-host");
  await unknown.dispose();
});

test(currentClient, async ({ page }, testInfo) => {
  const switched = await cutoverControl(testInfo, "newClientOldHostOn");
  expect(switched.marker).toBe("new-client-old-host");
  const unknown = await createUnknown(page, cutover.oldOrigin);
  const dialog = await recovery(page, unknown.operation.operationId);
  const resend = dialog.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true });
  if (await resend.count()) await resend.click();
  await expect(page.getByRole("dialog", { name: "Gửi lại đúng thao tác gốc?", exact: true })).toHaveCount(0);
  expect(unknown.writes()).toBe(1);
  await cutoverControl(testInfo, "verifyNoCutoverMutation", unknown.operation.operationId);
  recordWeb6Check("web6-cutover-new-client-old-host");
  await unknown.dispose();
});

test(restartRevokeRestore, async ({ page }, testInfo) => {
  const committed = await createAuthenticCommittedLoss(page, manifest.origin);
  const unavailable = await cutoverControl(testInfo, "committedUnavailable", committed.operation.operationId, committed.evidence);
  expect(unavailable.marker).toBe("committed-unavailable");
  let dialog = await recovery(page, committed.operation.operationId);
  const support = dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true });
  await expect(support).toBeVisible();
  const conclusion = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v2/operations/${committed.operation.operationId}/resolution`);
  await support.click(); expect((await conclusion).status()).toBe(200);
  let stored = (await readStore<DurableOperationRecord>(page, "operations")).find(value => value.operationId === committed.operation.operationId);
  expect(stored).toBeDefined(); expect(stored!.state).toBe("DISPATCHED");
  expect(committed.evidence.authorizedBusinessEffects).toBe(1); expect(committed.writes()).toBe(1);
  await cutoverControl(testInfo, "verifyNoCutoverMutation", committed.operation.operationId);
  recordWeb6Check("web6-cutover-committed-unavailable-protected");
  await page.keyboard.press("Escape"); await committed.dispose();

  const unknown = await createUnknown(page, manifest.origin, true, false);
  expect(unknown.baseline).toBeDefined();
  const restart = await cutoverControl(testInfo, "sameEpochRestart", unknown.operation.operationId);
  expect(restart.deploymentEpoch).toBe(cutover.currentDeploymentEpoch);
  await page.reload();
  dialog = await recovery(page, unknown.operation.operationId);
  await verifyProtectedCutoverState(unknown.baseline!, await protectedState(page, unknown.baseline!));
  expect(unknown.writes()).toBe(1);
  await page.keyboard.press("Escape");

  await cutoverControl(testInfo, "revokeGrantOn", unknown.operation.operationId);
  dialog = await recovery(page, unknown.operation.operationId);
  const revoked = selectCurrentRecoveryResend(dialog);
  if (await revoked.count()) await revoked.click();
  await expect(page.getByRole("dialog", { name: "Gửi lại đúng thao tác gốc?", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape"); await cutoverControl(testInfo, "revokeGrantOff", unknown.operation.operationId);
  recordWeb6Check("web6-cutover-revoked-grant");

  const restored = await cutoverControl(testInfo, "restoreEpoch", unknown.operation.operationId);
  expect(restored.deploymentEpoch).toBe(cutover.restoredDeploymentEpoch);
  await page.reload(); dialog = await recovery(page, unknown.operation.operationId);
  const stale = selectCurrentRecoveryResend(dialog);
  if (await stale.count()) await stale.click();
  await expect(page.getByRole("dialog", { name: "Gửi lại đúng thao tác gốc?", exact: true })).toHaveCount(0);
  expect(unknown.writes()).toBe(1);
  recordWeb6Check("web6-cutover-same-epoch-restart");
  recordWeb6Check("web6-cutover-restored-epoch-rejected");
  stored = (await readStore<DurableOperationRecord>(page, "operations")).find(value => value.operationId === unknown.operation.operationId);
  expect(stored).toBeDefined(); expect(stored!.state).toBe("DISPATCHED");
  await verifyProtectedCutoverState(unknown.baseline!, await protectedState(page, unknown.baseline!));
  expect(unknown.writes()).toBe(1);
  await cutoverControl(testInfo, "verifyNoCutoverMutation", unknown.operation.operationId);
  await unknown.dispose();
});
