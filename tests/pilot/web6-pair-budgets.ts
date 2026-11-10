import type { Web6Boundary } from "./web6-boundary-diagnostics";

// Product httpTransport / authApi response+body deadlines, unchanged.
const HTTP_MS = 30_000, AUTH_MS = 15_000;
export const WEB6_UI_ASSERTION_MS = 5_000;
export const WEB6_BOUNDARY_ASSERTION_MS: Record<Web6Boundary, number> = {
  candidateMismatchOn: HTTP_MS + WEB6_UI_ASSERTION_MS,
  eligibility401: HTTP_MS + AUTH_MS + WEB6_UI_ASSERTION_MS,
  eligibility500: HTTP_MS + HTTP_MS + WEB6_UI_ASSERTION_MS,
};
export const WEB6_CONSENT_DISPATCH_TIMEOUT_MS = 2 * HTTP_MS + WEB6_UI_ASSERTION_MS;
export const WEB6_MUTATION_RESPONSE_TIMEOUT_MS = HTTP_MS + WEB6_UI_ASSERTION_MS;
export const CANDIDATE_CONTROL_TIMEOUT_MS = 10_000;
// SwitchOwnedHost explicit waits, including one loop overrun and final verification.
const MISMATCH_EXPLICIT_WAIT_MS = 30_000 + 10_000 + 10_000
  + (20_000 + 10_000 + 5_000 + 200) + (45_000 + 10_000 + 5_000 + 200) + 10_000 + 5_000;
export const CANDIDATE_MISMATCH_HEADER_TIMEOUT_MS =
  (Math.floor((MISMATCH_EXPLICIT_WAIT_MS + 5_000) / 10_000) + 1) * 10_000;

// Full successful-path accounting for the third test only. Parallel tab work
// contributes its maximum, not its sum. IPC may succeed on the final ENOENT try.
const PIPE_CONNECT_MS = 40 * 1_000 + 39 * 25; // pilot-pipe-connect.ts
export const WEB6_THIRD_PHASE_MS = {
  candidateControlConnect: 8 * PIPE_CONNECT_MS,
  candidateControlHeaders: 2 * CANDIDATE_MISMATCH_HEADER_TIMEOUT_MS + 6 * CANDIDATE_CONTROL_TIMEOUT_MS,
  candidateControlBodies: 8 * CANDIDATE_CONTROL_TIMEOUT_MS,
  permissionControls: 2 * CANDIDATE_CONTROL_TIMEOUT_MS,
  boundaryPredicates: Object.values(WEB6_BOUNDARY_ASSERTION_MS).reduce((sum, value) => sum + value, 0),
  loginAndRelogin: 2 * (4 * AUTH_MS + AUTH_MS), // login, me, epoch, sales + receipt capability
  initialLookups: 3 * HTTP_MS, // warehouse, employee, product
  originalUnknown: 3 * HTTP_MS, // context, receipt, original dispatch/abort
  permissionPrepare: 2 * HTTP_MS, // context then eligibility
  secondTabBootstrap: 4 * AUTH_MS, // me, epoch, sales + receipt capability
  parallelTabPrepare: 2 * HTTP_MS,
  consent: WEB6_CONSENT_DISPATCH_TIMEOUT_MS + WEB6_MUTATION_RESPONSE_TIMEOUT_MS,
  parallelReloadBootstrap: 4 * AUTH_MS,
  // login 6; new document 1; unknown 1; recovery/restore 7; permission 2;
  // consent 2; dispatch count 1; reload 4; final inspections 6. Boundary UI
  // allowances are already in boundaryPredicates. DISPATCHED restore is local.
  sequentialAssertions: 30 * WEB6_UI_ASSERTION_MS,
} as const;
export const WEB6_THIRD_SEQUENTIAL_MS = Object.values(WEB6_THIRD_PHASE_MS).reduce((sum, value) => sum + value, 0);
export const WEB6_BROWSER_ASSERTION_MARGIN_MS = 60_000; // existing browser/IDB/action allowance
export const WEB6_FAIL_CLOSED_TEST_TIMEOUT_MS =
  (Math.floor((WEB6_THIRD_SEQUENTIAL_MS + WEB6_BROWSER_ASSERTION_MARGIN_MS) / 60_000) + 1) * 60_000;
// Inactivity timers, OS, navigation, IDB and event scheduling are not absolute
// wall-clock guarantees. The enclosing finite deadline still fails closed.
