import type { Page, Request, Response } from "@playwright/test";
import { assertWeb6BoundaryState, type Web6Boundary, type Web6BoundaryState } from "./web6-boundary-diagnostics";

import { WEB6_BOUNDARY_ASSERTION_MS } from "./web6-pair-budgets";
export const WEB6_ELIGIBILITY401_ASSERTION_TIMEOUT_MS = WEB6_BOUNDARY_ASSERTION_MS.eligibility401;
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
  type Kind = NonNullable<ReturnType<typeof route>>;
  const requests = new WeakMap<Request, { kind: Kind; scope: "control" | "trigger" }>();
  // The decision window opens immediately before invoking the UI trigger and
  // remains open through polling. Control-phase requests and requests whose
  // start was never observed cannot supply decision evidence, even if their
  // response arrives during that window. Preserve Playwright object identity.
  let triggerStarted = false;
  const response = (value: Response) => {
    const path = new URL(value.url()).pathname;
    const kind = route(path), status = value.status();
    const owner = requests.get(value.request());
    if (kind) record(`response:${owner?.scope ?? "unobserved-request"}:${kind}:${Number.isSafeInteger(status) && status >= 100 && status <= 599 ? status : "unobserved"}`);
    if (owner?.scope !== "trigger" || owner.kind !== kind) return;
    if (kind === "context") http.contextStatus = status;
    else if (kind === "eligibility") http.eligibilityStatus = status;
    else if (kind === "refresh") http.refreshStatus = status;
  };
  const request = (value: Request) => {
    const path = new URL(value.url()).pathname;
    const kind = route(path);
    const scope = triggerStarted ? "trigger" : "control";
    if (kind) {
      record(`request:${scope}:${kind}`);
      if (value.method() === (kind === "refresh" ? "POST" : "GET")) requests.set(value, { kind, scope });
    }
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
    triggerStarted = true;
    await actions.trigger();
    mark("trigger-done");
    mark("poll");
    await actions.poll(async () => {
      const presentation = await actions.presentation();
      try { assertWeb6BoundaryState(boundary, { ...http, additionalMutations, ...presentation }); return "PASS"; }
      catch (error) { return `${(error as Error).message} observer=${JSON.stringify({ phase, events, omittedEvents })}`; }
    }, { timeout: WEB6_BOUNDARY_ASSERTION_MS[boundary],
      message: `WEB6 boundary=${boundary} action=prepare HTTP/auth/recovery contract` });
  } finally {
    page.off("response", response); page.off("request", request);
  }
}
