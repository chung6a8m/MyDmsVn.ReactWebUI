export type PilotControlAction = "resolveNegative" | "verifyNegative" | "armOriginal" | "waitOriginal" | "releaseOriginal";
export type PilotControlFailure = "socket" | "timeout" | "end" | "bad-frame";

// Never include raw errors: they can contain pipe names or other private data.
export function pilotControlError(action: PilotControlAction, failure: PilotControlFailure, code?: unknown): Error {
  const allowed = ["ENOENT", "EBUSY", "ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT"];
  const safeCode = typeof code === "string" && allowed.includes(code) ? code : "other";
  return new Error(`Owned pilot control failed: action=${action} failure=${failure} code=${safeCode}`);
}
