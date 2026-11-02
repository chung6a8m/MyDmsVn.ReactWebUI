import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const contextFixture = JSON.parse(readFileSync(new URL("../../fixtures/web4-v1/corpus/context-response.json", import.meta.url), "utf8"));
const salesDetail = JSON.parse(readFileSync(new URL("../../fixtures/web2-v1/sales-get-draft-response.json", import.meta.url), "utf8"));
const salesList = JSON.parse(readFileSync(new URL("../../fixtures/web2-v1/sales-list-response.json", import.meta.url), "utf8"));
const receiptDetail = JSON.parse(readFileSync(new URL("../../fixtures/web3-v1/receipt-get-draft-response.json", import.meta.url), "utf8"));
const receiptList = JSON.parse(readFileSync(new URL("../../fixtures/web3-v1/receipt-list-empty-response.json", import.meta.url), "utf8"));
const customers = JSON.parse(readFileSync(new URL("../../fixtures/web2-v1/catalog-customers-response.json", import.meta.url), "utf8"));
const warehouses = JSON.parse(readFileSync(new URL("../../fixtures/web2-v1/catalog-warehouses-response.json", import.meta.url), "utf8"));
const employees = JSON.parse(readFileSync(new URL("../../fixtures/web2-v1/catalog-employees-response.json", import.meta.url), "utf8"));
const products = JSON.parse(readFileSync(new URL("../../fixtures/web2-v1/catalog-products-response.json", import.meta.url), "utf8"));

export async function productionHttp(page: Page, options: { storageDenied?: boolean } = {}) {
  const owner = { actorUserId: 42, deploymentEpoch: contextFixture.data.deploymentEpoch };
  const businessWrites: string[] = [], unexpected: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (["error", "warning"].includes(message.type())) errors.push(message.text()); });
  page.on("dialog", dialog => void dialog.accept());
  const token = `e30.${Buffer.from(JSON.stringify({ sid: "web4-browser-session", exp: 9999999999 })).toString("base64url")}.fixture-signature`;
  await page.addInitScript(({ tokenValue, storageDenied }) => {
    localStorage.setItem("mydmsvn.access.v1", tokenValue);
    const state = window as Window & { web4ReadDenied?: boolean };
    state.web4ReadDenied = storageDenied;
    const originalOpen = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function(...args: Parameters<IDBFactory["open"]>) {
      if (state.web4ReadDenied && args[0] === "mydmsvn-drafts-v1") throw new DOMException("Controlled storage denial", "SecurityError");
      return originalOpen.apply(this, args);
    };
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args: Parameters<IDBObjectStore["put"]>) {
      if ((window as Window & { web4Quota?: boolean }).web4Quota && this.name === "drafts" && this.transaction.db.name === "mydmsvn-drafts-v1")
        throw new DOMException("Controlled native storage quota failure", "QuotaExceededError");
      return original.apply(this, args);
    };
  }, { tokenValue: token, storageDenied: options.storageDenied ?? false });
  await page.route("**/api/v1/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const user = { userId: owner.actorUserId, username: `owner-${owner.actorUserId}`, displayName: `Owner ${owner.actorUserId}` };
    const fulfill = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "no-store", Pragma: "no-cache", Expires: "0" }, body: JSON.stringify(body) });
    if (path === "/api/v1/auth/me") return fulfill({ data: user });
    if (path === "/api/v1/operations/context") return fulfill({ data: { ...owner, contractVersion: "web4-v1" } });
    if (path === "/api/v1/auth/capabilities") {
      const inventory = new URL(request.url()).searchParams.get("feature")?.startsWith("inventory-");
      return fulfill({ data: inventory ? { read: true } : { read: true, write: true, post: true } });
    }
    if (path === "/api/v1/auth/login" || path === "/api/v1/auth/refresh") return fulfill({ data: { accessToken: token, expiresAtUtc: "2286-11-20T17:46:39Z", user } });
    if (path === "/api/v1/auth/logout") return fulfill({ data: null });
    if (request.method() !== "GET" && /^\/api\/v1\/(sales-receipts|goods-receipts)(\/|$)/.test(path)) {
      businessWrites.push(`${request.method()} ${path}`);
      return fulfill({ error: { code: "Operation.Unavailable", message: "Write is unavailable in the F02 browser fixture.", details: [] } }, 503);
    }
    if (path === "/api/v1/sales-receipts") return fulfill(salesList);
    if (path === `/api/v1/sales-receipts/${salesDetail.data.saleId}`) return fulfill(salesDetail);
    if (path === "/api/v1/goods-receipts") return fulfill(receiptList);
    if (path === `/api/v1/goods-receipts/${receiptDetail.data.receiptId}`) return fulfill(receiptDetail);
    const lookup = { customers, warehouses, employees, products }[path.split("/")[4] as "customers"];
    if (path.startsWith("/api/v1/catalog/") && lookup) return fulfill(lookup);
    unexpected.push(`${request.method()} ${path}`);
    return fulfill({ error: { code: "NotFound", message: "Unexpected fixture request.", details: [] } }, 404);
  });
  await page.goto("/");
  await expect(page).toHaveTitle("MyDmsVn Web UI");
  await expect(page.getByRole("toolbar", { name: "Workspace", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sales mới", exact: true })).toBeEnabled();
  return { owner, businessWrites, unexpected, errors };
}
