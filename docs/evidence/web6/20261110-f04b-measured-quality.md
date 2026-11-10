# WEB6 F04b — regression gates and measured-quality disposition

**Date:** 2026-11-10 (Asia/Bangkok). **State:** FRONTEND REGRESSION PASS; TASK 6 BLOCKED / NO LIVE ALLOCATION. LIVE PAIR/CUTOVER/LOAD/RECOVERY NOT RUN; QUALITY NOT MEASURED.

## Task 6 controlled bootstrap checkpoint

Frontend source `5f7c0051497e8631925b68127ff556d2d066cd5c`, tree `158c5ec562b8bf66e7be3ea8db41cbae32b7e5c2`, was clean and detached. Paired backend source `9351942bd7c144f0f221b2cc4c78577c5f4d92f4`, tree `270455fa95a309fe705248665f8739d13c030c59`, supplied the new bootstrap. Candidate `web6-20261110-25a1cf46` / `attempt01` ran at `2026-11-10T05:01:14Z` under explicit nonproduction drill authority. Authorize passed (exit 0); prepare refused (exit 4, `BLOCKED_PREFLIGHT`) before artifact preparation or any live selector.

The designated legacy SQL approval had an unprotected inherited DACL, including modification rights for another principal; its schema also differs from the required WEB6 approval. Its original bytes and ACL were kept unchanged. No copy, ACL repair, derived authority or replacement was created. The backend's read-only diagnostic confirmed `protected-sql-approval-read` refusal after authority/request/tool/certificate binding. A separately issued protected SQL approval is required under the backend runbook before a new attempt. Existing historical quarantines and failed-attempt resources were untouched.

Protected Owner authority SHA-256: `628f0795fc78212697f293a08d45bd5ffd07b6531cc597504da083a05ff49085`. Strict request SHA-256: `66fb71c14d5842173afdefe64b6c4f0a3d5d9eb7d449064927acb3e8fe6f7bfa`. Private attempt summary SHA-256: `d30cfc8cfb72d498585d511c78a188f5e55d73f6d30ea492f6ea9e0ef8281080`. Private identifiers, credentials and raw logs are not committed.

| Fresh frontend gate at the source pin | Result |
|---|---|
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run test:unit` | 81 files / 1,552 tests passed, 0 failed |
| Candidate/ordinary artifact preparation for this attempt | NOT RUN; no new dist/publish hashes or fresh ordinary-artifact OFF proof |
| Live Chromium pair | 0 discovered/executed/passed/failed/skipped; NOT RUN |
| Live Edge pair | 0 discovered/executed/passed/failed/skipped; NOT RUN |
| Live cutover / workload / recovery | Each 0 discovered/executed/passed/failed/skipped; NOT RUN |

Node `22.14.0`, npm `11.6.0`, Windows 11 Home x64 build 26300. Backend fresh pure gates passed Application 363/363, HttpHost 635/635 and bootstrap-focused Security 218/218, each zero failed/skipped, with SQL configuration removed from those test children. These counts are separate from browser tests and provide no SQL/IndexedDB-native acceptance.

The task root was never created and the new SQL control parent remained empty. No live SQL/IIS/browser allocation, physical business oracle, workload sample, RPO/RTO measurement, Prepared receipt or CandidateVerified receipt exists for this attempt. New private authority/request/diagnostic records and empty parent directories were retained. No roadmap status advances; Task 6 remains open. Ordinary resend remains OFF in source and no candidate artifact was admitted. Full IIS/unperformed Narrator remain NOT RUN within their bounded exceptions; staging NOT ACCEPTED, production NO-GO. See the backend [candidate runbook](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/development/WEB6_CANDIDATE_RUNBOOK.md#7-controlled-bootstrap-and-protected-sql-approval) and [paired evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-controlled-bootstrap-attempt) for the exact remediation contract. The branch links identify the pending documentation update; no push or merge is claimed here.

## Frontend gates at `9eb7d37`

Windows, Node `22.14.0`, npm `11.6.0`, Playwright `1.64.1`. Commands ran serially in the isolated frontend worktree.

| Gate | Result |
|---|---|
| `npm.cmd ci` | PASS; 419 packages added, 420 audited; 6 advisories retained (2 low, 4 moderate), no package mutation. |
| `npm.cmd run typecheck` | PASS. |
| `npm.cmd run test:unit` | PASS; 80 files, 1,517 tests, 0 failed. |
| Ordinary `npm.cmd run build` | PASS; 2,579 modules; ordinary resend OFF. Existing chunk warning: main JS 2,419.79 kB / 680.28 kB gzip. |
| Ordinary production Playwright, one worker | PASS; 2 discovered/executed/passed, 0 failed/skipped/retried. These are artifact-isolation/default-OFF tests with controlled browser routes, not the live pilot pack. |
| Ordinary `dist` deterministic tree digest | `b2422fdce8d0b8645a3f6213952ce2b4c6bff288c0c8a217ed655b70be93ce88`. This is not a candidate-enabled artifact hash. |

No scenario-row count is added to the browser-test count. The three cutover specs and three manual-resend specs were statically discovered during implementation, but were not executed against the backend candidate and therefore are not PASS evidence.

## Backend-linked quality disposition

- Backend workload code requires all six mutation classes and four supporting classes, bounded attempts toward 1,000 observations/class, p50/p95/p99, error/timeout/CPU/RAM/SQL lock/session/journal measurements, PR #95 re-admission and no retry. The exact selector was BLOCKED before allocation, so `F6-LOAD-01` is **NOT RUN / NOT MEASURED** and no percentile, throughput, capacity or SLA statement exists.
- Backend recovery code implements a real source-host interruption, protected backup into a distinct owned restore, epoch/principal rotation, Task2/PR #95 admission, stale 409 zero-effect checks, authenticated HTTP Sales Create/Update/Post and a full physical oracle. The exact selector lacked the accepted Task4 receipt and complete candidate inputs, so `F6-REC-01` is **BLOCKED / NOT RUN** and no RPO/RTO value is claimed.
- Backend verification retained failed attempts and owned resources when cleanup certainty was absent, including two fresh SQL runs from an initial permission-preflight defect. Later fresh green tests do not erase or authorize cleanup of those retained runs.
- A full backend Security project PASS is not claimed: an earlier overlapping destructive-suite attempt was aborted and later scoped affected gates were used. Frontend regression PASS cannot replace backend SQL/IIS/browser acceptance.

Ordinary manual resend remains OFF. Pilot enablement requires a separately accepted live pair and explicit Owner decision. Staging remains NOT ACCEPTED; production remains NO-GO / DEFERRED.
