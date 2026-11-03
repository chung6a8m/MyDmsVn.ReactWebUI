import type { FullConfig, FullResult, Reporter, Suite } from "@playwright/test/reporter";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// Numeric-only evidence lives with the backend-owned temporary result; no test
// names, URLs, captured output or credentials are written to this file.
export default class PilotCountReporter implements Reporter {
  private suite?: Suite;
  onBegin(_config: FullConfig, suite: Suite) { this.suite = suite; }
  onEnd(_result: FullResult) {
    const manifestPath = process.env.MYDMSVN_WEB_PILOT_MANIFEST;
    if (!manifestPath || !this.suite) throw new Error("Owned pilot count requires a manifest and discovered suite.");
    const { resultPath } = JSON.parse(readFileSync(manifestPath, "utf8")) as { resultPath: string };
    if (typeof resultPath !== "string" || !resultPath) throw new Error("Owned pilot result path is required.");
    const tests = this.suite.allTests();
    const summary = { version: 1, discovered: tests.length, passed: 0, failed: 0, skipped: 0, interrupted: 0, retries: 0 };
    for (const test of tests) {
      summary.retries += Math.max(0, test.results.length - 1);
      const status = test.results.at(-1)?.status;
      if (status === "passed") summary.passed++;
      else if (status === "skipped") summary.skipped++;
      else if (status === "interrupted") summary.interrupted++;
      else summary.failed++;
    }
    writeFileSync(join(dirname(resultPath), "browser-count.json"), JSON.stringify(summary), "utf8");
  }
}
