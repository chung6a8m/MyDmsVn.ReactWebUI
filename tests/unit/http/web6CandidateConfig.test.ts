// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import type { AuthSession, AuthSnapshot } from "../../../src/infrastructure/http/authSession";
import { createConfiguredProductionRuntime, readWeb6CandidateConfig } from "../../../src/app/runtime/web6CandidateConfig";
import * as productionRuntime from "../../../src/app/runtime/createProductionRuntime";

function authenticated(): AuthSession {
  const snapshot: AuthSnapshot = {
    status: "authenticated",
    deploymentEpoch: "11111111-2222-4333-8444-555555555555",
    actorKey: "42",
    actorGeneration: 1,
    capabilities: { read: true, write: true, post: true },
    features: {
      sales: { read: true, write: true, post: true },
      "goods-receipt": { read: true, write: true, post: true },
      "inventory-balances": { read: true },
      "inventory-stock-card": { read: true },
    },
  };
  return { getSnapshot: () => snapshot, subscribe: () => () => {} } as unknown as AuthSession;
}

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it("candidate config is disabled when absent or noncanonical", () => {
  for (const value of [undefined, "", " candidate", "candidate/one", ".candidate", "a".repeat(65)]) {
    expect(readWeb6CandidateConfig(value)).toEqual({ enabled: false });
  }
  expect(readWeb6CandidateConfig("web6-candidate_plan.1")).toEqual({
    enabled: true,
    candidateId: "web6-candidate_plan.1",
  });
});

it("configured production runtime passes the exact candidate once", () => {
  vi.stubEnv("VITE_MYDMSVN_WEB6_CANDIDATE_ID", "web6-candidate-plan");
  const createRuntime = vi.spyOn(productionRuntime, "createProductionRuntime");
  const auth = authenticated();
  const runtime = createConfiguredProductionRuntime(auth);
  expect(createRuntime).toHaveBeenCalledTimes(1);
  expect(createRuntime).toHaveBeenCalledWith(auth, {
    manualResend: { enabled: true, candidateId: "web6-candidate-plan" },
  });
  expect(runtime.operations.manualResendEnabled).toBe(true);
  runtime.workspace.dispose();
});
