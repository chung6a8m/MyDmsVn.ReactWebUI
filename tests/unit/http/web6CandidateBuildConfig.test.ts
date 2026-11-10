import { afterEach, expect, it, vi } from "vitest";
import viteConfig from "../../../vite.config";

afterEach(() => vi.unstubAllEnvs());

const configure = viteConfig as (environment: { command: "build"; mode: string; isSsrBuild: boolean; isPreview: boolean }) => unknown;
const productionBuild = () => configure({ command: "build", mode: "production", isSsrBuild: false, isPreview: false });

it.each(["A", "a" + "Z0._-".repeat(12) + "Z0_"])("production build accepts canonical candidate %j", (candidateId) => {
  vi.stubEnv("VITE_MYDMSVN_WEB6_CANDIDATE_ID", candidateId);
  expect(productionBuild).not.toThrow();
});

it.each(["candidate/invalid", "candidate invalid", "-candidate", ".candidate", "_candidate", "a".repeat(65)])(
  "production build rejects noncanonical candidate %j",
  (candidateId) => {
    vi.stubEnv("VITE_MYDMSVN_WEB6_CANDIDATE_ID", candidateId);
    expect(productionBuild).toThrow(/VITE_MYDMSVN_WEB6_CANDIDATE_ID/);
  },
);
