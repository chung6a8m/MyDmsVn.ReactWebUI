import type { Socket } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestCutoverControl, type CutoverAction } from "../../pilot/web6-cutover-control";
import { fakeControlSocket, frame } from "./fakeControlSocket";

const actions = [
  "oldClientNewHostOn", "oldClientNewHostOff", "newClientOldHostOn", "newClientOldHostOff",
  "sameEpochRestart", "revokeGrantOn", "revokeGrantOff", "restoreEpoch", "committedUnavailable", "verifyNoCutoverMutation",
] as const;
const privateText = "private-pipe-token-SQL-password-candidate-id";
const request = frame(JSON.stringify({ id: 17, token: privateText, action: "oldClientNewHostOn" }));
const success = '{"id":17,"ok":true,"marker":"old-client-new-host","deploymentEpoch":"test-epoch"}';

function fixture(action: CutoverAction = "oldClientNewHostOn") {
  const value = fakeControlSocket();
  const result = requestCutoverControl(action, privateText, 17, request, value.connect, Date.now)
    .catch(error => error as Error);
  return { ...value, result };
}

function diagnostic(error: unknown) {
  expect(error).toBeInstanceOf(Error);
  if (!(error instanceof Error)) throw Error("Expected a rejected cutover control request.");
  expect(error.cause).toBeUndefined();
  expect(error.stack).not.toContain(privateText);
  expect(error.message).not.toContain(privateText);
  expect(error.message).toMatch(/^Owned WEB6 cutover control failed: \{/);
  return JSON.parse(error.message.slice(error.message.indexOf("{")));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("WEB6 cutover control diagnostic", () => {
  it.each(actions)("binds the exact action %s to a sanitized socket error", async action => {
    const value = fixture(action);
    await vi.advanceTimersByTimeAsync(37);
    value.socket.emit("error", Object.assign(Error(privateText), { code: "EPIPE", path: privateText, stack: privateText }));
    expect(diagnostic(await value.result)).toEqual({
      action, terminal: "error", phase: "response-header", elapsedMs: 37, category: "socket-error", code: "EPIPE",
    });
  });

  it.each(["eligibilityNormal", privateText])("refuses a foreign action before connection", async action => {
    const connect = vi.fn<() => Promise<Socket>>();
    const error = await requestCutoverControl(action as CutoverAction, privateText, 17, request, connect, Date.now)
      .catch(error => error);
    expect(diagnostic(error)).toEqual({
      action: "unrecognized", terminal: "protocol", phase: "request", elapsedMs: 0, category: "invalid-action",
    });
    expect(connect).not.toHaveBeenCalled();
  });

  it.each([["ENOENT", "error"], ["ETIMEDOUT", "timeout"], [privateText, "error"]])(
    "reports connect failure as %s without retrying the connector", async (code, terminal) => {
      const connect = vi.fn(async () => {
        await vi.advanceTimersByTimeAsync(23);
        throw Object.assign(Error(privateText), { code });
      });
      const error = await requestCutoverControl("sameEpochRestart", privateText, 17, request, connect, Date.now)
        .catch(error => error);
      expect(diagnostic(error)).toEqual({
        action: "sameEpochRestart", terminal, phase: "connect", elapsedMs: 23, category: "connect-error",
        ...(code === privateText ? {} : { code }),
      });
      expect(connect).toHaveBeenCalledTimes(1);
    },
  );

  it.each([[0, "response-header"], [2, "response-header"], [5, "response-body"]] as const)(
    "keeps the 15 second inactivity timeout after %s response bytes", async (count, phase) => {
      const value = fixture();
      let completed = false;
      void value.result.then(() => { completed = true; });
      await vi.advanceTimersByTimeAsync(1000);
      if (count) value.socket.emit("data", frame(success).subarray(0, count));
      const elapsedMs = count ? 16000 : 15000;
      await vi.advanceTimersByTimeAsync(elapsedMs - 1001);
      expect(completed).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(diagnostic(await value.result)).toEqual({
        action: "oldClientNewHostOn", terminal: "timeout", phase, elapsedMs, category: "socket-timeout",
      });
      expect(value.writes).toEqual([request]);
      expect(value.state()).toEqual({ destroys: 1, ends: 0, connects: 1 });
    },
  );

  it.each([
    ["end", 0, "response-header"], ["end", 2, "response-header"], ["end", 5, "response-body"],
    ["close", 0, "response-header"], ["close", 5, "response-body"],
  ] as const)("reports %s after %s response bytes as EOF", async (event, count, phase) => {
    const value = fixture();
    await vi.advanceTimersByTimeAsync(31);
    if (count) value.socket.emit("data", frame(success).subarray(0, count));
    value.socket.emit(event);
    // A bare close must settle now, even when the old socket timer cannot fire.
    let settled = false;
    void value.result.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
    expect(diagnostic(await value.result)).toEqual({
      action: "oldClientNewHostOn", terminal: "eof", phase, elapsedMs: 31, category: "incomplete-response",
    });
    expect(vi.getTimerCount()).toBe(0);
    if (event === "end") value.socket.emit("close");
    expect(value.socket.eventNames()).toEqual([]);
  });

  it.each([-1, 1, 4097])("rejects response length %s as protocol failure", async length => {
    const value = fixture();
    await vi.advanceTimersByTimeAsync(0);
    const prefix = Buffer.alloc(4);
    prefix.writeInt32LE(length);
    value.socket.emit("data", prefix);
    expect(diagnostic(await value.result)).toMatchObject({
      terminal: "protocol", phase: "response-header", category: "invalid-length",
    });
  });

  it.each([
    [privateText, "parse", "invalid-json"],
    ['{"id":18,"ok":true}', "protocol", "reply-mismatch"],
    [JSON.stringify({ id: 17, ok: false, category: privateText }), "protocol", "reply-mismatch"],
    ["null", "protocol", "reply-mismatch"],
  ])("classifies an invalid response without reflecting it", async (reply, terminal, category) => {
    const value = fixture();
    await vi.advanceTimersByTimeAsync(0);
    value.socket.emit("data", frame(reply));
    expect(diagnostic(await value.result)).toMatchObject({ terminal, phase: "response-validation", category });
  });

  it("sanitizes a synchronous write exception and releases the socket", async () => {
    const value = fixture();
    value.socket.write = (() => { throw Object.assign(Error(privateText), { code: privateText }); }) as Socket["write"];
    expect(diagnostic(await value.result)).toEqual({
      action: "oldClientNewHostOn", terminal: "error", phase: "write", elapsedMs: 0, category: "socket-error",
    });
    expect(value.state()).toEqual({ destroys: 1, ends: 0, connects: 1 });
  });

  it.each(["success", "error", "timeout"] as const)(
    "clears timers, releases listeners on close and ignores queued events after %s", async terminal => {
      const value = fixture();
      await vi.advanceTimersByTimeAsync(23);
      const queued = Object.fromEntries(["data", "error", "end", "timeout", "close"]
        .map(event => [event, value.socket.listeners(event)]));
      if (terminal === "success") {
        for (const byte of frame(success)) value.socket.emit("data", Buffer.from([byte]));
      } else if (terminal === "error") value.socket.emit("error", Object.assign(Error(privateText), { code: "ECONNRESET" }));
      else value.socket.emit("timeout");
      const first = await value.result;
      expect(vi.getTimerCount()).toBe(0);
      for (const event of ["data", "timeout", "end"]) expect(value.socket.listenerCount(event)).toBe(0);
      expect(() => value.socket.emit("error", Error(privateText))).not.toThrow();
      value.socket.emit("close");
      expect(value.socket.eventNames()).toEqual([]);
      for (const callback of queued.data) callback(frame(success));
      for (const callback of queued.error) callback(Error(privateText));
      for (const callback of [...queued.end, ...queued.timeout, ...queued.close]) callback();
      await vi.advanceTimersByTimeAsync(15000);
      expect(await value.result).toBe(first);
      if (terminal === "success") expect(first).toEqual({ deploymentEpoch: "test-epoch", marker: "old-client-new-host" });
      else expect(diagnostic(first)).toMatchObject({ terminal, elapsedMs: 23 });
      expect(value.state()).toEqual({ destroys: terminal === "success" ? 0 : 1, ends: terminal === "success" ? 1 : 0, connects: 1 });
      expect(value.writes).toEqual([request]);
    },
  );
});
