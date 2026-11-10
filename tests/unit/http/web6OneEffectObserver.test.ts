import { EventEmitter } from "node:events";
import type { BrowserContext } from "@playwright/test";
import { afterEach, expect, it, vi } from "vitest";
import { verifyWeb6OneEffectAfterConsent } from "../../pilot/web6-one-effect-observer";
import type { FrozenRequestEvidence } from "../../pilot/web6-manual-resend-helpers";

const original: FrozenRequestEvidence = { operationId: "11111111-2222-4333-8444-555555555555", operationKind: "Receipt.Create",
  deploymentEpoch: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", method: "POST", pathname: "/api/v1/goods-receipts",
  body: '{"note":"original"}', requestFingerprint: "a".repeat(64) };
function request(change: Partial<FrozenRequestEvidence> = {}) {
  const value = { ...original, ...change };
  return { url: () => `https://fixture.invalid${value.pathname}`, method: () => value.method, postData: () => value.body,
    headers: () => ({ "idempotency-key": value.operationId, "x-mydmsvn-deployment-epoch": value.deploymentEpoch }) };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function fixture() {
  const events = new EventEmitter(), order: string[] = [];
  const run = (trigger: () => Promise<void>, verify = async () => { order.push("oracle"); }) => verifyWeb6OneEffectAfterConsent(events as unknown as Pick<BrowserContext, "on" | "off">,
    original, { trigger, assertDispatches: async () => { order.push("dispatch-proof"); }, verify });
  const response = (owner: ReturnType<typeof request>, status = 200, finished = Promise.resolve<null | Error>(null)) =>
    events.emit("response", { request: () => owner, status: () => status, finished: () => finished });
  return { events, order, run, response };
}
afterEach(() => vi.useRealTimers());

it("holds oracle after dispatch until the exact consent response completes", async () => {
  const f = fixture(), dispatched = deferred<void>(), finish = deferred<null | Error>(), owner = request();
  const result = f.run(async () => { f.events.emit("request", owner); dispatched.resolve(); });
  await dispatched.promise; await Promise.resolve(); expect(f.order).toEqual([]);
  f.response(owner, 200, finish.promise); await Promise.resolve(); expect(f.order).toEqual([]);
  finish.resolve(null); await result;
  expect(f.order).toEqual(["dispatch-proof", "oracle"]); expect(f.events.eventNames()).toEqual([]);
});

it("captures an immediate response during the consent action", async () => {
  const f = fixture(), owner = request();
  await f.run(async () => { f.events.emit("request", owner); f.response(owner); });
  expect(f.order).toEqual(["dispatch-proof", "oracle"]);
});

it.each([
  { operationId: "other" }, { deploymentEpoch: "other" }, { method: "PUT" }, { pathname: "/api/v1/sales-receipts" }, { body: "other" },
])("ignores unrelated traffic even on the same route: %j", async change => {
  const f = fixture(), owner = request(), unrelated = request(change), ready = deferred<void>();
  const result = f.run(async () => { f.events.emit("request", unrelated); f.response(unrelated); ready.resolve(); });
  await ready.promise; await Promise.resolve(); expect(f.order).toEqual([]);
  f.events.emit("request", owner); f.response(owner); await result;
  expect(f.order).toEqual(["dispatch-proof", "oracle"]);
});

it("rejects an unobserved or stale request object as response evidence", async () => {
  const f = fixture(), owner = request(), ready = deferred<void>();
  f.events.emit("request", owner);
  const result = f.run(async () => { f.response(owner); f.events.emit("request", owner); f.response(request()); ready.resolve(); });
  await ready.promise; await Promise.resolve(); expect(f.order).toEqual([]);
  f.response(owner); await result;
  expect(f.order).toEqual(["dispatch-proof", "oracle"]);
});

it.each([400, 401, 500, 503])("refuses status %s without invoking oracle", async status => {
  const f = fixture(), owner = request();
  await expect(f.run(async () => { f.events.emit("request", owner); f.response(owner, status); })).rejects.toThrow("WEB6 one-effect response-not-successful");
  expect(f.order).toEqual([]); expect(f.events.eventNames()).toEqual([]);
});

it.each(["returned", "thrown"])("sanitizes an incomplete response (%s)", async failure => {
  const f = fixture(), owner = request(), secret = Error("raw socket SQL id credentials");
  await expect(f.run(async () => {
    f.events.emit("request", owner);
    f.response(owner, 200, failure === "returned" ? Promise.resolve(secret) : Promise.reject(secret));
  })).rejects.toThrow(/^WEB6 one-effect response-incomplete$/);
  expect(f.order).toEqual([]); expect(f.events.eventNames()).toEqual([]);
});

it("refuses two matching transmissions even if the first response succeeds", async () => {
  const f = fixture(), owner = request();
  await expect(f.run(async () => { f.events.emit("request", owner); f.response(owner); f.events.emit("request", request()); })).rejects.toThrow("WEB6 one-effect duplicate-dispatch");
  expect(f.order).toEqual([]); expect(f.events.eventNames()).toEqual([]);
});

it("times out a missing response once without re-triggering consent", async () => {
  vi.useFakeTimers(); const f = fixture(); let dispatches = 0;
  const result = f.run(async () => { dispatches++; f.events.emit("request", request()); }).then(() => "PASS", error => error.message);
  await vi.advanceTimersByTimeAsync(35_000);
  expect(await result).toBe("WEB6 one-effect response-timeout"); expect(dispatches).toBe(1);
  expect(f.order).toEqual([]); expect(f.events.eventNames()).toEqual([]);
});

it("detaches the observer after trigger failure", async () => {
  const f = fixture();
  await expect(f.run(async () => { throw Error("click failed"); })).rejects.toThrow("click failed");
  expect(f.order).toEqual([]); expect(f.events.eventNames()).toEqual([]);
});

it("ends the response deadline before the independent oracle control budget starts", async () => {
  vi.useFakeTimers(); const f = fixture(), owner = request();
  const result = f.run(async () => {
    f.events.emit("request", owner);
    await new Promise(resolve => setTimeout(resolve, 34_000)); f.response(owner);
  }, async () => { await new Promise(resolve => setTimeout(resolve, 9_000)); f.order.push("oracle"); })
    .then(() => "PASS", error => error.message);
  await vi.advanceTimersByTimeAsync(43_000);
  expect(await result).toBe("PASS"); expect(f.order).toEqual(["dispatch-proof", "oracle"]);
  expect(f.events.eventNames()).toEqual([]);
});
