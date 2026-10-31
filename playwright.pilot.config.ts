import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";

// Only the backend's owned SQL/host fixture supplies this private, temporary file.
// Never fall back to a developer server, fake route, or ignored TLS error.
const manifestPath = process.env.MYDMSVN_WEB_PILOT_MANIFEST;
if (!manifestPath) throw Error("Run the backend WEB2 browser pilot fixture; pilot manifest is required.");
const { origin } = JSON.parse(readFileSync(manifestPath, "utf8"));
if (origin !== "https://localhost:44321") throw Error("Pilot requires the owned localhost HTTPS fixture.");

export default defineConfig({
  testDir: "./tests/pilot",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: "line",
  outputDir: "test-results/pilot",
  use: { baseURL: origin, viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: false,
    trace: "off", video: "off", screenshot: "off" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge", viewport: { width: 1440, height: 900 } } },
  ],
});
