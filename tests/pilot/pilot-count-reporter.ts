import type { FullConfig, FullResult, Reporter, Suite } from "@playwright/test/reporter";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createWeb6PilotCountSummary, readWeb6PilotManifest } from "./web6-candidate-manifest";

// Numeric-only evidence lives with the backend-owned temporary result; no test
// names, URLs, captured output or credentials are written to this file.
export default class PilotCountReporter implements Reporter {
  private suite?: Suite;
  onBegin(_config: FullConfig, suite: Suite) { this.suite = suite; }
  onEnd(_result: FullResult) {
    const manifestPath = process.env.MYDMSVN_WEB_PILOT_MANIFEST;
    if (!manifestPath || !this.suite) throw new Error("Owned pilot count requires a manifest and discovered suite.");
    const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as { mode?: unknown; resultPath?: unknown };
    const candidate = raw.mode === "web6-candidate" ? readWeb6PilotManifest(manifestPath) : undefined;
    const resultPath = candidate?.resultPath ?? raw.resultPath;
    if (typeof resultPath !== "string" || !resultPath) throw new Error("Owned pilot result path is required.");
    const tests = this.suite.allTests();
    const statuses: ("passed" | "failed" | "skipped" | "interrupted")[] = [];
    let retries = 0;
    for (const test of tests) {
      retries += Math.max(0, test.results.length - 1);
      const status = test.results.at(-1)?.status;
      statuses.push(status === "passed" || status === "skipped" || status === "interrupted" ? status : "failed");
    }
    const summary = candidate
      ? createWeb6PilotCountSummary(statuses, retries)
      : { version: 1, discovered: tests.length, passed: statuses.filter(value => value === "passed").length,
          failed: statuses.filter(value => value === "failed").length, skipped: statuses.filter(value => value === "skipped").length,
          interrupted: statuses.filter(value => value === "interrupted").length, retries };
    writeFileSync(join(dirname(resultPath), "browser-count.json"), JSON.stringify(summary), "utf8");
  }
}
