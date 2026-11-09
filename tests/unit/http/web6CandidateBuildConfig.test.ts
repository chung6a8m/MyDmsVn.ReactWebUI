import { afterEach, expect, it, vi } from "vitest";
import viteConfig from "../../../vite.config";

afterEach(() => vi.unstubAllEnvs());

it("production build rejects a noncanonical candidate", () => {
  const configure = viteConfig as (environment: { command: "build"; mode: string; isSsrBuild: boolean; isPreview: boolean }) => unknown;
  vi.stubEnv("VITE_MYDMSVN_WEB6_CANDIDATE_ID", "candidate/invalid");
  expect(() => configure({ command: "build", mode: "production", isSsrBuild: false, isPreview: false })).toThrow(/VITE_MYDMSVN_WEB6_CANDIDATE_ID/);
});
