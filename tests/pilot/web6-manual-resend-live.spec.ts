import { expect, test, type BrowserContext, type Locator, type Page, type Request } from "@playwright/test";
import { randomInt } from "node:crypto";
import { fingerprintWeb4Request, web4OperationPath } from "../../src/infrastructure/http/web4OperationCodec";
import { requestCandidateControl, WEB6_FAIL_CLOSED_TEST_TIMEOUT_MS, type CandidateControlAction } from "./web6-candidate-control";
import { observeWeb6Boundary } from "./web6-boundary-observer";
import {
  control, login, manifest, readStore, recordWeb6Check, recordWeb6Network, recordWeb6Operation,
  type DurableOperationRecord,
} from "./web4-helpers";
import {
  abortBeforeObservation, assertSameFrozenRequest, loseCommittedResponse, web6ManualScenarios,
  type FrozenRequestEvidence, type Web6NetworkEvent, type Web6OperationKind,
} from "./web6-manual-resend-helpers";

const saleRoot = "/api/v1/sales-receipts";
const receiptRoot = "/api/v1/goods-receipts";
type Feature = "sales" | "goods-receipt";

test.beforeEach(({ page }) => { page.on("dialog", dialog => void dialog.accept()); });

function root(feature: Feature) { return feature === "sales" ? saleRoot : receiptRoot; }
function buttonName(feature: Feature, post = false) {
  return feature === "sales" ? post ? "Post chứng từ" : "Lưu chứng từ" : post ? "Post phiếu nhập" : "Lưu phiếu nhập";
}
async function select(page: Page, panel: Locator, label: string, code: string) {
  const input = panel.getByRole("combobox", { name: label, exact: true });
  await input.fill(""); await input.pressSequentially(code);
  await page.getByRole("listbox").getByRole("option").filter({ hasText: new RegExp(`^${code} ·`) }).click();
  await input.press("Tab");
}
async function decimal(panel: Locator, column: string, text: string) {
  await panel.locator(`.ag-row[row-index="0"] [col-id="${column}"]`).dblclick();
  const label = column === "unitCost" ? "Đơn giá nhập dòng 1" : column === "unitPrice" ? "Đơn giá dòng 1" : "Số lượng dòng 1";
  const input = panel.getByLabel(label, { exact: true });
  await input.press("ControlOrMeta+A"); await input.pressSequentially(text); await input.press("Enter");
}
async function newDocument(page: Page, feature: Feature) {
  await page.getByRole("button", { name: feature === "sales" ? "Sales mới" : "Phiếu nhập mới", exact: true }).click();
  const panel = page.getByRole("region", { name: feature === "sales" ? "Chứng từ mới" : "Phiếu nhập mới", exact: true });
  await panel.getByLabel(feature === "sales" ? "Ngày chứng từ" : "Ngày nhập", { exact: true }).fill("2024-02-29");
  if (feature === "sales") await select(page, panel, "Khách hàng", "PILOT-C");
  await select(page, panel, "Kho", "PILOT-W"); await select(page, panel, "Nhân viên", "PILOT-E");
  await panel.locator('.ag-row[row-index="0"] [col-id="product"]').dblclick();
  const product = panel.getByRole("combobox", { name: "Sản phẩm grid", exact: true });
  await product.pressSequentially(feature === "sales" ? "PILOT-P" : "WEB3-RP");
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1);
  await product.press("ArrowDown"); await product.press("Enter");
  await decimal(panel, feature === "sales" ? "qty" : "quantity", "1.0000");
  await decimal(panel, feature === "sales" ? "unitPrice" : "unitCost", feature === "sales" ? "25.0000" : "20.0000");
  return panel;
}

async function candidateControl(action: CandidateControlAction, operation?: DurableOperationRecord) {
  if (manifest.mode !== "web6-candidate") throw Error("WEB6 candidate control requires the strict manifest.");
  const id = randomInt(1, 2147483647);
  const payload = Buffer.from(JSON.stringify({ id, token: manifest.recovery.controlToken, action,
    ...(operation ? { operation: operation.frozen, operationId: operation.operationId } : {}) }), "utf8");
  const prefix = Buffer.alloc(4); prefix.writeInt32LE(payload.length);
  await requestCandidateControl(action, manifest.recovery.controlPipe, id, Buffer.concat([prefix, payload]));
}

async function evidence(request: Request, operation: DurableOperationRecord): Promise<FrozenRequestEvidence> {
  const transmitted = { ...operation.frozen.request, body: request.postDataJSON() };
  expect(transmitted.body).toEqual(operation.frozen.request.body);
  expect(await fingerprintWeb4Request(transmitted)).toBe(operation.frozen.requestFingerprint);
  expect(request.headers()["idempotency-key"]).toBe(operation.operationId);
  expect(request.method()).toBe(operation.frozen.request.method);
  expect(new URL(request.url()).pathname).toBe(web4OperationPath(operation.frozen.request));
  expect(request.headers()["x-mydmsvn-deployment-epoch"]).toBe(operation.deploymentEpoch);
  return {
    operationId: request.headers()["idempotency-key"], operationKind: operation.frozen.request.operationKind as Web6OperationKind,
    deploymentEpoch: request.headers()["x-mydmsvn-deployment-epoch"], method: request.method(), pathname: new URL(request.url()).pathname,
    body: request.postData() ?? "", requestFingerprint: operation.frozen.requestFingerprint,
  };
}
async function operationFor(page: Page, request: Request) {
  const key = request.headers()["idempotency-key"];
  const operation = (await readStore<DurableOperationRecord>(page, "operations")).find(value => value.operationId === key);
  expect(operation, "The browser must persist the frozen operation before dispatch").toBeDefined();
  return operation!;
}
async function openRecovery(page: Page) {
  // A fresh login/tab has no live document owner. Explicitly restore the one
  // protected draft in this isolated scenario before asking for consent.
  if (await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).count() === 0) {
    await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
    const drafts = page.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
    const protectedDraft = drafts.getByRole("listitem").filter({ hasText: "Chứng từ được bảo vệ" });
    await expect(protectedDraft, "WEB6 action=restore requires exactly one protected draft").toHaveCount(1);
    await protectedDraft.getByRole("button", { name: "Mở bản nháp", exact: true }).click();
    await expect(drafts, "WEB6 action=restore completes before recovery preparation").toHaveCount(0);
  }
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
  await expect(dialog.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true })).toBeVisible();
  return dialog;
}
function collectNetwork(page: Page, events: Web6NetworkEvent[]) {
  page.on("response", response => {
    const pathname = new URL(response.url()).pathname, method = response.request().method();
    const routeClass = pathname === "/api/v3/operations/resend-context" ? "resend-context"
      : pathname.endsWith("/resend-receipt") ? "resend-receipt"
      : pathname.endsWith("/resend-eligibility") ? "resend-eligibility"
      : pathname.startsWith(saleRoot) && method !== "GET" ? "sales-write"
      : pathname.startsWith(receiptRoot) && method !== "GET" ? "receipt-write"
      : pathname.includes("/resolution") ? "operation-resolution" : undefined;
    if (routeClass) events.push({ method: method as Web6NetworkEvent["method"], routeClass, status: response.status() });
  });
}
async function installConnectivityProbe(page: Page) {
  await page.evaluate(() => {
    const state = { offline: 0, online: 0 };
    (window as unknown as { __web6Connectivity: typeof state }).__web6Connectivity = state;
    window.addEventListener("offline", () => state.offline++, { once: true });
    window.addEventListener("online", () => state.online++, { once: true });
  });
}
async function expectConnectivity(page: Page, phase: "offline" | "online") {
  await page.waitForFunction(expected => {
    const state = (window as unknown as { __web6Connectivity?: { offline: number; online: number } }).__web6Connectivity;
    return expected === "offline" ? navigator.onLine === false && state?.offline === 1 : navigator.onLine === true && state?.online === 1;
  }, phase);
}

async function prepareScenario(page: Page, feature: Feature, command: "create" | "update" | "post") {
  const initial = await newDocument(page, feature);
  const sessionId = (await initial.getAttribute("data-session-id"))!;
  const panel = page.locator(`section[data-session-id="${sessionId}"]`);
  let target: string | undefined;
  if (command !== "create") {
    const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === root(feature) && response.request().method() === "POST");
    await panel.getByRole("button", { name: buttonName(feature), exact: true }).click();
    const response = await responsePromise; expect(response.status()).toBe(200);
    const data = (await response.json()).data; target = data.saleId ?? data.receiptId;
    if (command === "update") await panel.getByLabel("Ghi chú", { exact: true }).pressSequentially("WEB6 exact frozen update");
  }
  return { panel, path: command === "create" ? root(feature) : `${root(feature)}/${target}/${command === "update" ? "draft" : "post"}` };
}

test("six operation kinds resend the exact original once after explicit consent", async ({ page: firstPage, context }) => {
  test.setTimeout(240_000);
  if (manifest.mode !== "web6-candidate") throw Error("Strict WEB6 manifest required.");
  await login(firstPage, "integratedEditor");
  let first = true;
  for (const scenario of web6ManualScenarios) {
    const page = first ? firstPage : await context.newPage(); first = false;
    if (page !== firstPage) { page.on("dialog", dialog => void dialog.accept()); await page.goto("/"); await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible(); }
    const network: Web6NetworkEvent[] = []; collectNetwork(page, network);
    const prepared = await prepareScenario(page, scenario.feature, scenario.command);
    let original: FrozenRequestEvidence | undefined, operation: DurableOperationRecord | undefined, transmissions = 0, consentDispatches = 0;
    const intercept = async (route: import("@playwright/test").Route) => {
      if (route.request().method() !== scenario.method) return route.continue();
      const stored = await operationFor(page, route.request()), current = await evidence(route.request(), stored);
      expect(stored.frozen.request.operationKind).toBe(scenario.operationKind);
      transmissions++;
      if (!original) {
        expect(network.some(value => value.routeClass === "resend-receipt" && value.status === 200), "Receipt must be issued before the original dispatch").toBe(true);
        original = current; operation = stored; network.push({ method: scenario.method, routeClass: scenario.feature === "sales" ? "sales-write" : "receipt-write", status: 0 });
        await abortBeforeObservation(route); return;
      }
      assertSameFrozenRequest(original, current); consentDispatches++;
      await route.continue();
    };
    await page.route(`**${prepared.path}`, intercept);
    await prepared.panel.getByRole("button", { name: buttonName(scenario.feature, scenario.command === "post"), exact: true }).click();
    await expect(prepared.panel).toContainText("Kết quả chưa rõ");
    expect(operation).toBeDefined(); expect(transmissions).toBe(1); expect(operation!.state).toBe("DISPATCHED");
    await candidateControl("verifyNotObserved", operation);
    const dialog = await openRecovery(page);
    await dialog.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true }).click();
    const consent = page.getByRole("dialog", { name: "Gửi lại đúng thao tác gốc?", exact: true });
    await expect(consent).toBeVisible();
    const response = page.waitForResponse(value => new URL(value.url()).pathname === prepared.path && value.request().method() === scenario.method);
    await consent.getByRole("button", { name: "Xác nhận gửi thao tác gốc", exact: true }).click();
    expect((await response).status()).toBe(200);
    await expect.poll(() => consentDispatches).toBe(1);
    expect(transmissions).toBe(2);
    await candidateControl("verifyOneEffect", operation);
    const verifiedKind = operation!.frozen.request.operationKind as Web6OperationKind;
    expect(verifiedKind).toBe(scenario.operationKind);
    recordWeb6Operation({ operationKind: verifiedKind, operationId: operation!.operationId,
      requestFingerprint: operation!.frozen.requestFingerprint, consentDispatches, candidateId: manifest.candidateId,
      checkId: `web6-${scenario.feature === "sales" ? "sales" : "receipt"}-${scenario.command}` });
    recordWeb6Network(network); await page.unroute(`**${prepared.path}`, intercept);
    if (page !== firstPage) await page.close();
  }
  recordWeb6Check("web6-six-kinds-one-consent");
});

test("committed response loss settles without exposing a resend confirmation", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, "integratedEditor");
  const network: Web6NetworkEvent[] = []; collectNetwork(page, network);
  const prepared = await prepareScenario(page, "sales", "create");
  let operation: DurableOperationRecord | undefined, dispatches = 0;
  const intercept = async (route: import("@playwright/test").Route) => {
    if (route.request().method() !== "POST") return route.continue();
    operation = await operationFor(page, route.request()); dispatches++;
    await loseCommittedResponse(route);
  };
  await page.route(`**${prepared.path}`, intercept);
  await prepared.panel.getByRole("button", { name: buttonName("sales"), exact: true }).click();
  await expect(prepared.panel).toContainText("Kết quả chưa rõ");
  expect(operation).toBeDefined(); expect(dispatches).toBe(1);
  await candidateControl("verifyCommitted", operation);
  const dialog = await openRecovery(page);
  const denied = page.waitForResponse(value => new URL(value.url()).pathname.endsWith("/resend-eligibility"));
  await dialog.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true }).click();
  expect((await denied).status()).toBe(200);
  await expect(page.getByRole("dialog", { name: "Gửi lại đúng thao tác gốc?", exact: true })).toHaveCount(0);
  const resolution = page.waitForResponse(value => new URL(value.url()).pathname === `/api/v2/operations/${operation!.operationId}/resolution`);
  await dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true }).click();
  expect((await resolution).status()).toBe(200);
  await expect.poll(async () => (await readStore<DurableOperationRecord>(page, "operations")).find(value => value.operationId === operation!.operationId)?.state).toBe("SETTLED");
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  await page.reload(); await expect(page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đối soát thao tác", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
  const reopened = page.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
  const resend = reopened.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true });
  await expect(resend).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Gửi lại đúng thao tác gốc?", exact: true })).toHaveCount(0);
  expect(dispatches).toBe(1); recordWeb6Check("web6-committed-loss-no-resend"); recordWeb6Network(network);
});

test("two tabs allow one claim and fail closed across candidate, grant and HTTP changes", async ({ page: first, context }) => {
  test.setTimeout(WEB6_FAIL_CLOSED_TEST_TIMEOUT_MS);
  await login(first, "integratedEditor");
  const prepared = await prepareScenario(first, "goods-receipt", "create");
  let original: FrozenRequestEvidence | undefined, operation: DurableOperationRecord | undefined, consentDispatches = 0;
  const perPage = new Map<Page, number>();
  const intercept = async (route: import("@playwright/test").Route) => {
    if (route.request().method() !== "POST") return route.continue();
    const stored = await operationFor(first, route.request()), current = await evidence(route.request(), stored);
    if (!original) { original = current; operation = stored; await abortBeforeObservation(route); return; }
    assertSameFrozenRequest(original, current); consentDispatches++;
    const owner = route.request().frame().page(); perPage.set(owner, (perPage.get(owner) ?? 0) + 1);
    await route.continue();
  };
  await context.route(`**${prepared.path}`, intercept);
  await prepared.panel.getByRole("button", { name: buttonName("goods-receipt"), exact: true }).click();
  await expect(prepared.panel).toContainText("Kết quả chưa rõ"); expect(operation).toBeDefined();
  await candidateControl("verifyNotObserved", operation);
  let firstRecovery = await openRecovery(first), firstResend = firstRecovery.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true });

  for (const boundary of ["candidateMismatchOn", "eligibility401", "eligibility500"] as const) {
    await test.step(`WEB6 boundary=${boundary} action=prepare`, async () => {
      try {
        await observeWeb6Boundary(boundary, first, {
          control: () => candidateControl(boundary, operation),
          trigger: () => firstResend.click(),
          presentation: async () => {
            const resendVisible = await firstResend.isVisible();
            return {
              loginVisible: await first.getByRole("region", { name: "Đăng nhập", exact: true }).isVisible(),
              recoveryVisible: await firstRecovery.isVisible(), resendEnabled: resendVisible && await firstResend.isEnabled(),
              confirmationVisible: await first.getByRole("dialog", { name: "Gửi lại đúng thao tác gốc?", exact: true }).isVisible(),
            };
          },
          poll: async (check, options) => { await expect.poll(check, options).toBe("PASS"); },
        });
      } finally {
        await candidateControl(boundary === "candidateMismatchOn" ? "candidateMismatchOff" : "eligibilityNormal", operation);
      }
      if (boundary === "eligibility401") {
        // Reactivating the fixture account does not resurrect an expired session.
        // A new explicit login and owned-draft restore are required.
        await login(first, "integratedEditor");
        expect((await readStore<DurableOperationRecord>(first, "operations")).some(value =>
          value.operationId === operation!.operationId && value.state === "DISPATCHED"),
        `WEB6 boundary=${boundary} action=reauth original remains DISPATCHED`).toBe(true);
        firstRecovery = await openRecovery(first);
        firstResend = firstRecovery.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true });
      }
    });
  }
  await control("setWritePermission", false);
  const forbidden = first.waitForResponse(value => new URL(value.url()).pathname.startsWith("/api/v3/operations/"));
  await firstResend.click(); await forbidden; await expect(firstResend).toBeEnabled();
  await expect(first.getByRole("dialog", { name: "Gửi lại đúng thao tác gốc?", exact: true })).toHaveCount(0);
  await control("setWritePermission", true);

  const second = await context.newPage(); second.on("dialog", dialog => void dialog.accept()); await second.goto("/");
  const secondRecovery = await openRecovery(second);
  await Promise.all([firstResend.click(), secondRecovery.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true }).click()]);
  const firstConsent = first.getByRole("dialog", { name: "Gửi lại đúng thao tác gốc?", exact: true });
  const secondConsent = second.getByRole("dialog", { name: "Gửi lại đúng thao tác gốc?", exact: true });
  await expect(firstConsent).toBeVisible(); await expect(secondConsent).toBeVisible();
  const firstConfirm = firstConsent.getByRole("button", { name: "Xác nhận gửi thao tác gốc", exact: true });
  await firstConfirm.dispatchEvent("compositionstart"); await firstConfirm.press("Enter"); expect(consentDispatches).toBe(0);
  await firstConfirm.dispatchEvent("compositionend");
  await Promise.all([
    firstConfirm.dblclick(),
    secondConsent.getByRole("button", { name: "Xác nhận gửi thao tác gốc", exact: true }).dblclick(),
  ]);
  await expect.poll(() => consentDispatches).toBe(1);
  expect([perPage.get(first) ?? 0, perPage.get(second) ?? 0].sort()).toEqual([0, 1]);
  await candidateControl("verifyOneEffect", operation);
  await Promise.all([first.reload(), second.reload()]);
  await expect(first.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true })).toBeVisible();
  await expect(second.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true })).toBeVisible();
  await expect.poll(async () => (await readStore<DurableOperationRecord>(first, "operations")).some(value => value.operationId === operation!.operationId)).toBe(true);
  await expect.poll(async () => (await readStore<DurableOperationRecord>(second, "operations")).some(value => value.operationId === operation!.operationId)).toBe(true);
  await Promise.all([installConnectivityProbe(first), installConnectivityProbe(second)]);
  await context.setOffline(true); await Promise.all([expectConnectivity(first, "offline"), expectConnectivity(second, "offline")]);
  await context.setOffline(false); await Promise.all([expectConnectivity(first, "online"), expectConnectivity(second, "online")]);
  for (const page of [first, second]) {
    await expect(page.getByRole("button", { name: "Đối soát thao tác", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
    const recovery = page.getByRole("dialog", { name: "Bản nháp trên thiết bị", exact: true });
    await expect(recovery.getByRole("button", { name: "Gửi lại đúng thao tác", exact: true })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Gửi lại đúng thao tác gốc?", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
  expect(consentDispatches).toBe(1);
  recordWeb6Check("web6-two-tab-one-claim"); recordWeb6Check("web6-fail-closed-boundaries"); recordWeb6Check("web6-ime-double-click");
  await context.unroute(`**${prepared.path}`, intercept); await second.close();
});
