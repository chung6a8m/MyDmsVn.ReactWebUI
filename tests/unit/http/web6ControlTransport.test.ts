import { createRequire } from "node:module";
import { Socket } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectPilotPipe } from "../../pilot/pilot-pipe-connect";
import { requestCandidateControl } from "../../pilot/web6-candidate-control";
import { requestCutoverControl } from "../../pilot/web6-cutover-control";
import { requestWeb6Control } from "../../pilot/web6-control-transport";
import { fakeControlSocket, frame } from "./fakeControlSocket";

type SerializedError = { message: string; stack?: string; cause?: SerializedError };
const require = createRequire(import.meta.url);
const { serializeError } = require("playwright/lib/util") as {
  serializeError(error: Error): SerializedError;
};
const { base } = require("playwright/lib/runner") as {
  base: { nonTerminalScreen: unknown; formatError(screen: unknown, error: SerializedError): { message: string; location?: unknown } };
};

const privateText = "private-checkout-pipe-token-candidate-sql";
const request = Buffer.from(privateText);
const cases = [
  { flow: "candidate", action: "candidateMismatchOn", send: requestCandidateControl.bind(null, "candidateMismatchOn") },
  { flow: "cutover", action: "oldClientNewHostOn", send: (
    path: string, id: number, request: Buffer, connect: (path: string) => Promise<Socket>, now: () => number,
  ) => requestCutoverControl("oldClientNewHostOn", path, id, request, 20_000, connect, now) },
] as const;

function expectDiagnostic(value: unknown, flow: string, diagnostic: object) {
  expect(value).toBeInstanceOf(Error);
  expect((value as Error).message).toBe(`Owned WEB6 ${flow} control failed: ${JSON.stringify(diagnostic)}`);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe.each(cases)("WEB6 $flow socket handoff and reporting", ({ flow, action, send }) => {
  it.each(["closed", "destroyed"] as const)("settles EOF without writing on a %s socket during handoff", async state => {
    const socket = new Socket();
    const ownListeners = socket.listeners("end");
    const write = vi.spyOn(socket, "write").mockReturnValue(true);
    const destroy = vi.spyOn(socket, "destroy");
    const settlements: unknown[] = [];
    const create = vi.fn(() => {
      const terminate = () => {
        socket.emit("connect");
        socket.destroy();
      };
      // nextTick drains the close event before the promise continuation. A microtask
      // leaves that event queued, while the socket is already destroyed.
      if (state === "closed") process.nextTick(terminate);
      else queueMicrotask(terminate);
      return socket;
    });
    const result = send(privateText, 17, request, path => connectPilotPipe(path, create), Date.now);
    void result.then(value => settlements.push(value), error => settlements.push(error));
    await vi.advanceTimersByTimeAsync(0);
    expect(settlements).toHaveLength(1);
    expectDiagnostic(settlements[0], flow, { action, terminal: "eof", phase: "connect", elapsedMs: 0, category: "incomplete-response" });
    expect(create).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    for (const event of ["connect", "data", "timeout", "error", "close"]) expect(socket.listenerCount(event)).toBe(0);
    expect(socket.listeners("end")).toEqual(ownListeners);
  });

  it("observes a socket error between connect and handoff without re-entering the connector", async () => {
    const socket = new Socket();
    const ownListeners = socket.listeners("end");
    const write = vi.spyOn(socket, "write").mockReturnValue(true);
    const emit = socket.emit.bind(socket);
    const errorListeners: number[] = [];
    socket.emit = ((event: string, ...args: unknown[]) => {
      if (event === "error") {
        errorListeners.push(socket.listenerCount("error"));
        // Record a missing observer without letting EventEmitter abort the test process.
        if (socket.listenerCount("error") === 0) return false;
      }
      return emit(event, ...args);
    }) as Socket["emit"];
    const create = vi.fn(() => {
      process.nextTick(() => {
        socket.emit("connect");
        socket.destroy(Object.assign(Error(privateText), { code: "EPIPE" }));
      });
      return socket;
    });
    let error: unknown;
    void send(privateText, 17, request, path => connectPilotPipe(path, create), Date.now)
      .catch(failure => { error = failure; });
    await vi.advanceTimersByTimeAsync(0);
    expect(errorListeners).toEqual([1]);
    expectDiagnostic(error, flow, { action, terminal: "error", phase: "connect", elapsedMs: 0, category: "connect-error", code: "EPIPE" });
    expect(create).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(socket.eventNames()).toEqual(["end"]);
    expect(socket.listeners("end")).toEqual(ownListeners);
  });

  it.each(["callback", "error"] as const)("keeps an asynchronous write failure from %s in the write phase", async signal => {
    const value = fakeControlSocket();
    const failure = Object.assign(Error(privateText), { code: "EPIPE" });
    value.socket.write = vi.fn((_: Buffer, callback?: (error: Error) => void) => {
      queueMicrotask(() => {
        if (signal === "callback") callback?.(failure);
        else value.socket.emit("error", failure);
        value.socket.emit("close");
      });
      return false;
    }) as Socket["write"];
    const error = await send(privateText, 17, request, value.connect, Date.now).catch(error => error);
    expectDiagnostic(error, flow, { action, terminal: "error", phase: "write", elapsedMs: 0, category: "socket-error", code: "EPIPE" });
    expect(value.socket.write).toHaveBeenCalledTimes(1);
    expect(value.state()).toEqual({ destroys: 1, ends: 0, connects: 1 });
    expect(vi.getTimerCount()).toBe(0);
    expect(value.socket.eventNames()).toEqual([]);
  });

  it.each([[2, "response-header"], [5, "response-body"]] as const)(
    "preserves %s response bytes and the %s phase when a write callback arrives late", async (count, phase) => {
      const value = fakeControlSocket();
      value.socket.write = vi.fn((_: Buffer, callback?: (error: null) => void) => {
        queueMicrotask(() => {
          value.socket.emit("data", frame('{"id":17,"ok":true}').subarray(0, count));
          callback?.(null);
          value.socket.emit("end");
          value.socket.emit("close");
        });
        return true;
      }) as Socket["write"];
      const error = await send(privateText, 17, request, value.connect, Date.now).catch(error => error);
      expectDiagnostic(error, flow, { action, terminal: "eof", phase, elapsedMs: 0, category: "incomplete-response" });
      expect(value.state()).toEqual({ destroys: 1, ends: 0, connects: 1 });
      expect(vi.getTimerCount()).toBe(0);
      expect(value.socket.eventNames()).toEqual([]);
    },
  );

  it("ignores a late write callback failure after successful response settlement", async () => {
    const value = fakeControlSocket();
    value.socket.write = vi.fn((_: Buffer, callback?: (error: Error) => void) => {
      queueMicrotask(() => {
        value.socket.emit("data", frame('{"id":17,"ok":true}'));
        callback?.(Object.assign(Error(privateText), { code: "EPIPE" }));
        value.socket.emit("close");
      });
      return true;
    }) as Socket["write"];
    await send(privateText, 17, request, value.connect, Date.now);
    expect(value.state()).toEqual({ destroys: 0, ends: 1, connects: 1 });
    expect(vi.getTimerCount()).toBe(0);
    expect(value.socket.eventNames()).toEqual([]);
  });

  it("serializes and formats only the sanitized diagnostic through Playwright", async () => {
    const failure = Object.assign(Error(privateText), { code: "EPIPE", path: privateText, cause: Error(privateText) });
    const error: unknown = await send(privateText, 17, request, async () => { throw failure; }, Date.now).catch(error => error);
    if (!(error instanceof Error)) throw Error("Expected a diagnostic error.");
    const expected = `Error: Owned WEB6 ${flow} control failed: ${JSON.stringify({
      action, terminal: "error", phase: "connect", elapsedMs: 0, category: "connect-error", code: "EPIPE",
    })}`;
    const serialized = serializeError(error);
    expect(serialized).toEqual({ message: expected, stack: process.env.PWDEBUGIMPL ? "" : expected, cause: undefined });
    const formatted = base.formatError(base.nonTerminalScreen, serialized);
    expect(formatted.message).toBe(expected);
    expect(formatted.location).toBeUndefined();
  });
});

describe("WEB6 cutover absolute response timer", () => {
  const success = frame('{"id":17,"ok":true}');
  const send = (connect: (path: string) => Promise<Socket>, now: () => number = Date.now, allowanceSampledAt?: number) =>
    requestWeb6Control(privateText, 17, request, {
      flow: "cutover", action: "oldClientNewHostOn", actions: ["oldClientNewHostOn"],
      actionCap: 180_000, requestAllowanceMs: 5001, allowanceSampledAt,
    }, connect, now).catch(error => error);

  it.each(["resolve", "reject"] as const)("settles during connect and ignores a late %s", async outcome => {
    const value = fakeControlSocket();
    let timersAtConnect = 0;
    const connect = vi.fn(async () => {
      timersAtConnect = vi.getTimerCount();
      await new Promise(resolve => setTimeout(resolve, 6000));
      if (outcome === "reject") throw Object.assign(Error(privateText), { code: "ECANCELED" });
      return value.socket;
    });
    const result = send(connect);
    await vi.advanceTimersByTimeAsync(5001);
    expect(timersAtConnect).toBe(1);
    expectDiagnostic(await result, "cutover", {
      action: "oldClientNewHostOn", terminal: "timeout", phase: "connect", elapsedMs: 5001, category: "response-timeout",
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(value.writes).toEqual([]);
    expect(value.state().destroys).toBe(outcome === "resolve" ? 1 : 0);
    value.socket.emit("close");
    expect(value.socket.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("charges delayed connect and write before waiting for the response", async () => {
    const value = fakeControlSocket();
    const connect = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      return value.socket;
    });
    const callbacks: ((error?: Error | null) => void)[] = [];
    value.socket.write = vi.fn((_bytes: Buffer, callback?: (error?: Error | null) => void) => {
      if (callback) callbacks.push(callback);
      return true;
    }) as Socket["write"];
    const result = send(connect);
    await vi.advanceTimersByTimeAsync(5001);
    expect(vi.getTimerCount()).toBe(0);
    expectDiagnostic(await result, "cutover", {
      action: "oldClientNewHostOn", terminal: "timeout", phase: "write", elapsedMs: 5001, category: "response-timeout",
    });
    callbacks[0](Object.assign(Error(privateText), { code: "ECANCELED" }));
    expect(() => value.socket.emit("error", Error(privateText))).not.toThrow();
    value.socket.emit("close");
    expect(value.state().destroys).toBe(1);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(value.socket.write).toHaveBeenCalledExactlyOnceWith(request, expect.any(Function));
    expect(value.socket.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([5000, 5001, 5002])("checks the monotonic boundary at final validation time %i", async elapsed => {
    const value = fakeControlSocket();
    let clock = 0;
    const result = send(value.connect, () => clock);
    await vi.advanceTimersByTimeAsync(0);
    clock = 5000;
    const parse = JSON.parse;
    const finishParsing = vi.spyOn(JSON, "parse").mockImplementationOnce(text => {
      clock = elapsed;
      return parse(text);
    });
    try { value.socket.emit("data", success); }
    finally { finishParsing.mockRestore(); }
    if (elapsed === 5000) expect(await result).toEqual({ id: 17, ok: true });
    else expectDiagnostic(await result, "cutover", {
      action: "oldClientNewHostOn", terminal: "timeout", phase: "response-validation", elapsedMs: elapsed, category: "response-timeout",
    });
    expect(value.writes).toEqual([request]);
    expect(value.state()).toEqual({ destroys: elapsed === 5000 ? 0 : 1, ends: elapsed === 5000 ? 1 : 0, connects: 1 });
    value.socket.emit("close");
    expect(value.socket.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("charges frame preparation to the local deadline without moving the wire allowance", async () => {
    const value = fakeControlSocket();
    const sampledAt = Date.now();
    await vi.advanceTimersByTimeAsync(1);
    const result = send(value.connect, Date.now, sampledAt);
    await vi.advanceTimersByTimeAsync(5000);
    expect(vi.getTimerCount()).toBe(0);
    expectDiagnostic(await result, "cutover", {
      action: "oldClientNewHostOn", terminal: "timeout", phase: "response-header", elapsedMs: 5000, category: "response-timeout",
    });
    expect(value.writes).toEqual([request]);
    value.socket.emit("close");
    expect(value.socket.eventNames()).toEqual([]);
  });

});
