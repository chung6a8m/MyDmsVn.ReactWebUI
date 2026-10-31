import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  // This test launches its own bundled Chromium extension profile, not Edge.
  testIgnore: "**/workspace-zoom.spec.ts",
  outputDir: "./test-results/edge",
  projects: [
    { name: "msedge", use: { ...devices["Desktop Edge"], channel: "msedge" } },
  ],
});
