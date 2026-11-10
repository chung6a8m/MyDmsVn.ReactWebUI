import { expect, it } from "vitest";
import { assertWeb6BoundaryState } from "../../pilot/web6-boundary-diagnostics";

const protectedState = { contextStatus: 200, eligibilityStatus: null, refreshStatus: null,
  loginVisible: false, recoveryVisible: true, resendEnabled: true, confirmationVisible: false, additionalMutations: 0 };

it("accepts candidate mismatch only with protected recovery and zero mutations", () => {
  expect(() => assertWeb6BoundaryState("candidateMismatchOn", protectedState)).not.toThrow();
  expect(() => assertWeb6BoundaryState("candidateMismatchOn", { ...protectedState, confirmationVisible: true })).toThrow();
});
it("accepts an eligibility server failure only after observing the failing eligibility GET", () => {
  expect(() => assertWeb6BoundaryState("eligibility500", { ...protectedState, eligibilityStatus: 500 })).not.toThrow();
  expect(() => assertWeb6BoundaryState("eligibility500", protectedState)).toThrow();
});
it("requires refresh denial to clear recovery and show Login, never an enabled resend selector", () => {
  const signedOut = { ...protectedState, contextStatus: 401, refreshStatus: 401,
    loginVisible: true, recoveryVisible: false, resendEnabled: false };
  expect(() => assertWeb6BoundaryState("eligibility401", signedOut)).not.toThrow();
  expect(() => assertWeb6BoundaryState("eligibility401", { ...signedOut, recoveryVisible: true })).toThrow();
  expect(() => assertWeb6BoundaryState("eligibility401", { ...signedOut, refreshStatus: null })).toThrow();
});
it("rejects mutation at every boundary and emits only allowlisted facts on failure", () => {
  for (const boundary of ["candidateMismatchOn", "eligibility401", "eligibility500"] as const) {
    let message = "";
    try { assertWeb6BoundaryState(boundary, { ...protectedState, additionalMutations: 1,
      token: "private-token", payload: "private-business", candidateId: "private-candidate" } as never); }
    catch (error) { message = (error as Error).message; }
    expect(message).toContain(boundary);
    expect(message).toContain('"additionalMutations":1');
    expect(message).not.toMatch(/private|token|payload|candidateId/);
  }
});
