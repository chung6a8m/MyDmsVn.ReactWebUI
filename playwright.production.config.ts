import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/production",
  outputDir: "./test-results/production",
  retries: 0,
  use: { baseURL: "http://127.0.0.1:5174", ...devices["Desktop Chrome"] },
  webServer: {
    command: "npm exec vite -- preview --host 127.0.0.1 --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
  },
});
