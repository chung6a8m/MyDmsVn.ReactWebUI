import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestCandidateControl, type CandidateControlAction } from "../../pilot/web6-candidate-control";

const privateText = "private-pipe-token-SQL-password-candidate-id";
const request = Buffer.from(privateText);
function frame(text: string) {
  const bytes = Buffer.from(text), prefix = Buffer.alloc(4);
  prefix.writeInt32LE(bytes.length);
  return Buffer.concat([prefix, bytes]);
}
function fixture(action: CandidateControlAction = "candidateMismatchOn") {
  const socket = new EventEmitter() as Socket;
  const writes: Buffer[] = [];
  let destroys = 0, ends = 0, connects = 0;
  socket.setTimeout = (duration, callback) => { setTimeout(callback!, duration); return socket; };
  socket.write = ((bytes: Buffer) => { writes.push(bytes); return true; }) as Socket["write"];
  socket.destroy = () => { destroys++; socket.emit("close"); return socket; };
  socket.end = (() => { ends++; return socket; }) as Socket["end"];
  const result = requestCandidateControl(action, privateText, 17, request,
    async () => { connects++; return socket; }, Date.now).then(() => undefined, error => error as Error);
  return { socket, result, writes, state: () => ({ destroys, ends, connects }) };
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
  it("keeps the 10 second timeout and reports the exact action and elapsed response phase", async () => {
    vi.useFakeTimers(); const value = fixture(); await ready();
    let finished = false; void value.result.then(() => { finished = true; });
    await vi.advanceTimersByTimeAsync(9999); expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(diagnostic(await value.result)).toEqual({ action: "candidateMismatchOn", terminal: "timeout", phase: "response-header", elapsedMs: 10000, category: "socket-timeout" });
    expect(value.writes).toEqual([request]); expect(value.state()).toEqual({ destroys: 1, ends: 0, connects: 1 });
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
  it("never reflects an action outside the allowlist or opens its socket", async () => {
    let calls = 0;
    const error = await requestCandidateControl(privateText as CandidateControlAction, privateText, 17, request, async () => { calls++; throw Error(privateText); }).catch(error => error);
    expect(diagnostic(error)).toMatchObject({ action: "unrecognized", terminal: "protocol", phase: "request", category: "invalid-action" });
    expect(calls).toBe(0);
  });
});
