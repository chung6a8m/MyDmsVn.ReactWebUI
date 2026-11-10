import type { BrowserContext, Request, Response } from "@playwright/test";
import type { FrozenRequestEvidence } from "./web6-manual-resend-helpers";

// confirmManualResend awaits context GET then eligibility GET (30s each).
// Retain the existing 5s UI/IDB observation allowance before exact dispatch.
const WEB6_CONSENT_DISPATCH_TIMEOUT_MS = 30_000 + 30_000 + 5_000;
const WEB6_MUTATION_RESPONSE_TIMEOUT_MS = 30_000 + 5_000;
// These test-only phase budgets never retry a write or change control budgets.
export async function verifyWeb6OneEffectAfterConsent(context: Pick<BrowserContext, "on" | "off">, original: FrozenRequestEvidence, actions: {
  trigger: () => Promise<void>;
  assertDispatches: () => Promise<void>;
  verify: () => Promise<void>;
}) {
  let owner: Request | undefined, failure: Error | undefined;
  let observing = true;
  let deadline = Date.now() + WEB6_CONSENT_DISPATCH_TIMEOUT_MS;
  let timeout: ReturnType<typeof setTimeout>;
  let resolve!: () => void, reject!: (error: Error) => void;
  const committedResponse = new Promise<void>((done, failed) => { resolve = done; reject = failed; });
  const fail = (category: string) => {
    if (!observing) return;
    failure ??= Error(`WEB6 one-effect ${category}`); clearTimeout(timeout); reject(failure);
  };
  const request = (value: Request) => {
    if (!observing || failure) return;
    const headers = value.headers();
    if (value.method() !== original.method || new URL(value.url()).pathname !== original.pathname ||
        headers["idempotency-key"] !== original.operationId || headers["x-mydmsvn-deployment-epoch"] !== original.deploymentEpoch ||
        value.postData() !== original.body) return;
    if (owner) { fail("duplicate-dispatch"); return; }
    if (Date.now() >= deadline) { fail("dispatch-timeout"); return; }
    owner = value;
    clearTimeout(timeout);
    deadline = Date.now() + WEB6_MUTATION_RESPONSE_TIMEOUT_MS;
    timeout = setTimeout(() => fail("response-timeout"), WEB6_MUTATION_RESPONSE_TIMEOUT_MS);
  };
  const response = (value: Response) => {
    // A matching URL alone cannot prove this consent completed. Only the exact
    // Request object observed after attaching for this action may supply proof.
    if (!observing || failure || !owner || value.request() !== owner) return;
    if (value.status() !== 200) { fail("response-not-successful"); return; }
    void value.finished().then(error => {
      if (!observing || failure) return;
      if (error) fail("response-incomplete");
      else if (Date.now() >= deadline) fail("response-timeout");
      else { clearTimeout(timeout); resolve(); }
    }, () => fail("response-incomplete"));
  };
  const requestFailed = (value: Request) => { if (value === owner) fail("response-incomplete"); };
  context.on("request", request); context.on("response", response); context.on("requestfailed", requestFailed);
  timeout = setTimeout(() => fail("dispatch-timeout"), WEB6_CONSENT_DISPATCH_TIMEOUT_MS);
  // Observe rejection even when a synchronous UI trigger throws first.
  void committedResponse.catch(() => {});
  try {
    await Promise.all([actions.trigger(), committedResponse]);
    clearTimeout(timeout);
    if (failure) throw failure;
    await actions.assertDispatches();
    if (failure) throw failure;
    await actions.verify();
    if (failure) throw failure;
  } finally {
    observing = false;
    clearTimeout(timeout);
    context.off("request", request); context.off("response", response); context.off("requestfailed", requestFailed);
  }
}
