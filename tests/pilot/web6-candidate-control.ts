import type { Socket } from "node:net";
import { requestWeb6Control } from "./web6-control-transport";

import { CANDIDATE_CONTROL_TIMEOUT_MS, CANDIDATE_MISMATCH_HEADER_TIMEOUT_MS } from "./web6-pair-budgets";
export { CANDIDATE_CONTROL_TIMEOUT_MS, CANDIDATE_MISMATCH_HEADER_TIMEOUT_MS, WEB6_FAIL_CLOSED_TEST_TIMEOUT_MS } from "./web6-pair-budgets";

const actions = ["verifyNotObserved", "verifyCommitted", "verifyOneEffect", "candidateMismatchOn", "candidateMismatchOff", "eligibilityNormal", "eligibility401", "eligibility500"] as const;
export type CandidateControlAction = typeof actions[number];

export async function requestCandidateControl(
  action: CandidateControlAction, path: string, id: number, request: Buffer,
  connect?: (path: string, signal?: AbortSignal) => Promise<Socket>,
  now?: () => number,
): Promise<void> {
  const mismatch = action === "candidateMismatchOn" || action === "candidateMismatchOff";
  await requestWeb6Control(path, id, request, {
    flow: "candidate", action, actions, timeoutMs: CANDIDATE_CONTROL_TIMEOUT_MS,
    headerTimeoutMs: mismatch ? CANDIDATE_MISMATCH_HEADER_TIMEOUT_MS : undefined,
  }, connect, now);
}
