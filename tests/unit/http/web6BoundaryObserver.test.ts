import { EventEmitter } from "node:events";
import type { Page } from "@playwright/test";
import { afterEach, expect, it, vi } from "vitest";
import { observeWeb6Boundary } from "../../pilot/web6-boundary-observer";
import { web6AuthHarness } from "./web6AuthHarness";

afterEach(() => vi.useRealTimers());
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
// A controlled polling adapter; the selector owns its predicate and deadline.
async function poll(check: () => Promise<string>, options: { timeout: number }) {
  const deadline = Date.now() + options.timeout;
  while (true) {
    const result = await check();
    if (result === "PASS") return;
    if (Date.now() >= deadline) throw Error(result);
    await delay(Math.min(100, deadline - Date.now()));
  }
}
async function fixture(expiring: boolean, contextDelay = 0, refreshDelay = 0) {
  vi.useFakeTimers();
  const page = new EventEmitter();
  const s = await web6AuthHarness("eligibility401", {
    expiresInMs: expiring ? 31_000 : undefined,
    beforeResponse: async path => {
      if (path === "/api/v3/operations/resend-context") await delay(contextDelay);
      if (path === "/api/v1/auth/refresh") await delay(refreshDelay);
    },
    onRequest: (path, method) => page.emit("request", { url: () => `https://fixture.invalid${path}`, method: () => method }),
    onResponse: (path, method, status) => page.emit("response", {
      url: () => `https://fixture.invalid${path}`, status: () => status, request: () => ({ method: () => method }),
    }),
  });
  let prepare: Promise<unknown> = Promise.resolve();
  const actions = {
    control: async () => { if (expiring) await delay(1001); },
    trigger: async () => { prepare = s.prepare().catch(() => undefined); },
    presentation: async () => {
      const signedOut = s.auth.getSnapshot().status === "reauth-required";
      return { loginVisible: signedOut, recoveryVisible: !signedOut, resendEnabled: false, confirmationVisible: false };
    }, poll,
  };
  return { s, page, actions, drain: () => prepare,
    run: () => observeWeb6Boundary("eligibility401", page as unknown as Pick<Page, "on" | "off">, actions) };
}

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

it.each(["control", "trigger"] as const)("captures immediate %s responses before polling and detaches afterwards", async phase => {
  const f = await fixture(false);
  f.actions.trigger = async () => {};
  f.actions[phase] = async () => { await f.s.prepare().catch(() => undefined); };
  const result = f.run();
  await vi.advanceTimersByTimeAsync(1);
  await expect(result).resolves.toBeUndefined();
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
  expect(diagnostic).toContain('"request:refresh"');
  expect(diagnostic).toContain('"response:refresh:401"');
  expect(diagnostic).not.toContain('"request:context"');
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
