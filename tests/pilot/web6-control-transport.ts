import type { Socket } from "node:net";
import { connectPilotPipe } from "./pilot-pipe-connect";
import { CUTOVER_RESPONSE_RESERVE_MS } from "./web6-cutover-deadline";

type Terminal = "timeout" | "error" | "eof" | "protocol" | "parse";
type Phase = "request" | "connect" | "write" | "response-header" | "response-body" | "response-validation";
type ControlOptions = { action: string; actions: readonly string[] } & (
  | { flow: "candidate"; timeoutMs: number; headerTimeoutMs?: number }
  | { flow: "cutover"; actionCap: number; requestAllowanceMs: number; allowanceSampledAt?: number }
);
const safeCodes = new Set(["ENOENT", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EPIPE", "EACCES", "EPERM", "ENOTCONN", "ECANCELED"]);
function safeCode(error: unknown): string | undefined {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return typeof code === "string" && safeCodes.has(code) ? code : undefined;
}

// Test-process IPC only. Never include frame bytes, pipe paths, raw errors or causes in diagnostics.
// The existing connector owns pre-connect ENOENT handling; this boundary never repeats a command.
export async function requestWeb6Control(
  path: string, id: number, request: Buffer,
  options: ControlOptions,
  connect: (path: string, signal?: AbortSignal) => Promise<Socket> =
    (pipePath, signal) => connectPilotPipe(pipePath, undefined, undefined, signal),
  now: () => number = () => performance.now(),
): Promise<Record<string, unknown>> {
  const { flow, action, actions } = options;
  const started = now();
  let phase: Phase = "request";
  const allowed = actions.includes(action);
  const failure = (terminal: Terminal, category: string, code?: string) => {
    const error = new Error(`Owned WEB6 ${flow} control failed: ${JSON.stringify({
      action: allowed ? action : "unrecognized", terminal, phase,
      elapsedMs: Math.max(0, Math.floor(now() - started)), category, ...(code ? { code } : {}),
    })}`);
    // Playwright serializes Error.stack into the retained reporter output.
    error.stack = undefined;
    return error;
  };
  if (!allowed) throw failure("protocol", "invalid-action");
  let deadline: number | undefined;
  if (options.flow === "cutover") {
    const { requestAllowanceMs, actionCap, allowanceSampledAt = started } = options;
    if (!Number.isInteger(requestAllowanceMs) || requestAllowanceMs > actionCap)
      throw failure("protocol", "invalid-allowance");
    if (requestAllowanceMs <= CUTOVER_RESPONSE_RESERVE_MS)
      throw failure("timeout", "scenario-exhausted");
    deadline = allowanceSampledAt + requestAllowanceMs;
  }

  return new Promise((resolve, reject) => {
    const connectController = new AbortController();
    let socket: Socket | undefined;
    let settled = false;
    let absoluteTimer: ReturnType<typeof setTimeout> | undefined;
    let cleanupSocket: (() => void) | undefined;
    const cleanup = () => {
      clearTimeout(absoluteTimer);
      connectController.abort();
      cleanupSocket?.();
    };
    const fail = (terminal: Terminal, category: string, code?: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(failure(terminal, category, code));
      if (socket && !socket.destroyed) socket.destroy();
    };
    const expire = () => fail("timeout", "response-timeout");
    const deadlineReached = () => {
      if (deadline === undefined || now() < deadline) return false;
      expire();
      return true;
    };
    const connectFailed = (error: unknown) => {
      if (settled || deadlineReached()) return;
      const code = safeCode(error);
      fail(code === "ETIMEDOUT" ? "timeout" : "error", "connect-error", code);
    };

    const useSocket = (connected: Socket) => {
      if (settled || deadlineReached()) {
        if (!connected.destroyed) {
          // Observe queued errors while closing a socket received after settlement.
          const ignoreError = () => {};
          connected.on("error", ignoreError);
          connected.once("close", () => connected.off("error", ignoreError));
          connected.destroy();
        }
        return;
      }
      socket = connected;
      let bytes = Buffer.alloc(0);
      let headerReceived = false;
      let headerTimer: ReturnType<typeof setTimeout> | undefined;
      const onTimeout = () => fail("timeout", "socket-timeout");
      const onError = (error: unknown) => {
        if (!settled && !deadlineReached()) fail("error", "socket-error", safeCode(error));
      };
      const onEnd = () => {
        if (!settled && !deadlineReached()) fail("eof", "incomplete-response");
      };
      const onClose = () => {
        connected.off("error", onError);
        onEnd();
      };
      const onData = (chunk: Buffer) => {
        if (settled || deadlineReached()) return;
        if (phase === "write") phase = "response-header";
        bytes = Buffer.concat([bytes, chunk]);
        if (bytes.length < 4) return;
        const length = bytes.readInt32LE(0);
        if (length < 2 || length > 4096) return fail("protocol", "invalid-length");
        if (!headerReceived && options.flow === "candidate") {
          headerReceived = true;
          clearTimeout(headerTimer);
          connected.setTimeout(options.timeoutMs);
        }
        phase = "response-body";
        if (bytes.length < length + 4) return;
        phase = "response-validation";
        let reply: unknown;
        try { reply = JSON.parse(bytes.subarray(4, length + 4).toString("utf8")); }
        catch {
          if (!deadlineReached()) fail("parse", "invalid-json");
          return;
        }
        const matches = reply && typeof reply === "object" && "id" in reply && reply.id === id && "ok" in reply && reply.ok === true;
        if (deadlineReached()) return;
        if (!matches) return fail("protocol", "reply-mismatch");
        settled = true;
        cleanup();
        resolve(reply as Record<string, unknown>);
        connected.end();
      };
      cleanupSocket = () => {
        clearTimeout(headerTimer);
        if (options.flow === "candidate") {
          connected.setTimeout(0);
          connected.off("timeout", onTimeout);
        }
        connected.off("end", onEnd);
        connected.off("data", onData);
        // Keep the guarded error listener until close: destroy/end can emit error.
      };
      connected.on("error", onError);
      connected.once("close", onClose);
      connected.on("end", onEnd);
      // The connector guards an error queued before handoff on a destroyed socket.
      if (connected.destroyed || connected.closed) {
        connected.off("error", onError);
        connected.off("close", onClose);
        if (connected.errored) fail("error", "connect-error", safeCode(connected.errored));
        else onEnd();
        return;
      }
      if (options.flow === "candidate") {
        const { headerTimeoutMs, timeoutMs } = options;
        connected.setTimeout(headerTimeoutMs ?? timeoutMs, onTimeout);
        // The candidate mismatch header deadline cannot be extended by partial bytes.
        if (headerTimeoutMs !== undefined) headerTimer = setTimeout(onTimeout, headerTimeoutMs);
      }
      connected.on("data", onData);
      phase = "write";
      if (deadlineReached()) return;
      try {
        connected.write(request, error => {
          if (error) onError(error);
          else if (!settled && !deadlineReached() && phase === "write") phase = "response-header";
        });
      }
      catch (error) { onError(error); }
    };

    if (deadline !== undefined) {
      const remainingMs = deadline - now();
      if (remainingMs <= 0) return expire();
      absoluteTimer = setTimeout(expire, Math.ceil(remainingMs));
    }
    phase = "connect";
    try {
      void connect(path, connectController.signal).then(useSocket).catch(error => {
        if (!socket) connectFailed(error);
        else if (!settled && !deadlineReached()) fail("error", "socket-error", safeCode(error));
      });
    }
    catch (error) { connectFailed(error); }
  });
}
