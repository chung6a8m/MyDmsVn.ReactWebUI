import type { Socket } from "node:net";
import { connectPilotPipe } from "./pilot-pipe-connect";

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
    let bytes = Buffer.alloc(0), settled = false;
    const fail = (terminal: Terminal, category: string, code?: string) => {
      if (settled) return;
      settled = true;
      reject(failure(terminal, category, code));
      socket.destroy();
    };
    socket.setTimeout(10_000, () => fail("timeout", "socket-timeout"));
    socket.on("error", error => fail("error", "socket-error", safeCode(error)));
    socket.on("end", () => fail("eof", "incomplete-response"));
    socket.on("data", chunk => {
      if (settled) return;
      bytes = Buffer.concat([bytes, chunk]);
      if (bytes.length < 4) return;
      const length = bytes.readInt32LE(0);
      if (length < 2 || length > 4096) return fail("protocol", "invalid-length");
      phase = "response-body";
      if (bytes.length < length + 4) return;
      phase = "response-validation";
      let reply: unknown;
      try { reply = JSON.parse(bytes.subarray(4, length + 4).toString("utf8")); }
      catch { return fail("parse", "invalid-json"); }
      if (!reply || typeof reply !== "object" || !("id" in reply) || reply.id !== id || !("ok" in reply) || reply.ok !== true)
        return fail("protocol", "reply-mismatch");
      settled = true; resolve(); socket.end();
    });
    phase = "write";
    try { socket.write(request); if (!settled) phase = "response-header"; }
    catch (error) { fail("error", "socket-error", safeCode(error)); }
  });
}
