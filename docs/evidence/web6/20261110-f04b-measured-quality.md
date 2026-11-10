# WEB6 F04b — regression gates and measured-quality disposition

**Date:** 2026-11-10 (Asia/Bangkok). **Latest state:** ATTEMPT05 PREPARED / PIN_MATCHED, then BlockedNoAllocation after installed Edge bytes changed before run. All five live selectors NOT RUN; quality NOT MEASURED. Attempt04 remains FailedRetained with its resources untouched. Task 6 remains OPEN.

## Task 6 attempt05 prepared candidate and tool-pin refusal

New explicit Owner authorization selected candidate `web6-20261110-300ef832` after the backend source-admission correction. Executable source pins: backend `914b2196d41999f6f465ae076e4fcbe4ef524a87` / tree `62632251fb124f85769edde70fd7dd8e688f1051`, frontend `13179f56a3381275c0652f6edaf29258f18927f2` / tree `f493e5911494a3eb4361397e3c65c72ae37b87e9`. The controller explicitly distinguished frontend evidence head `cdae4f43cea5a06ea15b5b119622888dbc1faac6` from that exact executable pin; prepare created fresh clean detached worktrees and no pin guard changed.

Fresh roots, SQL approval, Owner authority and request were created. The SQL approval was independently bound to the designated effective master/server, with exact four-field `web6-cutover` schema, current-user-only protected ACL and eight-hour expiry `2026-11-10T16:14:46Z`; no previous approval/payload was copied or reused. The approved existing private Node `22.14.0` / npm `11.6.0` tree was independently revalidated across 2,337 files/572 directories for hashes, identity, ACL and no links. An issuance-only PowerShell 7/net48 ACL-API failure is retained separately; the controller approved a new root using existing Windows PowerShell before any authorize/prepare/run. No source/global/browser configuration change occurred.

Authorize ran once, exit 0. Prepare ran once, `08:15:31.8016884Z`–`08:18:21.2920865Z`, exit 0, `PIN_MATCHED`. Ordinary artifact has null candidate ID and remains OFF. All ten candidate dist files independently match the complete published wwwroot. Before run, the SQL parent was empty and all live roots absent.

| Artifact or receipt | SHA-256 |
|---|---|
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `bc8efce84e631b52fb4eace9bf42ee8f47414b1577b5cbf4f1926d6d55e190a9` / `ea0dfa8bb3b1385aae5ae8c96355b16277012bb5ea6722030bb0a873314224d2` |
| Current backend publish | `69a337871d09b214cfec188173b38b164ace51b570d3f0c666e0b340e7f5abc0` |
| Prepared receipt | `25323e16d014875c8b8e8617749028c05a6d407153f4c7d98fbd184b57b1d042` |
| BlockedNoAllocation receipt | `5066422846b7aff633a0cac7093a564816745d689ab2e872d4ad94aacb991844` |

The single run ended exit 4 at `08:18:40.9365692Z`, less than one second after invocation. Read-only diagnosis found seven of eight tool hashes matching but installed Edge changed from prepared `157.0.4341.42` / SHA-256 `d258e512aa24947cfbef0c0033d8c3cd56ecb40f7b2ad59802fa75c4e4f3324d` to observed `157.0.4341.46` / `3e2c8557b5ca4d78868d3089346146ceab94f198ce3d58526ce8f6c8d4b4167c`. The preselector tool-pin check refused this change. The agent did not update Edge; the responsible external actor was not established. Other prepared inputs: Windows 11 Home x64 build 26300, SDK `8.0.427`, SQL `14.0.2140.2`, IIS Express `10.0.26013.1000`, Chromium `156.0.8078.4`.

| Live gate | Discovered / executed / passed / failed / skipped | Disposition |
|---|---:|---|
| Chromium pair | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Edge pair | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Cutover | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

The terminal receipt has no selector/TRX. No new SQL database/login, host-runtime, IIS queue/process or browser context was allocated; SQL parent and evidence directory remain empty and live roots absent. Authorities, prepared worktrees/artifacts and receipts are retained. No run retry, receipt alteration, cleanup or adoption of historical resources occurred; attempt04 SQL/host-runtime remains untouched. There are no workload class samples/percentiles, observed RPO/RTO, Task4 acceptance, final independent disposition or CandidateVerified. A future attempt needs new explicit Owner authorization and a fresh approval/candidate/root chain with independently revalidated inputs. See [backend attempt05 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt05-prepared-then-blockednoallocation); the branch link identifies the pending local documentation update, not a claimed push/merge. Ordinary resend OFF; full IIS/unperformed Narrator NOT RUN, staging NOT ACCEPTED, production NO-GO. F04 and Task 6 remain incomplete.

Fresh pure verification at frontend evidence head `cdae4f4`: `npm.cmd run typecheck` PASS; `npm.cmd run test:unit` **81 files / 1,558 tests** PASS, zero failures. Backend `914b2196` reported Application **363**, HttpHost **635**, bootstrap plus source-admission **240** passing tests with zero failed/skipped and SQL variables removed from test children. These results provide no live pair/workload/recovery acceptance.

## Task 6 attempt04 prepared candidate and retained failure

Candidate `web6-20261110-182d4285` pinned frontend `13179f56a3381275c0652f6edaf29258f18927f2` (tree `f493e5911494a3eb4361397e3c65c72ae37b87e9`) and backend `18672300d642eef7944fbd540a42b3654783ba5b` (tree `f6a790770454112a27692220d359aef5e6e483c4`). These reviewed changes resolved the earlier held-parent hard-link publication error by streaming canonical UTF-8 manifest bytes to the backend's protected create-new writer. Prior attempts and artifacts were preserved unchanged.

The fresh Owner authority/request and revalidated independent protected SQL approval used new attempt04 roots. Existing private Node `22.14.0` / npm `11.6.0` copies were fully revalidated (2,337 files, tool-tree SHA-256 `c55ed76c2333bcb335b2327f639195464c2ed7685b329da812f02c85bed29529`); no install/global mutation or legacy-approval alteration occurred. Environment: Windows 11 Home x64 build 26300, backend SDK `8.0.427`, IIS Express `10.0.26013.1000`, SQL `14.0.2140.2`; prepared browser binaries Chromium `156.0.8078.4`, Edge `157.0.4341.42`.

Authorize exited 0. Prepare ran once and exited 0, `PREPARED / PIN_MATCHED`, at `2026-11-10T07:34:39Z`. Ordinary marker had `candidateId:null` (OFF); candidate marker exactly matched the ID above. Every one of the ten candidate dist files matched the complete published `wwwroot` file set. This is artifact/preparation proof, not browser acceptance.

| Artifact/receipt | SHA-256 |
|---|---|
| Prepared | `0a7376b0175c9e5fc1fa0fac254a9edeb2c3ca7b3293e83089ad4d9579e28c93` |
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `6efbddbe9391ade739710512e19423e6117e2183d99360f50641026dd0d7c9bf` / `bba31a3da72df6932133bd282dca9508330422bd13d896631a7a794dac4e71c5` |
| Backend current publish | `c7b2ba4ea6fbe186f97a834c0edb8d02d25fcdf216f07dd61216ba0b95b3491d` |
| FailedRetained terminal receipt | `07b1fa91391a2177aa6dfd81fa54df928b0f19cd1fea12ce5e7e2376f859c8a7` |
| Chromium selector TRX | `54bdb2ebe299cb65d36101046a92508292748af5c63b2dc772ee13a8154f4eae` |

The orchestrator ran exactly once (`07:35:43Z`–`07:36:27Z`) and exited 5. Its first Chromium .NET selector discovered/executed 1 row: **0 passed / 1 failed / 0 skipped**. `FileNotFoundException: CleanArchitecture.sln` occurred after owned database/runtime-login setup and host configuration, before IIS/browser launch; the backend repository uses `MyDmsVn.sln`. Native Chromium/IndexedDB cases were NOT RUN. Edge, cutover, workload and recovery each had 0 discovered/executed/pass/fail/skip because orchestration stopped; none is PASS.

One owned SQL database, one runtime login, private SQL control and host-runtime configuration are retained with original allocation evidence. Read-only identity/token observation confirmed that exact retained allocation; it supplied no deletion authority. The terminal receipt says `processTreeDrained=true` and `requiresDispositionProof=true`; no cleanup, retry, accepted Task4 receipt, final independent disposition or CandidateVerified is claimed. There are no workload samples, percentiles or recovery RPO/RTO.

Attempt01's legacy-authority refusal, attempt02's adjacent-npm mismatch and attempt03's held-parent publication failure remain historical retained attempts; later preparation success does not erase them. A further live attempt requires a reviewed backend source fix and **new explicit Owner authorization**, then fresh roots/authority/request. Ordinary resend remains OFF; the candidate artifact was not admitted as a pilot. Full IIS/unperformed Narrator remain NOT RUN within bounded exceptions; staging NOT ACCEPTED, production NO-GO. See backend [attempt04 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt04-prepared-then-failedretained) and [runbook](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/development/WEB6_CANDIDATE_RUNBOOK.md#attempt04-terminal-boundary). These branch links identify the pending documentation update; no push or merge is claimed.

Fresh requested pure checks after the attempt: frontend `13179f5` typecheck PASS and unit **81 files / 1,558 tests PASS**, zero failures. Backend `1867230` Application **363/363**, HttpHost **635/635** and four bootstrap Security classes **227/227** passed with zero failures/skips and SQL configuration removed from those test children. These source checks are separate from native browser/SQL acceptance. No live selector was rerun.

## Task 6 controlled bootstrap checkpoint

**Attempt01 history; the latest disposition is attempt05 above.**

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
