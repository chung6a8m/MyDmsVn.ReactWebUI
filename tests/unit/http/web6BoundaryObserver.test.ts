import { EventEmitter } from "node:events";
import type { Page } from "@playwright/test";
import { afterEach, expect, it, vi } from "vitest";
import { observeWeb6Boundary } from "../../pilot/web6-boundary-observer";
import { web6AuthHarness } from "./web6AuthHarness";
import type { Web6Boundary } from "../../pilot/web6-boundary-diagnostics";

afterEach(() => vi.useRealTimers());
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
// A controlled polling adapter; the selector owns its predicate and deadline.
async function poll(check: () => Promise<string>, options: { timeout: number }) {
  const deadline = Date.now() + options.timeout;
  while (true) {
    const result = await check();
    if (result === "PASS") return;
    if (Date.now() >= deadline) throw Error(result);
    // Keep long sequential HTTP paths cheap under fake timers while still
    // clamping the final observation exactly to the selector deadline.
    await delay(Math.min(1000, deadline - Date.now()));
  }
}
async function fixture(expiring: boolean, contextDelay = 0, refreshDelay = 0,
  boundary: Web6Boundary = "eligibility401", eligibilityDelay = 0) {
  vi.useFakeTimers();
  const page = new EventEmitter();
  const s = await web6AuthHarness(boundary, {
    expiresInMs: expiring ? 31_000 : undefined,
    beforeResponse: async path => {
      if (path === "/api/v3/operations/resend-context") await delay(contextDelay);
      if (path === "/api/v1/auth/refresh") await delay(refreshDelay);
      if (path.endsWith("/resend-eligibility")) await delay(eligibilityDelay);
    },
    onRequest: (_path, _method, request) => page.emit("request", request),
    onResponse: (path, _method, status, request) => page.emit("response", {
      url: () => `https://fixture.invalid${path}`, status: () => status, request: () => request,
    }),
  });
  let prepare: Promise<unknown> = Promise.resolve();
  let prepared = false;
  const actions = {
    control: async () => { if (expiring) await delay(1001); },
    trigger: async () => { prepare = s.prepare().catch(() => undefined).finally(() => { prepared = true; }); },
    presentation: async () => {
      const signedOut = s.auth.getSnapshot().status === "reauth-required";
      return { loginVisible: signedOut, recoveryVisible: !signedOut, resendEnabled: !signedOut && prepared, confirmationVisible: false };
    }, poll,
  };
  return { s, page, actions, drain: () => prepare,
    run: () => observeWeb6Boundary(boundary, page as unknown as Pick<Page, "on" | "off">, actions) };
}

it.each([
  { boundary: "candidateMismatchOn", context: 29_000, eligibility: 0, completion: 30_100, reads: 1 },
  { boundary: "eligibility500", context: 29_000, eligibility: 29_000, completion: 59_100, reads: 2 },
] as const)("$boundary waits for its sequential request path beyond five seconds without false PASS", async value => {
  const f = await fixture(false, value.context, 0, value.boundary, value.eligibility);
  let settled = false;
  const result = f.run().then(() => "PASS", error => error.message).then(value => { settled = true; return value; });
  await vi.advanceTimersByTimeAsync(5001); expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(value.completion - 5001);
  expect(await result).toBe("PASS");
  expect(f.s.requests.map(request => request.method)).toEqual(Array(value.reads).fill("GET"));
  expect(f.s.auth.getSnapshot().status).toBe("authenticated");
  expect(f.page.eventNames()).toEqual([]);
}, 15_000);

it.each([
  { boundary: "candidateMismatchOn", deadline: 35_000 },
  { boundary: "eligibility401", deadline: 50_000 },
  { boundary: "eligibility500", deadline: 65_000 },
] as const)("$boundary expires exactly at its derived $deadline deadline without inventing response evidence", async value => {
  const f = await fixture(false, 0, 0, value.boundary);
  f.actions.trigger = async () => {};
  let settled = false;
  const result = f.run().then(() => "PASS", error => error.message).then(value => { settled = true; return value; });
  await vi.advanceTimersByTimeAsync(value.deadline - 1); expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1); expect(settled).toBe(true);
  expect(await result).not.toBe("PASS");
  expect(await result).toContain('"contextStatus":null');
  expect(f.page.eventNames()).toEqual([]);
});

it("accepts correlated context 200 and eligibility 503 for the historical eligibility500 control", async () => {
  vi.useFakeTimers();
  const page = new EventEmitter();
  const result = observeWeb6Boundary("eligibility500", page as unknown as Pick<Page, "on" | "off">, {
    control: async () => {},
    trigger: async () => {
      for (const [path, status] of [["/api/v3/operations/resend-context", 200],
        ["/api/v3/operations/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/resend-eligibility", 503]] as const) {
        const request = { url: () => `https://fixture.invalid${path}`, method: () => "GET" };
        page.emit("request", request);
        page.emit("response", { url: request.url, status: () => status, request: () => request });
      }
    },
    presentation: async () => ({ loginVisible: false, recoveryVisible: true, resendEnabled: true, confirmationVisible: false }),
    poll,
  }).then(() => "PASS", error => error.message);
  await vi.advanceTimersByTimeAsync(5000);
  expect(await result).toBe("PASS");
  expect(page.eventNames()).toEqual([]);
});

it("accepts a denied access preflight refresh without requiring a context response that never occurs", async () => {
  const f = await fixture(true);
  const result = f.run().then(() => "PASS", error => error.message);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(await result).toBe("PASS");
  expect(f.s.requests).toEqual([{ path: "/api/v1/auth/refresh", method: "POST" }]);
  expect(f.s.storage.size).toBe(0);
  expect(f.page.eventNames()).toEqual([]);
});

it("allows context and refresh responses within their sequential HTTP deadlines beyond the old five seconds", async () => {
  const f = await fixture(false, 29_000, 14_000);
  let settled = false;
  const result = f.run().then(() => "PASS", error => error.message).then(value => { settled = true; return value; });
  await vi.advanceTimersByTimeAsync(5001);
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(38_100);
  expect(await result).toBe("PASS");
  expect(f.s.auth.getSnapshot().status).toBe("reauth-required");
  expect(f.s.requests).toEqual([{ path: "/api/v3/operations/resend-context", method: "GET" }, { path: "/api/v1/auth/refresh", method: "POST" }]);
  expect(f.page.eventNames()).toEqual([]);
});

it("captures immediate trigger responses before polling and detaches afterwards", async () => {
  const f = await fixture(false);
  f.actions.trigger = async () => { await f.s.prepare().catch(() => undefined); };
  const result = f.run();
  await vi.advanceTimersByTimeAsync(1);
  await expect(result).resolves.toBeUndefined();
  expect(f.page.eventNames()).toEqual([]);
});

it("rejects a no-op trigger even when control requests produce matching denial and signed-out UI", async () => {
  const f = await fixture(false);
  f.actions.control = async () => { await f.s.prepare().catch(() => undefined); };
  f.actions.trigger = async () => {};
  const result = f.run().then(() => "PASS", error => error.message);
  await vi.advanceTimersByTimeAsync(50_001);
  expect(await result).not.toBe("PASS");
  expect(await result).toContain('"refreshStatus":null');
  expect(await result).toContain('"request:control:refresh"');
  expect(await result).toContain('"response:control:refresh:401"');
  expect(f.s.auth.getSnapshot().status).toBe("reauth-required");
  expect(f.page.eventNames()).toEqual([]);
});

it("rejects a refresh started before observer setup whose denial arrives after the current trigger", async () => {
  const f = await fixture(true, 0, 6000);
  await vi.advanceTimersByTimeAsync(1001);
  const previous = f.s.prepare().catch(() => undefined);
  // Ensure the old refresh request has started, but hold its response in flight.
  await vi.advanceTimersByTimeAsync(1);
  const result = f.run().then(() => "PASS", error => error.message);
  await vi.advanceTimersByTimeAsync(52_000);
  await previous; await f.drain();
  expect(f.s.auth.getSnapshot().status).toBe("reauth-required");
  expect(f.s.requests).toEqual([{ path: "/api/v1/auth/refresh", method: "POST" }]);
  expect(await result).not.toBe("PASS");
  expect(await result).toContain('"refreshStatus":null');
  expect(await result).toContain('"response:unobserved-request:refresh:401"');
  expect(f.page.eventNames()).toEqual([]);
});

it("keeps an in-flight control request out of decision evidence when its response arrives after trigger", async () => {
  const f = await fixture(false, 0, 6000);
  let controlRefresh = Promise.resolve();
  f.actions.control = async () => {
    controlRefresh = f.s.auth.refresh().catch(() => undefined);
    await delay(1); // Request observed during control; response still pending.
  };
  f.actions.trigger = async () => {};
  const result = f.run().then(() => "PASS", error => error.message);
  await vi.advanceTimersByTimeAsync(50_002);
  await controlRefresh;
  expect(await result).not.toBe("PASS");
  expect(await result).toContain('"refreshStatus":null');
  expect(await result).toContain('"response:control:refresh:401"');
  expect(f.s.auth.getSnapshot().status).toBe("reauth-required");
  expect(f.page.eventNames()).toEqual([]);
});

it("rejects an unrelated same-path response even after observing a current-trigger request", async () => {
  const f = await fixture(false);
  const current = { url: () => "https://fixture.invalid/api/v1/auth/refresh", method: () => "POST" };
  const unrelated = { ...current };
  f.actions.trigger = async () => {
    f.page.emit("request", current);
    f.page.emit("response", { url: current.url, status: () => 401, request: () => unrelated });
    f.s.auth.expire();
  };
  const result = f.run().then(() => "PASS", error => error.message);
  await vi.advanceTimersByTimeAsync(50_000);
  expect(await result).not.toBe("PASS");
  expect(await result).toContain('"refreshStatus":null');
  expect(await result).toContain('"request:trigger:refresh"');
  expect(await result).toContain('"response:unobserved-request:refresh:401"');
  expect(f.page.eventNames()).toEqual([]);
});

it("does not invent evidence for events before setup; reports only bounded sanitized ordering on finite expiry", async () => {
  const f = await fixture(false);
  const prior = f.s.prepare().catch(() => undefined);
  await vi.advanceTimersByTimeAsync(1); await prior;
  f.actions.trigger = async () => {};
  let settled = false;
  const result = f.run().then(() => "PASS", error => error.message).then(value => { settled = true; return value; });
  await vi.advanceTimersByTimeAsync(49_999); expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  const diagnostic = await result;
  expect(diagnostic).toContain('"refreshStatus":null');
  expect(diagnostic).toContain('"phase":"poll"');
  expect(diagnostic).toContain('"events":["attached","control-start","control-done","trigger-start","trigger-done","poll"]');
  expect(diagnostic).not.toMatch(/https|fixture|token|payload|candidateId|SQL|requestBody/);
  expect(f.page.eventNames()).toEqual([]);
});

it("records refresh-only request/response ordering while retaining zero-business-mutation evidence", async () => {
  const f = await fixture(true, 0, 6000);
  f.actions.presentation = async () => ({ loginVisible: false, recoveryVisible: true, resendEnabled: false, confirmationVisible: false });
  const result = f.run().then(() => "PASS", error => error.message);
  await vi.advanceTimersByTimeAsync(52_000);
  const diagnostic = await result;
  expect(diagnostic).toContain('"request:trigger:refresh"');
  expect(diagnostic).toContain('"response:trigger:refresh:401"');
  expect(diagnostic).not.toContain('"request:trigger:context"');
  expect(diagnostic).toContain('"additionalMutations":0');
});

it("fails closed on a business mutation and bounds diagnostics without copying event metadata", async () => {
  const f = await fixture(false);
  f.actions.trigger = async () => {
    for (let i = 0; i < 40; i++) f.page.emit("request", {
      url: () => "https://private.invalid/api/v1/sales-receipts?token=private", method: () => "POST",
      body: "private-business", headers: { authorization: "private-token" },
    });
    await f.s.prepare().catch(() => undefined);
  };
  const result = f.run().then(() => "PASS", error => error.message);
  await vi.advanceTimersByTimeAsync(50_001);
  const diagnostic = await result;
  expect(diagnostic).toContain('"additionalMutations":40');
  expect(diagnostic).not.toContain("private");
  const trace = JSON.parse(diagnostic.split("observer=")[1]);
  expect(trace.events).toHaveLength(32);
  expect(trace.omittedEvents).toBeGreaterThan(0);
  expect(f.page.eventNames()).toEqual([]);
});

it("detaches observers on control rejection without triggering or polling", async () => {
  const f = await fixture(false);
  f.actions.control = async () => { throw Error("control refused"); };
  f.actions.trigger = async () => { throw Error("unexpected trigger"); };
  await expect(f.run()).rejects.toThrow("control refused");
  expect(f.page.eventNames()).toEqual([]);
  expect(f.s.requests).toEqual([]);
});
