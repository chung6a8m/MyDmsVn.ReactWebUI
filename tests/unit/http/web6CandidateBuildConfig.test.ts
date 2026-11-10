import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
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

it.each([undefined, "A"])("emits the production build marker for candidate environment %j", async (candidateId) => {
  vi.stubEnv("VITE_MYDMSVN_WEB6_CANDIDATE_ID", candidateId);
  const parent = realpathSync(tmpdir());
  const root = mkdtempSync(join(parent, "web6-marker-"));
  try {
    writeFileSync(join(root, "index.html"), '<!doctype html><script type="module">console.log("test")</script>');
    const result = await build({
      configFile: fileURLToPath(new URL("../../../vite.config.ts", import.meta.url)),
      root,
      logLevel: "silent",
      build: { write: false },
    });
    if (!("output" in result)) throw new Error("Expected one Vite build output.");
    const marker = result.output.find(asset => asset.fileName === "web6-candidate-build.json");
    expect(marker).toMatchObject({
      type: "asset",
      source: candidateId === undefined
        ? '{"version":1,"candidateId":null}'
        : '{"version":1,"candidateId":"A"}',
    });
  } finally {
    expect(dirname(root)).toBe(parent);
    rmSync(root, { recursive: true });
  }
});
