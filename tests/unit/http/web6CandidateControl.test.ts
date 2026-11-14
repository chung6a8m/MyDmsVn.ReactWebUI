import { readFileSync } from "node:fs";
import * as pairBudgets from "../../pilot/web6-pair-budgets";
import * as controlBudgets from "../../pilot/web6-candidate-control";
import type { Socket } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestCandidateControl, type CandidateControlAction } from "../../pilot/web6-candidate-control";
import { fakeControlSocket, frame } from "./fakeControlSocket";

const privateText = "private-pipe-token-SQL-password-candidate-id";
const request = Buffer.from(privateText);
function fixture(action: CandidateControlAction = "candidateMismatchOn") {
  const value = fakeControlSocket();
  const result = requestCandidateControl(action, privateText, 17, request, value.connect, Date.now)
    .then(() => undefined, error => error as Error);
  return { ...value, result };
}
async function ready() { await Promise.resolve(); }
function diagnostic(error: Error | undefined) {
  if (!(error instanceof Error)) throw Error("Expected a rejected control request.");
  expect(error.message).not.toContain(privateText);
  expect(error.cause).toBeUndefined();
  expect(error.message).toMatch(/^Owned WEB6 candidate control failed: \{/);
  return JSON.parse(error.message.slice(error.message.indexOf("{")));
}

afterEach(() => vi.useRealTimers());
describe("WEB6 candidate control sanitized terminal boundary", () => {
  it.each(["verifyNotObserved", "verifyCommitted", "verifyOneEffect", "eligibilityNormal", "eligibility401", "eligibility500"] as const)("keeps the exact 10 second timeout for %s", async action => {
    vi.useFakeTimers(); const value = fixture(action); await ready();
    let finished = false; void value.result.then(() => { finished = true; });
    await vi.advanceTimersByTimeAsync(9999); expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(diagnostic(await value.result)).toEqual({ action, terminal: "timeout", phase: "response-header", elapsedMs: 10000, category: "socket-timeout" });
    expect(value.writes).toEqual([request]); expect(value.state()).toEqual({ destroys: 1, ends: 0, connects: 1 });
  });
  describe.each(["candidateMismatchOn", "candidateMismatchOff"] as const)("%s restart response budget", action => {
    it("waits beyond the complete explicit controller allowance and expires exactly at 170 seconds", async () => {
      vi.useFakeTimers(); const value = fixture(action); await ready();
      let finished = false; void value.result.then(() => { finished = true; });
      await vi.advanceTimersByTimeAsync(160400); expect(finished).toBe(false);
      await vi.advanceTimersByTimeAsync(9599); expect(finished).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(diagnostic(await value.result)).toEqual({ action, terminal: "timeout", phase: "response-header", elapsedMs: 170000, category: "socket-timeout" });
      expect(value.writes).toEqual([request]); expect(value.state()).toEqual({ destroys: 1, ends: 0, connects: 1 });
    });
    it("accepts a complete response immediately before expiry", async () => {
      vi.useFakeTimers(); const value = fixture(action); await ready();
      await vi.advanceTimersByTimeAsync(169999);
      value.socket.emit("data", frame('{"id":17,"ok":true}'));
      expect(await value.result).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      expect(value.state()).toEqual({ destroys: 0, ends: 1, connects: 1 });
    });
    it("does not let partial header bytes extend the finite header deadline", async () => {
      vi.useFakeTimers(); const value = fixture(action); await ready();
      await vi.advanceTimersByTimeAsync(169999); value.socket.emit("data", Buffer.from([20]));
      await vi.advanceTimersByTimeAsync(1);
      expect(diagnostic(await value.result)).toMatchObject({ terminal: "timeout", phase: "response-header", elapsedMs: 170000 });
    });
    it("returns to the ordinary 10 second body inactivity budget after the header", async () => {
      vi.useFakeTimers(); const value = fixture(action); await ready();
      await vi.advanceTimersByTimeAsync(12000); value.socket.emit("data", frame('{"id":17,"ok":true}').subarray(0, 4));
      let finished = false; void value.result.then(() => { finished = true; });
      await vi.advanceTimersByTimeAsync(9999); expect(finished).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(diagnostic(await value.result)).toMatchObject({ terminal: "timeout", phase: "response-body", elapsedMs: 22000 });
    });
    it.each(["success", "error", "end", "timeout"] as const)("cleans timers and listeners after %s and ignores queued terminal races", async terminal => {
      vi.useFakeTimers(); const value = fixture(action); await ready();
      const queued = Object.fromEntries(["data", "error", "end", "timeout", "close"].map(event => [event, value.socket.listeners(event)]));
      await vi.advanceTimersByTimeAsync(23);
      if (terminal === "success") value.socket.emit("data", frame('{"id":17,"ok":true}'));
      else if (terminal === "error") value.socket.emit("error", Object.assign(Error(privateText), { code: "EPIPE" }));
      else value.socket.emit(terminal);
      const first = await value.result;
      expect(vi.getTimerCount()).toBe(0);
      expect(value.socket.listenerCount("data")).toBe(0); expect(value.socket.listenerCount("end")).toBe(0);
      expect(value.socket.listenerCount("timeout")).toBe(0);
      // A real socket can still emit an error while closing; consume it until close.
      expect(() => value.socket.emit("error", Error(privateText))).not.toThrow();
      value.socket.emit("close"); expect(value.socket.eventNames()).toEqual([]);
      for (const callback of queued.data) callback(frame('{"id":17,"ok":true}'));
      for (const callback of queued.error) callback(Error(privateText));
      for (const callback of [...queued.end, ...queued.timeout, ...queued.close]) callback();
      await vi.advanceTimersByTimeAsync(170000);
      expect(await value.result).toBe(first);
      if (terminal === "success") expect(first).toBeUndefined();
      else expect(diagnostic(first)).toMatchObject({ action, terminal: terminal === "end" ? "eof" : terminal, elapsedMs: 23 });
      expect(value.state()).toEqual({ destroys: terminal === "success" ? 0 : 1, ends: terminal === "success" ? 1 : 0, connects: 1 });
      expect(value.writes).toEqual([request]);
    });
  });
  it.each(["verifyNotObserved", "verifyCommitted", "verifyOneEffect", "candidateMismatchOn", "candidateMismatchOff", "eligibilityNormal", "eligibility401", "eligibility500"] as const)("binds error to %s without exposing socket metadata", async action => {
    vi.useFakeTimers(); const value = fixture(action); await ready();
    await vi.advanceTimersByTimeAsync(37);
    value.socket.emit("error", Object.assign(Error(privateText), { code: "EPIPE", path: privateText, syscall: privateText, stack: privateText }));
    expect(diagnostic(await value.result)).toEqual({ action, terminal: "error", phase: "response-header", elapsedMs: 37, category: "socket-error", code: "EPIPE" });
  });
  it.each([privateText, "SQL123", undefined])("omits an unapproved error code %s", async code => {
    vi.useFakeTimers(); const value = fixture(); await ready();
    value.socket.emit("error", Object.assign(Error(privateText), { code }));
    expect(diagnostic(await value.result)).not.toHaveProperty("code");
  });
  it.each([false, true])("distinguishes EOF with partial body=%s", async body => {
    vi.useFakeTimers(); const value = fixture(); await ready();
    const bytes = frame('{"id":17,"ok":true}'); value.socket.emit("data", bytes.subarray(0, body ? 5 : 2));
    value.socket.emit("end");
    expect(diagnostic(await value.result)).toMatchObject({ terminal: "eof", phase: body ? "response-body" : "response-header", category: "incomplete-response" });
  });
  it("settles bare close before a response and releases the mismatch timers and listeners", async () => {
    vi.useFakeTimers(); const value = fixture(); await ready();
    await vi.advanceTimersByTimeAsync(23);
    value.socket.emit("close");
    let settled = false;
    void value.result.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
    expect(diagnostic(await value.result)).toEqual({
      action: "candidateMismatchOn", terminal: "eof", phase: "response-header", elapsedMs: 23, category: "incomplete-response",
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(value.socket.eventNames()).toEqual([]);
    expect(value.state()).toEqual({ destroys: 1, ends: 0, connects: 1 });
  });
  it.each([1, 4097, -1])("refuses invalid response length %s as protocol", async length => {
    vi.useFakeTimers(); const value = fixture(); await ready(); const prefix = Buffer.alloc(4); prefix.writeInt32LE(length);
    value.socket.emit("data", prefix);
    expect(diagnostic(await value.result)).toMatchObject({ terminal: "protocol", category: "invalid-length", phase: "response-header" });
  });
  it("sanitizes a synchronous write exception", async () => {
    vi.useFakeTimers(); const value = fixture();
    value.socket.write = (() => { throw Object.assign(Error(privateText), { code: "EPIPE" }); }) as Socket["write"];
    expect(diagnostic(await value.result)).toMatchObject({ terminal: "error", category: "socket-error", phase: "write", code: "EPIPE" });
  });
  it("reports parse failure without reflecting the response", async () => {
    vi.useFakeTimers(); const value = fixture(); await ready(); value.socket.emit("data", frame(privateText));
    expect(diagnostic(await value.result)).toMatchObject({ terminal: "parse", category: "invalid-json", phase: "response-validation" });
  });
  it.each(['{"id":18,"ok":true}', '{"id":17,"ok":false}', 'null', '[]'])("refuses unmatched or invalid reply %s", async reply => {
    vi.useFakeTimers(); const value = fixture(); await ready(); value.socket.emit("data", frame(reply));
    expect(diagnostic(await value.result)).toMatchObject({ terminal: "protocol", category: "reply-mismatch", phase: "response-validation" });
  });
  it("settles failure once despite error, EOF, timeout and later valid data", async () => {
    vi.useFakeTimers(); const value = fixture(); await ready(); value.socket.emit("error", Object.assign(Error(privateText), { code: "ECONNRESET" }));
    const first = await value.result;
    value.socket.emit("end"); value.socket.emit("error", Error(privateText)); value.socket.emit("data", frame('{"id":17,"ok":true}'));
    await vi.advanceTimersByTimeAsync(10000);
    expect(await value.result).toBe(first); expect(diagnostic(first)).toMatchObject({ terminal: "error", code: "ECONNRESET" });
    expect(value.state()).toEqual({ destroys: 1, ends: 0, connects: 1 });
  });
  it("preserves fragmented success and ignores later terminal events or replies", async () => {
    vi.useFakeTimers(); const value = fixture(); await ready(); const reply = frame('{"id":17,"ok":true}');
    for (const byte of reply) value.socket.emit("data", Buffer.from([byte]));
    expect(await value.result).toBeUndefined();
    value.socket.emit("data", reply); value.socket.emit("error", Error(privateText)); value.socket.emit("end");
    await vi.advanceTimersByTimeAsync(10000);
    expect(value.state()).toEqual({ destroys: 0, ends: 1, connects: 1 }); expect(value.writes).toEqual([request]);
  });
  it.each(["ENOENT", "ETIMEDOUT"])("sanitizes connect failure %s without adding retries", async code => {
    vi.useFakeTimers(); let calls = 0;
    const error = await requestCandidateControl("eligibility500", privateText, 17, request, async () => {
      calls++; await vi.advanceTimersByTimeAsync(23); throw Object.assign(Error(privateText), { code });
    }, Date.now).catch(error => error);
    expect(diagnostic(error)).toEqual({ action: "eligibility500", terminal: code === "ETIMEDOUT" ? "timeout" : "error", phase: "connect", elapsedMs: 23, category: "connect-error", code });
    expect(calls).toBe(1);
  });
  it.each([privateText, "oldClientNewHostOn"])("never reflects a foreign action or opens its socket", async action => {
    let calls = 0;
    const error = await requestCandidateControl(action as CandidateControlAction, privateText, 17, request, async () => { calls++; throw Error(privateText); }).catch(error => error);
    expect(diagnostic(error)).toMatchObject({ action: "unrecognized", terminal: "protocol", phase: "request", category: "invalid-action" });
    expect(calls).toBe(0);
  });
});

it("keeps the third test above the full sequential successful-path budgets and UI margin", () => {
  const source = readFileSync(new URL("../../pilot/web6-manual-resend-live.spec.ts", import.meta.url), "utf8");
  const third = source.slice(source.indexOf('test("two tabs allow one claim'));
  expect(third.match(/test\.setTimeout\(([^)]+)\)/)?.[1]).toBe("WEB6_FAIL_CLOSED_TEST_TIMEOUT_MS");
  const budget = (controlBudgets as unknown as Record<string, number>).WEB6_FAIL_CLOSED_TEST_TIMEOUT_MS;
  // 827800 IPC + 1000000 HTTP/predicate/assertion phases, then the existing60s margin.
  expect(budget).toBeGreaterThan(1_827_800 + 60_000);
  expect(budget).toBe(1_920_000);
  expect(source.match(/test\.setTimeout\(240_000\)/g)).toHaveLength(1);
  expect(source.match(/test\.setTimeout\(90_000\)/g)).toHaveLength(1);
});


it("accounts separately for initial Login bootstrap refresh and re-login bootstrap refresh", () => {
  const phases = pairBudgets.WEB6_THIRD_PHASE_MS as unknown as Record<string, number>;
  expect(phases.initialLoginBootstrapRefresh).toBe(15_000);
  expect(phases.reloginBootstrapRefresh).toBe(15_000);
  expect(pairBudgets.WEB6_THIRD_SEQUENTIAL_MS).toBe(1_827_800);
  expect(pairBudgets.WEB6_FAIL_CLOSED_TEST_TIMEOUT_MS).toBeGreaterThan(31 * 60_000);
});
