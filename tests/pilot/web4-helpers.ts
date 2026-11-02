import { expect, type Page } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { randomUUID, randomInt } from "node:crypto";
import { fingerprintWeb4Request, web4OperationPath, type Web4WireIntent } from "../../src/infrastructure/http/web4OperationCodec";
import type { DraftRecord } from "../../src/infrastructure/drafts/draftRecord";
import type { DurableOperationRecord } from "../../src/infrastructure/drafts/web4OperationRepository";
export type { DraftRecord, DurableOperationRecord, Web4WireIntent };

export type Actor = "integratedEditor" | "poster" | "receiptPoster" | "bob" | "alice" | "receiptEditor" | "receiptReader" | "balanceReader" | "cardReader";
export type Manifest = {
  mode: "web4-recovery"; origin: string; resultPath: string;
  actors: Record<Actor, { username: string; password: string }>;
  catalog: { customerId: number; warehouseId: number; employeeId: number; productId: number };
  receiptCatalog: { warehouseId: number; employeeId: number; productId: number };
  integratedCatalog: { warehouseId: number; otherWarehouseId: number; employeeId: number; customerId: number; productId: number };
  recovery: { version: 1; deploymentEpoch: string; controlPipe: string; controlToken: string };
};
export const manifest: Manifest = JSON.parse(readFileSync(process.env.MYDMSVN_WEB_PILOT_MANIFEST!, "utf8"));
if (manifest.mode !== "web4-recovery" || manifest.recovery?.version !== 1 || manifest.origin !== "https://localhost:44321") throw Error("Owned WEB4 v1 fixture required.");
export const accessKey = "mydmsvn.access.v1";

export async function login(page: Page, actor: Actor = "integratedEditor") {
  await page.goto("/");
  try {
    await page.getByLabel("Tên đăng nhập", { exact: true }).fill(manifest.actors[actor].username);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(manifest.actors[actor].password);
  } catch { throw Error("Owned pilot credential entry failed before login."); }
  const authenticated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/auth/login" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  expect((await authenticated).status(), "Owned pilot login HTTP status").toBe(200);
  await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/MyDmsVn/);
  expect(new URL(page.url()).origin).toBe(manifest.origin);
}

// Authentication stays inside the page. Never return/log bearer or cookie values.
// Every successful response is real IIS/SQL; callers mark deliberate negative
// response injection in their test names, not as SQL success evidence.
export async function api(page: Page, path: string, method = "GET", body?: unknown, overrides: Record<string, string | null> = {}) {
  return page.evaluate(async args => {
    const headers: Record<string, string> = { Authorization: `Bearer ${localStorage.getItem(args.accessKey)}`, "Content-Type": "application/json" };
    const context = await fetch("/api/v1/operations/context", { headers, credentials: "omit" });
    if (context.ok) headers["X-MyDmsVn-Deployment-Epoch"] = (await context.json()).data.deploymentEpoch;
    for (const [key, value] of Object.entries(args.overrides)) { if (value === null) delete headers[key]; else headers[key] = value; }
    const response = await fetch(args.path, { method: args.method, credentials: "omit", headers, body: args.body === undefined ? undefined : JSON.stringify(args.body) });
    const safeHeaders: Record<string, string> = {};
    for (const name of ["content-security-policy", "cache-control", "content-type", "x-content-type-options"]) {
      const value = response.headers.get(name); if (value) safeHeaders[name] = value;
    }
    return { status: response.status, json: await response.json(), headers: safeHeaders };
  }, { path, method, body, overrides, accessKey });
}

type OperationResult = { actor: Actor; operationId: string; operationKind: string; requestTargetId: string | null; resultDocumentId: string; requestFingerprint: string; deploymentEpoch: string };
type PostedResult = { documentType: "GoodsReceipt"; receiptId: string; quantity: string; value: string; actor: Actor; scenario?: string }
  | { documentType?: "SalesReceipt"; saleId: string; quantity: string; cost: string; actor: Actor; scenario?: string };
type Result = { version: 1; mode: "web4-recovery"; operations: OperationResult[]; posted: PostedResult[]; checks: string[] };
function updateResult(change: (result: Result) => void) {
  const result: Result = existsSync(manifest.resultPath) ? JSON.parse(readFileSync(manifest.resultPath, "utf8")) : { version: 1, mode: "web4-recovery", operations: [], posted: [], checks: [] };
  change(result); writeFileSync(manifest.resultPath, JSON.stringify(result), "utf8");
}
function addOperation(row: OperationResult) {
  updateResult(result => {
    const old = result.operations.find(value => value.operationId === row.operationId);
    if (old) expect(old).toEqual(row); else result.operations.push(row);
  });
}
export function recordOperation(actor: Actor, operation: DurableOperationRecord, resultDocumentId: string) {
  addOperation({ actor, operationId: operation.operationId, operationKind: operation.frozen.request.operationKind,
    requestTargetId: operation.frozen.request.requestTargetId, resultDocumentId,
    requestFingerprint: operation.frozen.requestFingerprint, deploymentEpoch: operation.deploymentEpoch });
}
export function recordPost(row: PostedResult) { updateResult(result => result.posted.push(row)); }
export function recordCheck(id: string) { updateResult(result => { if (!result.checks.includes(id)) result.checks.push(id); }); }

// Test setup uses the pinned canonical consumer codec and a NEW explicit intent.
// No retries. The SQL owner cross-checks every successful setup write too.
export async function write(page: Page, actor: Actor, intent: Web4WireIntent, operationId = randomUUID()) {
  const requestFingerprint = await fingerprintWeb4Request(intent);
  const result = await api(page, web4OperationPath(intent), intent.method, intent.body, { "Idempotency-Key": operationId });
  if (result.status === 200) {
    const status = await api(page, `/api/v1/operations/${operationId}`, "GET", undefined, { "X-MyDmsVn-Operation-Fingerprint": requestFingerprint });
    expect(status.status).toBe(200);
    expect(status.json.data).toMatchObject({ operationId, requestFingerprint, operationKind: intent.operationKind, method: intent.method, routeScope: intent.routeScope, requestTargetId: intent.requestTargetId, state: "COMMITTED", outcome: result.json });
    addOperation({ actor, operationId, operationKind: intent.operationKind, requestTargetId: intent.requestTargetId,
      resultDocumentId: result.json.data.saleId ?? result.json.data.receiptId, requestFingerprint, deploymentEpoch: status.json.data.deploymentEpoch });
  }
  return result;
}

export async function readStore<T = DraftRecord | DurableOperationRecord>(page: Page, store: "drafts" | "operations"): Promise<T[]> {
  return page.evaluate(async (store): Promise<unknown[]> => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("mydmsvn-drafts-v1", 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(Error("Native draft database unavailable")); });
    try { return await new Promise<unknown[]>((resolve, reject) => { const tx = db.transaction(store); const r = tx.objectStore(store).getAll(); let values: unknown[]; r.onsuccess = () => { values = r.result; }; tx.oncomplete = () => resolve(values); tx.onabort = () => reject(Error("Native draft read aborted")); }); }
    finally { db.close(); }
  }, store) as Promise<T[]>;
}
export async function putStore(page: Page, store: "drafts" | "operations", key: string[], value: unknown) {
  await page.evaluate(async args => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("mydmsvn-drafts-v1", 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(Error("Native draft database unavailable")); });
    try { await new Promise<void>((resolve, reject) => { const tx = db.transaction(args.store, "readwrite"); tx.objectStore(args.store).put(args.value, args.key); tx.oncomplete = () => resolve(); tx.onabort = () => reject(Error("Native test edit aborted")); }); }
    finally { db.close(); }
  }, { store, key, value });
}
export async function openDraft(page: Page, localDocumentId: string) {
  const record = (await readStore<DraftRecord>(page, "drafts")).find(value => value.localDocumentId === localDocumentId)!;
  expect(record).toBeDefined();
  await page.getByRole("button", { name: "Bản nháp trên thiết bị", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
  const row = dialog.locator("li").filter({ hasText: record.operationId ?? `${record.feature === "sales" ? "Sales" : "Phiếu nhập"} · ${record.snapshot.serverId ?? "Chứng từ mới"}` });
  await row.getByRole("button", { name: "Mở bản nháp", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  return page.locator(`section[data-session-id="${localDocumentId}"]`);
}
export async function checkOperation(page: Page, operationId: string) {
  await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
  const current = dialog.getByRole("region", { name: "Đối soát thao tác", exact: true });
  await expect(current).toContainText(operationId);
  await current.getByRole("button", { name: "Kiểm tra kết quả", exact: true }).click();
  return dialog;
}

// Test-process IPC only: no production HTTP endpoint, no SQL/credentials in page.
export async function control(action: "rotateEpoch" | "setWritePermission", granted?: boolean): Promise<{ deploymentEpoch?: string }> {
  const id = randomInt(1, 2147483647);
  const payload = Buffer.from(JSON.stringify({ id, token: manifest.recovery.controlToken, action, ...(granted === undefined ? {} : { granted }) }), "utf8");
  const prefix = Buffer.alloc(4); prefix.writeInt32LE(payload.length);
  const reply = await new Promise<{ id: number; ok: boolean; deploymentEpoch?: string }>((resolve, reject) => {
    const socket = connect(manifest.recovery.controlPipe); let bytes = Buffer.alloc(0); let settled = false;
    function fail() { if (!settled) { settled = true; reject(Error("Owned WEB4 fixture control failed")); } socket.destroy(); }
    socket.setTimeout(10_000, fail); socket.on("error", fail); socket.on("end", () => { if (!settled) fail(); });
    socket.on("connect", () => socket.write(Buffer.concat([prefix, payload])));
    socket.on("data", chunk => {
      bytes = Buffer.concat([bytes, chunk]); if (bytes.length < 4) return;
      const length = bytes.readInt32LE(0); if (length < 2 || length > 4096) return fail(); if (bytes.length < length + 4) return;
      try { const value = JSON.parse(bytes.subarray(4, length + 4).toString("utf8")); if (value.id !== id || value.ok !== true) return fail(); settled = true; resolve(value); socket.end(); }
      catch { fail(); }
    });
  });
  if (reply.deploymentEpoch) manifest.recovery.deploymentEpoch = reply.deploymentEpoch;
  return reply;
}
