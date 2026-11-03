import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import { describe, expect, it, vi } from "vitest";
import { connectPilotPipe } from "../../pilot/pilot-pipe-connect";

function attempt(event: "connect" | "error", code?: string): Socket {
  const socket = new EventEmitter() as Socket;
  socket.destroy = vi.fn(() => socket);
  queueMicrotask(() => socket.emit(event, Object.assign(new Error("private-pipe"), { code })));
  return socket;
}
describe("owned pilot pipe connect", () => {
  it("retries only ENOENT before connection and returns the connected socket", async () => {
    const create = vi.fn().mockImplementationOnce(() => attempt("error", "ENOENT")).mockImplementationOnce(() => attempt("connect"));
    const pause = vi.fn(async () => {});
    expect(await connectPilotPipe("private", create, pause)).toBeDefined();
    expect(create).toHaveBeenCalledTimes(2); expect(pause).toHaveBeenCalledTimes(1);
  });
  it("does not retry a different connection failure", async () => {
    const create = vi.fn(() => attempt("error", "ECONNRESET"));
    await expect(connectPilotPipe("private", create, async () => {})).rejects.toMatchObject({ code: "ECONNRESET" });
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("does not reconnect when a connected socket later fails", async () => {
    const create = vi.fn(() => attempt("connect"));
    const socket = await connectPilotPipe("private", create, async () => {});
    const observed = vi.fn(); socket.on("error", observed);
    socket.emit("error", Object.assign(new Error("after write"), { code: "EPIPE" }));
    expect(observed).toHaveBeenCalledTimes(1); expect(create).toHaveBeenCalledTimes(1);
  });
  it("times out a stalled connect without retry", async () => {
    vi.useFakeTimers();
    try {
      const socket = new EventEmitter() as Socket; socket.destroy = vi.fn(() => socket);
      const create = vi.fn(() => socket);
      const result = connectPilotPipe("private", create, async () => {}).catch(error => error);
      await vi.advanceTimersByTimeAsync(1000);
      expect(await result).toMatchObject({ code: "ETIMEDOUT" });
      expect(create).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
  it("fails after a bounded number of absent listeners", async () => {
    const create = vi.fn(() => attempt("error", "ENOENT"));
    await expect(connectPilotPipe("private", create, async () => {})).rejects.toMatchObject({ code: "ENOENT" });
    expect(create).toHaveBeenCalledTimes(40);
  });
});
