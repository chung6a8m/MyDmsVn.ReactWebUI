import type { BrowserContext, Request, Response } from "@playwright/test";
import type { FrozenRequestEvidence } from "./web6-manual-resend-helpers";

// The product mutation budget is 30s; retain a finite 5s observation allowance.
// This test-only barrier does not retry a write or change any control budget.
export async function verifyWeb6OneEffectAfterConsent(context: Pick<BrowserContext, "on" | "off">, original: FrozenRequestEvidence, actions: {
  trigger: () => Promise<void>;
  assertDispatches: () => Promise<void>;
  verify: () => Promise<void>;
}) {
  let owner: Request | undefined, failure: Error | undefined;
  let resolve!: () => void, reject!: (error: Error) => void;
  const committedResponse = new Promise<void>((done, failed) => { resolve = done; reject = failed; });
  const fail = (category: string) => { failure ??= Error(`WEB6 one-effect ${category}`); reject(failure); };
  const request = (value: Request) => {
    const headers = value.headers();
    if (value.method() !== original.method || new URL(value.url()).pathname !== original.pathname ||
        headers["idempotency-key"] !== original.operationId || headers["x-mydmsvn-deployment-epoch"] !== original.deploymentEpoch ||
        value.postData() !== original.body) return;
    if (owner) { fail("duplicate-dispatch"); return; }
    owner = value;
  };
  const response = (value: Response) => {
    // A matching URL alone cannot prove this consent completed. Only the exact
    // Request object observed after attaching for this action may supply proof.
    if (!owner || value.request() !== owner) return;
    if (value.status() !== 200) { fail("response-not-successful"); return; }
    void value.finished().then(error => {
      if (error) fail("response-incomplete");
      else resolve();
    }, () => fail("response-incomplete"));
  };
  context.on("request", request); context.on("response", response);
  const timeout = setTimeout(() => fail("response-timeout"), 35_000);
  // Observe rejection even when a synchronous UI trigger throws first.
  void committedResponse.catch(() => {});
  try {
    await Promise.all([actions.trigger(), committedResponse]);
    if (failure) throw failure;
    await actions.assertDispatches();
    if (failure) throw failure;
    await actions.verify();
    if (failure) throw failure;
  } finally {
    clearTimeout(timeout);
    context.off("request", request); context.off("response", response);
  }
}
