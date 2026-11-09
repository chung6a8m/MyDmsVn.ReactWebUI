import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isWeb6CandidateManifestShape, readWeb6PilotManifest } from "./tests/pilot/web6-candidate-manifest";

// Only the backend's owned SQL/host fixture supplies this private, temporary file.
// Never fall back to a developer server, fake route, or ignored TLS error.
const manifestPath = process.env.MYDMSVN_WEB_PILOT_MANIFEST;
if (!manifestPath) throw Error("Run the backend owned browser pilot fixture; pilot manifest is required.");
const manifestHeader = JSON.parse(readFileSync(manifestPath, "utf8")) as { origin?: unknown; mode?: unknown };
const candidateManifest = isWeb6CandidateManifestShape(manifestHeader) ? readWeb6PilotManifest(manifestPath) : undefined;
const cutoverRequired = process.env.MYDMSVN_WEB6_CUTOVER_REQUIRED;
if (cutoverRequired !== undefined && cutoverRequired !== "1") throw Error("Invalid WEB6 cutover opt-in.");
if (cutoverRequired === "1" && !candidateManifest?.cutover) throw Error("Backend-owned WEB6 cutover handles are required.");
const origin = candidateManifest?.origin ?? manifestHeader.origin;
const mode = candidateManifest?.mode ?? manifestHeader.mode;
if (origin !== "https://localhost:44321") throw Error("Pilot requires the owned localhost HTTPS fixture.");
// The original backend Sales fixture omits mode. An unrecognized mode must not
// silently run only Sales and appear to verify a requested integrated pilot.
const testMatch = mode === undefined ? ["web2-live.spec.ts"]
  : mode === "web3-receipt" ? ["web2-live.spec.ts", "web3-receipt-live.spec.ts"]
  : mode === "web3-integrated" ? ["web2-live.spec.ts", "web3-receipt-live.spec.ts", "web3-integrated-live.spec.ts"]
  : mode === "web4-recovery" ? ["web4-recovery-live.spec.ts", "web4-boundaries-live.spec.ts"]
  : mode === "web5-recovery" ? ["web4-recovery-live.spec.ts", "web4-boundaries-live.spec.ts", "web5-resolution-live.spec.ts", "web5-negative-six-live.spec.ts"]
  : mode === "web6-candidate" ? candidateManifest?.cutover ? ["web6-cutover-live.spec.ts"] : ["web6-manual-resend-live.spec.ts"]
  : undefined;
if (!testMatch) throw Error("Unsupported owned browser pilot mode.");

export default defineConfig({
  testDir: "./tests/pilot",
  testMatch,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: mode === "web5-recovery" || mode === "web6-candidate" ? [["line"], ["./tests/pilot/pilot-count-reporter.ts"]] : "line",
  outputDir: "test-results/pilot",
  use: { baseURL: origin, viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: false,
    trace: "off", video: "off", screenshot: "off" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge", viewport: { width: 1440, height: 900 } } },
  ],
});
