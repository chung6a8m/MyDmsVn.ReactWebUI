import { test, expect, type Page, type Locator, type APIResponse, type Route } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  accessKey, api, checkOperation, control, login, manifest, openDraft, putStore, readStore,
  recordCheck, recordOperation, write, type DraftRecord, type DurableOperationRecord,
} from "./web4-helpers";

const salesRoot = "/api/v1/sales-receipts", receiptRoot = "/api/v1/goods-receipts";
const epochHeader = "X-MyDmsVn-Deployment-Epoch", fingerprintHeader = "X-MyDmsVn-Operation-Fingerprint";
const draftKey = (record: DraftRecord) => [record.deploymentEpoch, record.actorKey, record.feature, record.localDocumentId];
const operationKey = (record: DurableOperationRecord) => [record.deploymentEpoch, record.actorKey, record.operationId];
const operations = (page: Page) => readStore<DurableOperationRecord>(page, "operations");
const drafts = (page: Page) => readStore<DraftRecord>(page, "drafts");
async function securityStatus(send: () => Promise<APIResponse>): Promise<number> {
  // APIRequest errors may contain cookies/headers; only a sanitized failure may
  // reach the report when a direct security probe cannot obtain HTTP status.
  try { const response = await send(); const status = response.status(); await response.dispose(); return status; }
  catch { throw Error("Direct HTTPS security probe failed before status; check the owned fixture CA/network."); }
}
async function fetchOwned(route: Route): Promise<APIResponse> {
  // route.fetch errors include the original authenticated request headers.
  try { return await route.fetch({ maxRetries: 0, timeout: 10_000 }); }
  catch { throw Error("Owned HTTPS request failed before response; authentication headers are withheld."); }
}
function salesBody(note = "WEB4 boundary") {
  const { customerId, warehouseId, employeeId, productId } = manifest.catalog;
  return { saleDate: "2024-03-10", customerId, warehouseId, employeeId, note,
    lines: [{ saleLineId: "0", productId, qty: "1.0000", unitPrice: "2.0000", isGift: false }] };
}
async function preview(page: Page) {
  await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
  await expect(dialog.getByText("Đang đọc bản nháp…", { exact: true })).toHaveCount(0);
  return dialog;
}
// Seed only sanitized raw draft data through native IndexedDB. Production code is
// never imported into the browser; subsequent Save/recovery uses the shipped UI.
async function seed(page: Page, id: string, note = `Private ${id}`): Promise<DraftRecord> {
  const context = await api(page, "/api/v1/operations/context");
  expect(context.status).toBe(200);
  const body = salesBody(note);
  const draft = { saleId: null, expectedVersion: null, saleDate: body.saleDate, customerId: String(body.customerId),
    warehouseId: String(body.warehouseId), employeeId: String(body.employeeId), note,
    lines: [{ clientLineId: `${id}-line`, saleLineId: null, productId: String(body.lines[0].productId), qty: "1.0000", unitPrice: "2.0000", isGift: false }] };
  const record: DraftRecord = { schemaVersion: 1, deploymentEpoch: context.json.data.deploymentEpoch,
    actorKey: String(context.json.data.actorUserId), feature: "sales", localDocumentId: id,
    editRevision: 1, localPersistSequence: 1, savedAt: new Date().toISOString(), unresolvedOperation: false, operationId: null,
    snapshot: { feature: "sales", serverId: null, baseline: null, initialDraft: structuredClone(draft), draft,
      rawBuffers: {}, lookupBuffers: {}, dirty: true, postAcknowledgement: null } };
  await putStore(page, "drafts", draftKey(record), record);
  return record;
}
async function locked(page: Page, panel: Locator, operationId: string) {
  await expect(panel.getByRole("button", { name: "Lưu chứng từ", exact: true })).toBeDisabled();
  expect((await operations(page)).find(value => value.operationId === operationId)?.state).toBe("DISPATCHED");
  expect((await drafts(page)).find(value => value.operationId === operationId)?.unresolvedOperation).toBe(true);
}
async function loseCreate(page: Page, id: string, committed: boolean) {
  await seed(page, id);
  const panel = await openDraft(page, id);
  let sends = 0;
  await page.route(`**${salesRoot}`, async route => {
    if (route.request().method() !== "POST") return route.continue();
    sends++;
    const operation = (await operations(page)).find(value => value.operationId === route.request().headers()["idempotency-key"])!;
    expect(operation.state).toBe("DISPATCHED");
    if (committed) {
      const response = await fetchOwned(route);
      expect(response.status()).toBe(200);
      const result = await response.json();
      recordOperation("integratedEditor", operation, result.data.saleId);
    }
    // When committed=false the request never reaches IIS. The 404 later is real,
    // and still cannot be used by the application as rollback/unlock evidence.
    await route.abort("failed");
  });
  await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  // The toolbar appears as soon as intent is durable, before route.fetch finishes.
  // Await the aborted response's actual command outcome before callers reload.
  await expect(panel).toContainText("Kết quả chưa rõ");
  await expect(page.getByRole("button", { name: "Đối soát thao tác", exact: true })).toBeVisible();
  const operation = (await operations(page)).find(value => value.localDocumentId === id)!;
  expect(sends).toBe(1);
  await locked(page, panel, operation.operationId);
  return { operation, sends: () => sends };
}

test.beforeEach(({ page }) => { page.on("dialog", dialog => void dialog.accept()); });

test("real server rejects missing/wrong epoch on all six commands and protected status", async ({ page }) => {
  await login(page);
  const receipt = { receiptDate: "2024-03-10", ...manifest.receiptCatalog, note: "WEB4 header rejection",
    lines: [{ productId: manifest.receiptCatalog.productId, quantity: "1.0000", unitCost: "2.0000" }] };
  // productId is a line field, not a receipt header field.
  const { productId: _productId, ...receiptBody } = receipt;
  const commands = [
    [salesRoot, "POST", salesBody()], [`${salesRoot}/1/draft`, "PUT", { ...salesBody(), expectedVersion: "AAAAAAAAAAE=" }],
    [`${salesRoot}/1/post`, "POST", { expectedVersion: "AAAAAAAAAAE=" }],
    [receiptRoot, "POST", receiptBody], [`${receiptRoot}/1/draft`, "PUT", { ...receiptBody, expectedVersion: "AAAAAAAAAAE=" }],
    [`${receiptRoot}/1/post`, "POST", { expectedVersion: "AAAAAAAAAAE=" }],
  ] as const;
  for (const [epoch, status, code] of [[null, 400, "ValidationError"], [randomUUID(), 409, "Deployment.EpochMismatch"]] as const) {
    for (const [path, method, body] of commands) {
      const result = await api(page, path, method, body, { "Idempotency-Key": randomUUID(), [epochHeader]: epoch });
      expect(result.status, `${method} ${path}`).toBe(status);
      expect(result.json.error.code).toBe(code);
    }
    const result = await api(page, `/api/v1/operations/${randomUUID()}`, "GET", undefined,
      { [epochHeader]: epoch, [fingerprintHeader]: "0".repeat(64) });
    expect(result.status).toBe(status); expect(result.json.error.code).toBe(code);
  }
  recordCheck("epoch-headers");
});

test("real absent status and revoked Write 403 keep UNKNOWN locked without replay", async ({ page, browser }) => {
  await login(page);
  const absent = await loseCreate(page, "boundary-absent", false);
  await page.reload();
  const absentPanel = await openDraft(page, absent.operation.localDocumentId);
  const absentResponse = page.waitForResponse(r => new URL(r.url()).pathname === `/api/v1/operations/${absent.operation.operationId}`);
  const absentDialog = await checkOperation(page, absent.operation.operationId);
  expect((await absentResponse).status()).toBe(404);
  await expect(absentDialog).toContainText("Chưa có bằng chứng đã hoàn tất");
  await page.keyboard.press("Escape"); await locked(page, absentPanel, absent.operation.operationId);
  expect(absent.sends()).toBe(1);

  const isolated = await browser.newContext({ baseURL: manifest.origin, ignoreHTTPSErrors: false });
  try {
    const deniedPage = await isolated.newPage(); deniedPage.on("dialog", dialog => void dialog.accept());
    await login(deniedPage);
    const denied = await loseCreate(deniedPage, "boundary-denied", true);
    await deniedPage.reload();
    const deniedPanel = await openDraft(deniedPage, denied.operation.localDocumentId);
    await control("setWritePermission", false);
    try {
      const response = deniedPage.waitForResponse(r => new URL(r.url()).pathname === `/api/v1/operations/${denied.operation.operationId}`);
      const dialog = await checkOperation(deniedPage, denied.operation.operationId);
      const real = await response; expect(real.status()).toBe(403);
      expect((await real.json()).error.code).toBe("Auth.Forbidden");
      await expect(dialog).toContainText("Chưa có bằng chứng đã hoàn tất");
      await deniedPage.keyboard.press("Escape"); await locked(deniedPage, deniedPanel, denied.operation.operationId);
      expect(denied.sends()).toBe(1);
    } finally { await control("setWritePermission", true); }
  } finally { await isolated.close(); }
  recordCheck("absent-and-denied");
});

test("injected mismatched real COMMITTED identity and corrupt stored fingerprint cannot settle", async ({ page }) => {
  await login(page);
  const lost = await loseCreate(page, "boundary-mismatch", true), operation = lost.operation;
  await page.reload(); const panel = await openDraft(page, operation.localDocumentId);
  let statusReads = 0;
  await page.route(`**/api/v1/operations/${operation.operationId}`, async route => {
    statusReads++;
    const response = await fetchOwned(route);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({ operationId: operation.operationId, requestFingerprint: operation.frozen.requestFingerprint, state: "COMMITTED" });
    // Deliberate negative injection into an otherwise real SQL response.
    body.data.operationId = randomUUID();
    await route.fulfill({ response, json: body });
  });
  const dialog = await checkOperation(page, operation.operationId);
  await expect(dialog).toContainText("Chưa có bằng chứng đã hoàn tất");
  await page.keyboard.press("Escape"); await locked(page, panel, operation.operationId);
  expect(statusReads).toBe(1); expect(lost.sends()).toBe(1);
  await putStore(page, "operations", operationKey(operation), { ...operation,
    frozen: { ...operation.frozen, requestFingerprint: "0".repeat(64) } });
  await page.reload();
  const corrupt = await preview(page);
  await expect(corrupt).toContainText(operation.operationId);
  await expect(corrupt).toContainText("Thông tin đã lưu, chưa xác minh kết quả");
  await corrupt.getByRole("button", { name: "Mở bản nháp", exact: true }).click();
  await expect(corrupt).toContainText("Chưa thể đọc hoặc xóa bản nháp");
  await expect(corrupt.getByRole("button", { name: "Xóa bản nháp này", exact: true })).toBeDisabled();
  await expect(page.locator(`section[data-session-id="${operation.localDocumentId}"]`)).toHaveCount(0);
  expect(statusReads).toBe(1); expect(lost.sends()).toBe(1);
  recordCheck("corrupt-and-mismatch");
});

test("native quota/schema errors and synthetic composition preserve raw draft without a server write", async ({ page }) => {
  await login(page, "alice");
  const original = await seed(page, "boundary-storage");
  const panel = await openDraft(page, original.localDocumentId);
  let writes = 0;
  page.on("request", request => { if (["POST", "PUT"].includes(request.method()) && new URL(request.url()).pathname.startsWith(salesRoot)) writes++; });
  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    (window as Window & { restorePilotQuota?: () => void }).restorePilotQuota = () => { IDBObjectStore.prototype.put = originalPut; };
    IDBObjectStore.prototype.put = function(...args: Parameters<IDBObjectStore["put"]>) {
      if (this.transaction.db.name === "mydmsvn-drafts-v1" && this.name === "drafts") throw new DOMException("Injected storage quota", "QuotaExceededError");
      return originalPut.apply(this, args);
    };
  });
  await panel.getByLabel("Ghi chú", { exact: true }).fill("RAM giữ nguyên khi quota hết ệ");
  await expect(page.getByText("Chưa lưu được bản nháp trên thiết bị", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  const dialog = await preview(page);
  await expect(dialog.getByRole("alert")).toContainText("Thiết bị không đủ dung lượng lưu");
  await expect(dialog.getByRole("button", { name: "Sao chép bản nháp đang mở", exact: true })).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await expect(dialog.getByRole("button", { name: "Sao chép bản nháp đang mở", exact: true })).toBeEnabled();
  expect(writes).toBe(0);
  await page.evaluate(() => (window as Window & { restorePilotQuota?: () => void }).restorePilotQuota!());
  await dialog.getByRole("button", { name: "Thử lại lưu cục bộ", exact: true }).click();
  await expect(dialog.getByText("Đã lưu bản nháp trên thiết bị", { exact: true })).toBeVisible();
  let stored = (await drafts(page)).find(record => record.localDocumentId === original.localDocumentId)!;
  expect(stored.snapshot.rawBuffers.note.raw).toBe("RAM giữ nguyên khi quota hết ệ");
  await page.keyboard.press("Escape");
  const note = panel.getByLabel("Ghi chú", { exact: true });
  // Synthetic composition events exercise the shipped input/barrier/persistence
  // handlers. They are explicitly not attended Telex/VNI acceptance.
  await note.dispatchEvent("compositionstart", { data: "" });
  await note.fill("Tiếng Việt đang ghép ệ");
  await expect.poll(async () => (await drafts(page)).find(record => record.localDocumentId === original.localDocumentId)?.snapshot.rawBuffers.note)
    .toEqual({ raw: "Tiếng Việt đang ghép ệ", composing: true });
  await panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("Hoàn tất nhập liệu");
  await note.dispatchEvent("compositionend", { data: "ệ" });
  await note.press("End"); await note.pressSequentially(" tiếp");
  await expect.poll(async () => (await drafts(page)).find(record => record.localDocumentId === original.localDocumentId)?.snapshot.rawBuffers.note)
    .toEqual({ raw: "Tiếng Việt đang ghép ệ tiếp", composing: false });
  stored = (await drafts(page)).find(record => record.localDocumentId === original.localDocumentId)!;
  // A future/unsupported envelope is retained in native storage and quarantined.
  const future = { ...stored, localDocumentId: "boundary-unsupported", schemaVersion: 99 };
  await putStore(page, "drafts", [...draftKey(stored).slice(0, 3), future.localDocumentId], future);
  await page.reload(); const review = await preview(page);
  await expect(review.getByRole("alert")).toContainText("1 bản ghi không hợp lệ đã được cách ly");
  expect((await readStore<{ schemaVersion: number }>(page, "drafts")).some(record => record.schemaVersion === 99)).toBe(true);
  await page.keyboard.press("Escape");
  const restored = await openDraft(page, original.localDocumentId);
  await expect(restored.getByLabel("Ghi chú", { exact: true })).toHaveValue("Tiếng Việt đang ghép ệ tiếp");
  expect((await drafts(page)).find(record => record.localDocumentId === original.localDocumentId)?.snapshot.draft.lines[0].clientLineId).toBe(`${original.localDocumentId}-line`);
  expect(writes).toBe(0); recordCheck("storage-failure");
});

test("explicit logout isolates retained dirty drafts from another authenticated actor", async ({ page }) => {
  await login(page);
  const retained = await seed(page, "boundary-actor", "Chỉ tài khoản đầu tiên thấy ệ");
  await expect((await preview(page)).getByRole("button", { name: "Mở bản nháp", exact: true })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key) === null, accessKey)).toBe(true);
  expect((await drafts(page)).some(record => record.localDocumentId === retained.localDocumentId)).toBe(true);
  await login(page, "bob");
  const bobContext = await api(page, "/api/v1/operations/context");
  expect(String(bobContext.json.data.actorUserId)).not.toBe(retained.actorKey);
  const review = await preview(page);
  await expect(review.getByRole("button", { name: "Mở bản nháp", exact: true })).toHaveCount(0);
  await expect(review).not.toContainText(retained.operationId ?? retained.localDocumentId);
  expect(await page.locator("input").evaluateAll(nodes => nodes.map(node => (node as HTMLInputElement).value))).not.toContain("Chỉ tài khoản đầu tiên thấy ệ");
  const localBytes = JSON.stringify({ drafts: await drafts(page), operations: await operations(page) });
  expect(/accessToken|refreshToken|Bearer|password|capabilities|actorGeneration/.test(localBytes)).toBe(false);
  await page.keyboard.press("Escape"); await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  await login(page);
  const restored = await openDraft(page, retained.localDocumentId);
  await expect(restored.getByLabel("Ghi chú", { exact: true })).toHaveValue("Chỉ tài khoản đầu tiên thấy ệ");
  recordCheck("actor-isolation");
});

test("real HTTPS CSP, protected refresh cookie and Origin checks remain enforced", async ({ page, context }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const response = await page.goto("/");
  expect(response!.headers()["content-security-policy"]).toContain("script-src 'self'");
  expect(response!.headers()["strict-transport-security"]).toContain("max-age=");
  await login(page, "alice");
  await expect(page.getByTestId("sales-list-grid").getByRole("grid")).toBeVisible();
  const cookie = (await context.cookies()).find(value => value.name === "__Host-mydmsvn-rt")!;
  expect(Boolean(cookie?.httpOnly && cookie.secure && cookie.sameSite === "Strict" && cookie.path === "/")).toBe(true);
  expect(await page.evaluate(() => document.cookie.includes("mydmsvn-rt"))).toBe(false);
  const epochBefore = (await api(page, "/api/v1/operations/context")).json.data;
  await page.evaluate(key => localStorage.removeItem(key), accessKey);
  const refresh = page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/auth/refresh");
  await page.reload(); expect((await refresh).status()).toBe(200);
  await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
  expect((await api(page, "/api/v1/operations/context")).json.data).toEqual(epochBefore);
  expect((await context.cookies()).find(value => value.name === cookie.name)?.value === cookie.value).toBe(false);
  expect(errors).toEqual([]);
  await page.evaluate(() => { const script = document.createElement("script"); script.textContent = "window.__web4InlineExecuted = true"; document.body.append(script); });
  expect(await page.evaluate(() => "__web4InlineExecuted" in window)).toBe(false);
  const foreign = await securityStatus(() => context.request.post(`${manifest.origin}/api/v1/auth/refresh`, {
    headers: { "X-Requested-With": "XMLHttpRequest", Origin: "https://outside.invalid", "Content-Type": "application/json" },
    timeout: 10_000, maxRetries: 0,
  }));
  expect(foreign).toBe(403);
  const missingCsrf = await securityStatus(() => context.request.post(`${manifest.origin}/api/v1/auth/refresh`,
    { headers: { Origin: manifest.origin }, timeout: 10_000, maxRetries: 0 }));
  expect(missingCsrf).toBe(403);
  expect((await api(page, "/api/v1/auth/me")).status).toBe(200);
  recordCheck("security");
});

test("two live production workspaces racing Save commit one operation and retain the losing raw draft", async ({ page, context }) => {
  await login(page);
  const id = "boundary-live-cross-tab", raw = "Hai tab giữ nội dung chưa lưu ệ";
  const shared = await seed(page, id);
  shared.snapshot.rawBuffers.note = { raw, composing: false };
  await putStore(page, "drafts", draftKey(shared), shared);
  const second = await context.newPage(); second.on("dialog", dialog => void dialog.accept());
  await second.goto("/");
  await expect(second.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true })).toBeVisible();
  const pages = [page, second], panels = [await openDraft(page, id), await openDraft(second, id)];
  for (const panel of panels) await expect(panel.getByLabel("Ghi chú", { exact: true })).toHaveValue(raw);
  const sends: { tab: number; operationId: string; body: unknown }[] = [];
  const committed: { tab: number; documentId: string }[] = [];
  let releaseAcknowledgement!: () => void;
  const heldAcknowledgement = new Promise<void>(resolve => { releaseAcknowledgement = resolve; });
  for (const [tab, target] of pages.entries()) await target.route(`**${salesRoot}`, async route => {
    if (route.request().method() !== "POST") return route.continue();
    sends.push({ tab, operationId: route.request().headers()["idempotency-key"], body: route.request().postDataJSON() });
    const response = await fetchOwned(route);
    expect(response.status()).toBe(200);
    committed.push({ tab, documentId: (await response.json()).data.saleId });
    // The SQL commit is real. Hold only its original acknowledgement so the
    // independent losing workspace is observed before the winner settles.
    await heldAcknowledgement;
    await route.fulfill({ response });
  });
  try {
    await Promise.all(panels.map(panel => panel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click()));
    await expect.poll(() => sends.length).toBe(1);
    await expect.poll(() => committed.length).toBe(1);
    const winnerIndex = sends[0].tab, loserIndex = 1 - winnerIndex;
    const losingPage = pages[loserIndex], losingPanel = panels[loserIndex];
    await expect(losingPanel).toContainText("Chưa lưu được thao tác trên thiết bị; chưa gửi chứng từ");
    await expect(losingPanel.getByLabel("Ghi chú", { exact: true })).toHaveValue(raw);
    const warning = await preview(losingPage);
    await expect(warning.getByRole("alert").filter({ hasText: "Giữ nguyên trang" })).toBeVisible();
    await losingPage.keyboard.press("Escape");
    const before = await operations(page);
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({ operationId: sends[0].operationId, state: "DISPATCHED", localDocumentId: id });
    expect(before[0].frozen.request.body).toEqual(sends[0].body);
    expect(sends[0].body).toMatchObject({ note: raw });
    releaseAcknowledgement();
    await expect.poll(async () => (await operations(page)).find(value => value.operationId === sends[0].operationId)?.state).toBe("SETTLED");
    const settled = (await operations(page))[0];
    expect(settled.settlement?.resultDocumentId).toBe(committed[0].documentId);
    recordOperation("integratedEditor", settled, committed[0].documentId);
    const saved = (await drafts(page)).find(record => record.localDocumentId === id)!;
    expect(saved).toMatchObject({ unresolvedOperation: false, operationId: null, snapshot: { serverId: committed[0].documentId, dirty: false } });
    await expect(panels[winnerIndex]).toHaveAttribute("aria-label", `Chứng từ ${committed[0].documentId}`);
    await expect(losingPanel.getByLabel("Ghi chú", { exact: true })).toHaveValue(raw);
    // Even an explicit second click in the stale workspace cannot acquire a new
    // intent over the winner's newer checkpoint or dispatch another Create.
    await losingPanel.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
    await expect(losingPanel).toContainText("Chưa lưu được thao tác trên thiết bị; chưa gửi chứng từ");
    expect(await operations(page)).toHaveLength(1);
    expect(sends).toHaveLength(1); expect(committed).toHaveLength(1);
    recordCheck("live-cross-tab");
  } finally { releaseAcknowledgement(); await second.close(); }
});

test("same-origin same-user epoch switch excludes v3 and legacy layouts and rejects a stale tab POST/status", async ({ page, context }) => {
  await login(page);
  const created = await write(page, "integratedEditor", { operationKind: "Sales.Create", method: "POST", routeScope: salesRoot,
    requestTargetId: null, body: salesBody("Existing document for epoch layout") });
  expect(created.status).toBe(200);
  const sale = created.json.data;
  await page.getByRole("region", { name: "Danh sách Sales", exact: true }).getByLabel("Tìm chứng từ", { exact: true }).fill(sale.saleNumber);
  await page.getByTestId("sales-list-grid").locator('[col-id="saleId"]').filter({ hasText: new RegExp(`^${sale.saleId}$`) }).dblclick();
  await expect(page.getByRole("region", { name: `Chứng từ ${sale.saleId}`, exact: true })).toBeVisible();
  const old = await seed(page, "boundary-old-epoch", "Không mở trong cơ sở dữ liệu mới");
  const stale = await openDraft(page, old.localDocumentId);
  const oldKey = `mydmsvn.workspace.layout.v3:${old.deploymentEpoch}:${old.actorKey}`;
  await expect.poll(() => page.evaluate(({ key, saleId }) => {
    const raw = localStorage.getItem(key); if (!raw) return false;
    const value = JSON.parse(raw);
    return value.schemaVersion === 3 && value.dropped === 1 && value.layout.panels[`sales-${saleId}`]?.params.serverId === saleId;
  }, { key: oldKey, saleId: sale.saleId })).toBe(true);
  const oldV3 = await page.evaluate(key => localStorage.getItem(key)!, oldKey);
  const legacy = await page.evaluate(({ raw, actorKey, saleId }) => {
    const v3 = JSON.parse(raw);
    const v2 = { ...v3, schemaVersion: 2, scope: { actorKey } };
    const v1 = structuredClone(v2); v1.schemaVersion = 1; v1.registryVersion = 1;
    for (const panel of Object.values(v1.layout.panels) as { contentComponent: string; params?: { kind?: string; saleId?: string } }[]) {
      if (panel.contentComponent === "sales") panel.params = { saleId }; else delete panel.params;
    }
    const entries = [[`mydmsvn.workspace.layout.v1:${actorKey}`, JSON.stringify(v1)], [`mydmsvn.workspace.layout.v2:${actorKey}`, JSON.stringify(v2)]];
    for (const [key, value] of entries) localStorage.setItem(key, value);
    return entries;
  }, { raw: oldV3, actorKey: old.actorKey, saleId: sale.saleId });
  const rotated = await control("rotateEpoch");
  expect(rotated.deploymentEpoch).not.toBe(old.deploymentEpoch);
  const fresh = await context.newPage(); fresh.on("dialog", dialog => void dialog.accept());
  const staleDocumentReads: string[] = [];
  fresh.on("request", request => { if (request.method() === "GET" && /^\/api\/v1\/(sales-receipts|goods-receipts)\/\d+$/.test(new URL(request.url()).pathname)) staleDocumentReads.push(request.url()); });
  await fresh.goto("/");
  await expect(fresh.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true })).toBeVisible();
  const now = await api(fresh, "/api/v1/operations/context");
  expect(now.json.data).toMatchObject({ deploymentEpoch: rotated.deploymentEpoch, actorUserId: Number(old.actorKey) });
  await expect(fresh.locator("section[data-session-id]")).toHaveCount(0);
  await expect((await preview(fresh)).getByRole("button", { name: "Mở bản nháp", exact: true })).toHaveCount(0);
  expect(staleDocumentReads).toEqual([]);
  for (const [key, value] of legacy) expect(await fresh.evaluate(key => localStorage.getItem(key), key)).toBe(value);
  expect(await fresh.evaluate(key => localStorage.getItem(key), oldKey)).toBe(oldV3);
  expect((await drafts(fresh)).some(record => record.localDocumentId === old.localDocumentId && record.deploymentEpoch === old.deploymentEpoch)).toBe(true);
  let writes = 0;
  page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname === salesRoot) writes++; });
  const rejectedWrite = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === salesRoot);
  await stale.getByRole("button", { name: "Lưu chứng từ", exact: true }).click();
  const post = await rejectedWrite; expect(post.status()).toBe(409);
  expect(post.request().headers()[epochHeader.toLowerCase()]).toBe(old.deploymentEpoch);
  expect((await post.json()).error.code).toBe("Deployment.EpochMismatch");
  await expect(page.getByRole("button", { name: "Đối soát thao tác", exact: true })).toBeVisible();
  const operation = (await operations(page)).find(value => value.localDocumentId === old.localDocumentId)!;
  const rejectedStatus = page.waitForResponse(r => new URL(r.url()).pathname === `/api/v1/operations/${operation.operationId}`);
  const statusDialog = await checkOperation(page, operation.operationId);
  const status = await rejectedStatus; expect(status.status()).toBe(409);
  expect(status.request().headers()[epochHeader.toLowerCase()]).toBe(old.deploymentEpoch);
  await expect(statusDialog).toContainText("Chưa có bằng chứng đã hoàn tất");
  await page.keyboard.press("Escape"); await locked(page, stale, operation.operationId);
  expect(writes).toBe(1); await fresh.close(); recordCheck("epoch-switch");
});
