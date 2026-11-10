export type Web6Boundary = "candidateMismatchOn" | "eligibility401" | "eligibility500";
export type Web6BoundaryState = {
  contextStatus: number | null; eligibilityStatus: number | null; refreshStatus: number | null;
  loginVisible: boolean; recoveryVisible: boolean; resendEnabled: boolean;
  confirmationVisible: boolean; additionalMutations: number;
};

export function assertWeb6BoundaryState(boundary: Web6Boundary, state: Web6BoundaryState) {
  const http = (value: number | null) => Number.isSafeInteger(value) && value! >= 100 && value! <= 599 ? value : null;
  const safe = { contextStatus: http(state.contextStatus), eligibilityStatus: http(state.eligibilityStatus), refreshStatus: http(state.refreshStatus),
    loginVisible: state.loginVisible === true, recoveryVisible: state.recoveryVisible === true,
    resendEnabled: state.resendEnabled === true, confirmationVisible: state.confirmationVisible === true,
    additionalMutations: Number.isSafeInteger(state.additionalMutations) && state.additionalMutations >= 0 ? state.additionalMutations : null };
  const signedOut = boundary === "eligibility401";
  // auth.access() refreshes an expiring bearer before dispatching context.
  // Null is unobserved, never proof that a request was not sent. The affirmative
  // denial + cleared UI remain mandatory for either inactive-account path.
  // Historical control name eligibility500 denies journal SELECT; the existing
  // controller maps that read failure to Operation.Unavailable / HTTP 503.
  const expectedHttp = signedOut ? (safe.contextStatus === null || safe.contextStatus === 401) && safe.refreshStatus === 401 && safe.eligibilityStatus === null
    : safe.contextStatus === 200 && safe.refreshStatus === null && safe.eligibilityStatus === (boundary === "eligibility500" ? 503 : null);
  if (!expectedHttp || safe.loginVisible !== signedOut || safe.recoveryVisible === signedOut || safe.resendEnabled === signedOut ||
      safe.confirmationVisible || safe.additionalMutations !== 0) {
    const label = ["candidateMismatchOn", "eligibility401", "eligibility500"].includes(boundary) ? boundary : "invalid-boundary";
    throw Error(`WEB6 boundary=${label} action=prepare ${JSON.stringify(safe)}`);
  }
}
