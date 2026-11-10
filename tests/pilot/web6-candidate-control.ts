import type { Socket } from "node:net";
import { connectPilotPipe } from "./pilot-pipe-connect";

import { CANDIDATE_CONTROL_TIMEOUT_MS, CANDIDATE_MISMATCH_HEADER_TIMEOUT_MS } from "./web6-pair-budgets";
export { CANDIDATE_CONTROL_TIMEOUT_MS, CANDIDATE_MISMATCH_HEADER_TIMEOUT_MS, WEB6_FAIL_CLOSED_TEST_TIMEOUT_MS } from "./web6-pair-budgets";

const actions = ["verifyNotObserved", "verifyCommitted", "verifyOneEffect", "candidateMismatchOn", "candidateMismatchOff", "eligibilityNormal", "eligibility401", "eligibility500"] as const;
export type CandidateControlAction = typeof actions[number];
type Terminal = "timeout" | "error" | "eof" | "protocol" | "parse";
type Phase = "request" | "connect" | "write" | "response-header" | "response-body" | "response-validation";
const safeCodes = new Set(["ENOENT", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EPIPE", "EACCES", "EPERM", "ENOTCONN", "ECANCELED"]);
function safeCode(error: unknown): string | undefined {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return typeof code === "string" && safeCodes.has(code) ? code : undefined;
}

// Test-process IPC only. Never include frame bytes, pipe paths, raw errors or causes in diagnostics.
// The existing connector owns pre-connect ENOENT handling; this boundary never repeats a command.
export async function requestCandidateControl(
  action: CandidateControlAction, path: string, id: number, request: Buffer,
  connect: (path: string) => Promise<Socket> = connectPilotPipe,
  now: () => number = () => performance.now(),
): Promise<void> {
  const started = now();
  let phase: Phase = "request";
  const allowed = actions.includes(action);
  const failure = (terminal: Terminal, category: string, code?: string) => new Error(
    `Owned WEB6 candidate control failed: ${JSON.stringify({ action: allowed ? action : "unrecognized", terminal, phase,
      elapsedMs: Math.max(0, Math.floor(now() - started)), category, ...(code ? { code } : {}) })}`,
  );
  if (!allowed) throw failure("protocol", "invalid-action");
  phase = "connect";
  let socket: Socket;
  try { socket = await connect(path); }
  catch (error) {
    const code = safeCode(error);
    throw failure(code === "ETIMEDOUT" ? "timeout" : "error", "connect-error", code);
  }
  await new Promise<void>((resolve, reject) => {
    let bytes = Buffer.alloc(0), settled = false, headerReceived = false;
    let headerTimer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      clearTimeout(headerTimer);
      socket.setTimeout(0);
      socket.off("timeout", onTimeout);
      socket.off("end", onEnd);
      socket.off("data", onData);
      // Keep the guarded error listener until close: destroy/end can emit error.
    };
    const fail = (terminal: Terminal, category: string, code?: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(failure(terminal, category, code));
      socket.destroy();
    };
    const onTimeout = () => fail("timeout", "socket-timeout");
    const onError = (error: Error) => fail("error", "socket-error", safeCode(error));
    const onEnd = () => fail("eof", "incomplete-response");
    const onData = (chunk: Buffer) => {
      if (settled) return;
      bytes = Buffer.concat([bytes, chunk]);
      if (bytes.length < 4) return;
      const length = bytes.readInt32LE(0);
      if (length < 2 || length > 4096) return fail("protocol", "invalid-length");
      if (!headerReceived) {
        headerReceived = true;
        clearTimeout(headerTimer);
        socket.setTimeout(CANDIDATE_CONTROL_TIMEOUT_MS);
      }
      phase = "response-body";
      if (bytes.length < length + 4) return;
      phase = "response-validation";
      let reply: unknown;
      try { reply = JSON.parse(bytes.subarray(4, length + 4).toString("utf8")); }
      catch { return fail("parse", "invalid-json"); }
      if (!reply || typeof reply !== "object" || !("id" in reply) || reply.id !== id || !("ok" in reply) || reply.ok !== true)
        return fail("protocol", "reply-mismatch");
      settled = true; cleanup(); resolve(); socket.end();
    };
    const mismatch = action === "candidateMismatchOn" || action === "candidateMismatchOff";
    socket.setTimeout(mismatch ? CANDIDATE_MISMATCH_HEADER_TIMEOUT_MS : CANDIDATE_CONTROL_TIMEOUT_MS, onTimeout);
    // Unlike socket inactivity, this mismatch-only header deadline cannot be extended by partial bytes.
    if (mismatch) headerTimer = setTimeout(onTimeout, CANDIDATE_MISMATCH_HEADER_TIMEOUT_MS);
    socket.on("error", onError);
    socket.once("close", () => socket.off("error", onError));
    socket.on("end", onEnd);
    socket.on("data", onData);
    phase = "write";
    try { socket.write(request); if (!settled) phase = "response-header"; }
    catch (error) { fail("error", "socket-error", safeCode(error)); }
  });
}
