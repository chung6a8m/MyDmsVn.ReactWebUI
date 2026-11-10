import type { Page, Request, Response } from "@playwright/test";
import { assertWeb6BoundaryState, type Web6Boundary, type Web6BoundaryState } from "./web6-boundary-diagnostics";

// Inactive-account control: httpTransport.send context <=30s, then denied
// authApi.change refresh <=15s. An expiring token can take refresh only (15s).
// Retain the existing Playwright 5s UI/poll allowance after these request budgets.
// This is a finite selector wait, not a product timeout or an IPC budget change.
export const WEB6_ELIGIBILITY401_ASSERTION_TIMEOUT_MS = 30_000 + 15_000 + 5_000;
type Presentation = Pick<Web6BoundaryState, "loginVisible" | "recoveryVisible" | "resendEnabled" | "confirmationVisible">;

// Extracted live-selector sequence. Page events and polling are injected so the
// exact observer/control/trigger contract can also run without a live browser.
export async function observeWeb6Boundary(boundary: Web6Boundary, page: Pick<Page, "on" | "off">, actions: {
  control: () => Promise<void>;
  trigger: () => Promise<void>;
  presentation: () => Promise<Presentation>;
  poll: (check: () => Promise<string>, options: { timeout: number; message: string }) => Promise<void>;
}) {
  const http = { contextStatus: null, eligibilityStatus: null, refreshStatus: null } as
    Pick<Web6BoundaryState, "contextStatus" | "eligibilityStatus" | "refreshStatus">;
  let additionalMutations = 0;
  let phase = "attached";
  const events: string[] = [];
  let omittedEvents = 0;
  const record = (event: string) => { if (events.length < 32) events.push(event); else omittedEvents++; };
  const mark = (value: string) => { phase = value; record(value); };
  const route = (path: string) => path === "/api/v3/operations/resend-context" ? "context"
    : path.endsWith("/resend-eligibility") ? "eligibility"
    : path === "/api/v1/auth/refresh" ? "refresh" : null;
  const response = (value: Response) => {
    const path = new URL(value.url()).pathname;
    const kind = route(path), status = value.status();
    if (kind) record(`response:${kind}:${Number.isSafeInteger(status) && status >= 100 && status <= 599 ? status : "unobserved"}`);
    if (path === "/api/v3/operations/resend-context") http.contextStatus = value.status();
    else if (path.endsWith("/resend-eligibility")) http.eligibilityStatus = value.status();
    else if (path === "/api/v1/auth/refresh") http.refreshStatus = value.status();
  };
  const request = (value: Request) => {
    const path = new URL(value.url()).pathname;
    const kind = route(path);
    if (kind) record(`request:${kind}`);
    if (["POST", "PUT", "DELETE", "PATCH"].includes(value.method()) &&
        (path.startsWith("/api/v1/sales-receipts") || path.startsWith("/api/v1/goods-receipts"))) { additionalMutations++; record("request:business-mutation"); }
  };
  page.on("response", response); page.on("request", request);
  mark("attached");
  try {
    mark("control-start");
    await actions.control();
    mark("control-done");
    mark("trigger-start");
    await actions.trigger();
    mark("trigger-done");
    mark("poll");
    await actions.poll(async () => {
      const presentation = await actions.presentation();
      try { assertWeb6BoundaryState(boundary, { ...http, additionalMutations, ...presentation }); return "PASS"; }
      catch (error) { return `${(error as Error).message} observer=${JSON.stringify({ phase, events, omittedEvents })}`; }
    }, { timeout: boundary === "eligibility401" ? WEB6_ELIGIBILITY401_ASSERTION_TIMEOUT_MS : 5_000,
      message: `WEB6 boundary=${boundary} action=prepare HTTP/auth/recovery contract` });
  } finally {
    page.off("response", response); page.off("request", request);
  }
}
