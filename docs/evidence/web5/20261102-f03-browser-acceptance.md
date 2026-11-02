# WEB5-03 / F03 — Browser and actual-port acceptance

**2026-11-02: F03 DONE (bounded) / VERIFIED NONPRODUCTION technical scope.** Owner selected WEB5-02/03 and authorized backend B02/B04-B. Final local unit, build, artifact, Chromium, focused Edge and current-code actual-port integration gates are complete below. This record separates native browser/IndexedDB evidence, actual frontend-port/TestServer/SQL integration and hosted CI. Final documentation-head CI will be recorded in the PR; no future hosted frontend PASS is claimed. [Owning plan F03](../../plans/20261102-001-web5-operational-safety-web.md#4-f03--native-browser-ci-and-regression-integrity-web5-03) · [acceptance matrix](../../development/WEB5_WEB_ACCEPTANCE.md) · [recovery design](../../design/WEB5_RECOVERY_AND_RELEASE_BOUNDARIES.md).

## Candidate and contract pins

| Item | Source / disposition |
| --- | --- |
| Final F03 code/test checkpoint | `788ed56f745db0811bebc03f11da3be81c561cab`, branch `codex/web5-f03-browser-acceptance`; two cross-kind history cases plus response-drain assertion |
| F02 functional base | `55807551d2872f36b61ac52109472a67c46ff7bb`, including current-operation grant isolation from historical negatives |
| Shared frontend `src` tree | `8e89dbda9722745c7f462317ab7b00213d8ebf62`; F03 additions over the F02 base are tests/helpers/configuration, not runtime changes |
| Earlier combined checkpoint | `436b18abac0acc4f770332817920af152b8ea09c`, based on `cf5252071dc7bacda3d0240b30d6d30196385959`, former `src` tree `3745168523d8853e7fe49b0f67de716af4352f44`; its273/123 and1,395-unit results remain historical below |
| Production v2 port checkpoint | `b017da6b3867fc5ff1885c8aed7538103c374d8f` |
| Initial F03 browser increment | `f218c5c5fe4e43147790b7933948ccebc565e170`; verified before the full terminal-resolution core/port integration, not the final F03 candidate |
| Earlier actual-port bridge | `08d437bf6f5b6d4e98a517243a33d241ca5fb759`; identical bridge bytes were exercised before that commit, then rebased with F02 |
| Backend executable contract | `2d72700294227ef69f1a7a61a2969a6bfe2c58be`; [versioned contract](https://github.com/chung6a8m/MyDmsVn/blob/2d72700294227ef69f1a7a61a2969a6bfe2c58be/docs/contracts/web5-resolution-v1/README.md) |
| Backend final head | `272e1d2fa98848f5a65236f9d6b7b40a34a1011d`; documentation closeout over unchanged executable source, [PR #91](https://github.com/chung6a8m/MyDmsVn/pull/91) |
| Separate resolution corpus | `web5-resolution-v1`; 40 manifest-owned files; manifest SHA256 `fef5f1f18d3a556bf35d5c9ed6bc38af3eeb0c1a89dd5f9d125d7fb190a133b2`; frontend provenance pins backend source above |
| Frozen WEB4 corpus | Original 48 blobs unchanged; backend tree `fcab4a1e7505b150a132ce2899002930e9f2a6ee`; original request bytes/fingerprints/outcomes retained |

The selected compatibility policy is additive. Strict-only F5-COMP-03/04 and F5-RES-14 are **NOT_APPLICABLE**, not passing or skipped required tests. Backend schema013 is explicit `web5`/exact13; the backend owns its migration, permission and durable-negative proof. Corpus vectors are authored contract evidence, not captured SQL output.

## Changed browser boundaries

The 13 cases in `web5RecoveryBoundaries.spec.ts` use real browser controls and native IndexedDB with controlled HTTP. Six held positive-status cases cover Sales Create/Receipt Post across original-grant revocation, actor change and epoch change; Enter/Tab while checking cannot dispatch another read. Two genuine second-tab cases compete for one atomic settlement, retain the losing raw draft and reject its local retry without HTTP/overwrite. Two actual page-close/reopen cases retain UNKNOWN until an explicit status read; two aborted reads retain the exact checkpoint; one real IndexedDB transaction abort leaves both records protected and then retries cached proof locally without HTTP. The six existing command positives were strengthened to allow only the original Write or Post grant while denying Read and the other mutation grant.

The 17 cases in `web5TerminalBoundaries.spec.ts` extend the versioned negative path: two stored-negative reloads require fresh authority; six late certificates cannot survive original-grant/actor/epoch changes; four wrong-fingerprint/missing-certificate cases retain exact UNKNOWN bytes; two genuine tabs compete for one negative CAS; two Update paths require current Read, explicit fresh-baseline confirmation and a new operation key; one Create consent case uses Space/Tab/Enter and verifies focus restoration without dispatch. Capability refresh intentionally publishes denied grants first, so earlier terminal authority must be reverified before later baseline review.

Two additional cases in `web5HistoricalRecovery.spec.ts` bring this extension to 19 native cases. Production IndexedDB repositories create an old NOT_EXECUTED decision and a distinct current DISPATCHED intent through actual sequence/CAS transitions; ephemeral admission is cleared before app navigation. Receipt Post history with current Receipt Update, and Sales Update history with current Sales Post, each deny the old grant while retaining only the current operation's original grant. Restore performs zero automatic HTTP; one explicit current v2 read settles only the current operation at draft sequence 5 with unchanged frozen bytes. Old certificate metadata stays hidden, the old negative record remains unchanged, and a fresh repository still rejects draft write/delete. Current positive settlement reasserts historical edit/review protection instead of retiring history.

Assertions inspect actual local operation/draft states, sequences, frozen requests, raw snapshots, stable client line IDs, exact request counts and disabled commands. Native transaction completion and CAS are observed rather than inferred from toolbar visibility. Controlled HTTP does not prove SQL commit/rollback, and actual page closure is not OS/server process-death proof. Existing helper consumers, layout/inventory/raw/large-grid and recovery regressions remain part of the selected/full browser gates.

Independent read-only source review covered both new files, the original-grant/raw-note helper changes, actual-port test, IPC adapter and opt-in config. Verdict **APPROVED**, no actionable P1/P2. The final `436b18a` two-file test-only correction was also inspected: the controlled committed response now echoes the exact frozen note sent, and keyboard reopening waits for modal removal/focus restoration. Frozen corpus bytes and Post shapes remain unchanged. Deferred-route/prototype restoration through `finally` was noted as nonblocking harness cleanup polish; Playwright context lifetime bounds those fixtures. Final candidate execution is recorded separately below.

The subsequent two cross-kind cases, trusted native-repository harness and explicit second-write response wait were independently reviewed at `788ed56f`: **APPROVED**, no actionable P1/P2. The response wait is armed before dispatch and matches the new key and mutation path; existing assertions remain intact. F02 independently owns four corrected findings: P1 validation-cache/adoption interleave, P2 failed explicit recheck retaining authority, P2 unvalidated clean-preview privacy, and P2 historical-grant coupling blocking a separate current operation's readback. The latest runtime fix was independently approved; these two native cases verify its browser boundary without weakening historical protections.

## Verification ledger

Measured local toolchain: Windows NT10.0.26300, Node22.14.0, npm11.6.0, Playwright1.64.1; Chromium156.0.8078.4 and Microsoft Edge156.0.4314.58. Repository Playwright was used because the Browser plugin skill was unavailable. Dependencies remain pinned. The initial native runs used repository-managed Vite5173 with strict port/no reuse; isolated targeted/Edge runs used separate ports. Final full Chromium on5173 and focused Edge on5180 ran serially with watched workspace files frozen. Browsers and servers were stopped before this evidence update.

| Checkpoint | Actual result | Scope / limitation |
| --- | --- | --- |
| Initial browser increment install/typecheck | PASS | `npm.cmd ci`, 419 packages, unchanged lock; `npm.cmd run typecheck` |
| Initial full unit checkpoint | 68 files, 1,238/1,238 PASS, 8.48s | `f218c5c` checkpoint; predates full F02 core/port |
| Initial affected Chromium | 51/51 PASS, 2.0m; zero failed/skipped | 13 new v1 boundaries +38 retained cases, including six strengthened original-grant positives |
| Initial affected Edge | 51/51 PASS, 2.6m; zero failed/skipped | Same affected selection; focused Edge, not full Edge |
| New 17 v2 boundary cases, Chromium | 17/17 PASS, 45.9s | Isolated Vite5179; follows the retained fixture failures below; not full Chromium |
| F03 typecheck after v2 boundary additions | PASS | No runtime change required by the test increment |
| Shared F02 functional-source unit gate | 71 files, 1,395/1,395 PASS | Source `cf52520`; reused source proof, not a substitute for the final F03 command |
| Shared F02 build/typecheck/artifact | PASS; artifact1/1 PASS, 5.4s | Source `cf52520`; existing Vite large-chunk warning retained |
| Earlier F03 full unit at `436b18a` | 71 files, 1,395/1,395 PASS, 7.59s | Historical full checkpoint; zero failed/skipped |
| Earlier F03 build/typecheck/artifact at `436b18a` | PASS; artifact1/1 PASS,4.4s | Former source/assets, before the current-operation grant fix |
| Earlier F03 full Chromium at `436b18a` | 273/273 PASS,6.2min; zero failed/skipped, retries0 | Historical full native checkpoint with watched files frozen |
| Earlier F03 focused Edge at `436b18a` | 123/123 PASS,4.3min; zero failed/skipped, retries0 | Eight affected files; focused selection, not full Edge |
| New cross-kind native cases | 2/2 PASS,11s on first attempt; typecheck PASS | Production native IDB transitions and explicit current-only protected read |
| F03 final own full unit | 71 files, **1,397/1,397 PASS**,6.41s | `npm.cmd run test:unit`; current F02 source55807551/F03 code788ed56f, zero failed/skipped |
| F03 final typecheck/build | PASS | `npm.cmd run typecheck`, `npm.cmd run build`; existing Vite large-chunk warning retained |
| F03 final artifact isolation | **1/1 PASS**,5.8s | Current production artifact, latest assets below |
| F03 final full Chromium | **275/275 PASS**,6.5min; zero failed/skipped, retries0 | Current final code788ed56f; includes the two history cases |
| F03 final focused Edge | **125/125 PASS**,4.7min; zero failed/skipped, retries0 | Nine affected specs including history2; focused selection, not full Edge |
| Shared F02 second full Chromium attempt | 243 executed:241 PASS /2 FAIL | Two old Lab cases interrupted by full-page reloads; retained diagnosis and unchanged frozen rerun below. The earlier436b18a full273 checkpoint included those cases and passed; current788ed56f full275 also covers and passes them |
| Previous actual-port bridge | 1/1 .NET wrapper PASS, zero skipped; 1/1 child Vitest PASS | Backend `272e1d2` + F03 code `2f087ca`; applicable port/bridge blobs unchanged; historical physical oracle/counters/cleanup proof |
| Current-code actual-port bridge | **1/1 .NET wrapper PASS**, zero skipped; **1/1 child Vitest PASS** | Exact backend `272e1d2` + current F03 `788ed56f`; physical oracle/counter checks and independent zero-resource cleanup PASS |
| Exact-head hosted CI / merge gate | Delivery PR owns the final result before acceptance/merge | No future hosted PASS is inferred from local gates or historical source CI |

Initial affected browser commands (all at the initial checkpoint):

```text
npm.cmd run test:e2e -- tests/e2e/web5RecoveryBoundaries.spec.ts tests/e2e/web4RecoveryWorkspace.spec.ts tests/e2e/web5OperatorMetadata.spec.ts tests/e2e/durableDraftWorkspace.spec.ts tests/e2e/web4FailureBoundaries.spec.ts --project=chromium --workers=2
npm.cmd run test:e2e -- --config playwright.edge.config.ts tests/e2e/web5RecoveryBoundaries.spec.ts tests/e2e/web4RecoveryWorkspace.spec.ts tests/e2e/web5OperatorMetadata.spec.ts tests/e2e/durableDraftWorkspace.spec.ts tests/e2e/web4FailureBoundaries.spec.ts --workers=2
```

Final F03 assets below include the current-operation grant fix. F03's `src` equals its F02 base55807551, tree `8e89dbda9722745c7f462317ab7b00213d8ebf62`; package manifests/lock and Vite configuration remain unchanged. F03's own build and artifact gate both passed. Earlier436b18a/F02cf52520 produced `index-DVWN4-YJ.js` SHA256 `382DB2C8B365B12B9501C0E5DA14CEFFF60C649680480294C6350A7E5F6A71CD`; that is a historical artifact, not the current JS:

| Asset | SHA256 |
| --- | --- |
| `index-S3Wrz3i4.js` | `89012FF1EF6D2F205ED845C2EB2C086FEB84E17659F889C3B7061C53755C977D` |
| `index-io_KjKCp.css` | `1D481D99749429B6F18DAF87919F8C6839579839EC23AC28FA5ECE6980DF2A80` |

## Actual-port integration and backend proof

The opt-in `vitest.web5.integration.config.ts` selects only `web5-ports.test.ts`; it is absent from secret-free frontend unit/browser CI. The backend owns the disposable SQL database, restricted principal, OWIN TestServer, child process and protected IPC. `testServerFetch.ts` replaces only fetch; production auth, strict wire decoding, fingerprinting, mapping and resolution ports remain in use. The WEB5 extension admits only explicit v2 GETs; it does not fabricate authorization or responses. Acknowledgement loss is injected after a real server response. Operator resolution is available only through the private owned fixture.

Earlier local integration passed **one .NET wrapper and one child Vitest case**, backend `2d727002` with bridge bytes fixed at frontend `08d437bf`. Integration then repeated successfully at exact backend `272e1d2fa98848f5a65236f9d6b7b40a34a1011d` and committed F03 `2f087caddfa87a2d0f68bee0eefc63537307e6c0`: **one .NET wrapper executed/passed, zero skipped; one child Vitest executed/passed**. Production source and port/bridge blobs were identical through F03 `436b18abac0acc4f770332817920af152b8ea09c`; the latest F02 runtime fix changes the shared source tree, so the current 788ed56f rerun is recorded separately below. Both completed integration runs observed six original COMMITTED outcomes, six durable NOT_EXECUTED keys, twelve keys with exactly one mutation dispatch each, six operator decisions, eighteen v2 reads, two denied ordinary Get responses and one TestServer restart. Original versions/line IDs and the Receipt Post absence of version were checked; the backend independently checked physical SQL and completed owned fixture disposal. After the completed272e1d2/2f087ca run, an independent master metadata query found zero test databases and zero matching test-database sessions; Windows process inspection found zero matching Vitest bridge children. Private run output remains outside Git. These counts are not Playwright cases. This is actual frontend-port/TestServer/SQL interoperability, not native-browser SQL, IIS/TLS or attended user confirmation; later documentation-head CI is separately owned.

The current-code bridge also completed successfully at exact backend `272e1d2fa98848f5a65236f9d6b7b40a34a1011d` and F03 `788ed56f745db0811bebc03f11da3be81c561cab`: **one .NET wrapper executed/passed, zero skipped; one child Vitest executed/passed**. All physical SQL oracle/counter checks passed: twelve keys with one dispatch each, six COMMITTED plus six NOT_EXECUTED, six operator decisions, eighteen status reads, two ordinary Read403 responses and one TestServer restart. Independent post-run inspection found zero test databases, zero matching SQL sessions and zero bridge children. This is the current integration proof; older 272e1d2/2f087ca results remain historical.

## Historical frontend CI checkpoints

- F03 source436b18a [push run41443243679](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/41443243679) passed 1,395 units +273 Chromium +1 artifact case.
- Earlier F02 documentation checkpoint [PR run41443303378](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/41443303378) passed 1,395 units +243 Chromium +1 artifact case.
- Its [push run41443295227](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/41443295227) failed Chromium242/243: a route callback was still awaiting `page.evaluate` when the test ended. The test now awaits the newly dispatched HTTP response before finishing; the fix is included in F02 source55807551 and F03 baseline788ed56f without weakening assertions.

These are source-specific historical results, not CI proof for the latest runtime/test candidate or the forthcoming documentation HEAD. Root must verify exact final-head CI before final readiness; its run IDs/results will be recorded in the PR after the documentation commit.

## Backend exact-candidate proof

Backend B02/B04-B is independently verified at final backend HEAD `272e1d2fa98848f5a65236f9d6b7b40a34a1011d`:

- [Protected SQL run41435433435](https://github.com/chung6a8m/MyDmsVn/actions/runs/41435433435), job125243898555, attempt1, tag `web5-sql-candidate-20261102-272e1d2-2`: Security116 +Inventory19 +Migrations32 = **167/167 PASS**, zero failures/skips, every discovery/TRX summary complete.
- Sanitized artifact13136044638, ZIP SHA256 `c43cbfba5aeec2301b4ae53134739238d9f34348bd478cd887a56379a68d24cf`, independently matched GitHub's digest. Control/test SHA equals final backend HEAD. Lifecycle `Removed`, ownership verified, zero user databases/active owners, `quarantine=false`.
- Hosted Windows image20261026.347.1, SQL15.0.4382.1 Express64-bit, compatibility140. [PR SQL-free run41435403449](https://github.com/chung6a8m/MyDmsVn/actions/runs/41435403449) and [push run41435396862](https://github.com/chung6a8m/MyDmsVn/actions/runs/41435396862) each passed548 HTTP +69 validators with zero failures/skips; sanitized count artifacts were checked separately.

This backend proof is not counted again as frontend tests. Backend evidence owns migration/grants/process-death/SQL cleanup. No raw hosted SQL logs, credentials or connection strings were downloaded into this evidence.

## Retained failures and corrections

These test-development attempts are preserved, not replaced by their final green results. Browser fixture/readiness corrections did not introduce runtime workarounds. The separately reviewed F02 current-operation grant defect and fix are described above; its new native regression cases passed on their first execution.

| Attempt | Actual result | Correction |
| --- | --- | --- |
| Initial typecheck | Nullable-note and feature-literal diagnostics | Corrected test types before browser execution |
| First Chromium core11 +existing17 | 28 executed:19 PASS /9 FAIL | Six tests used the old checking accessible name; three queried document roles while Base UI correctly made them inert behind its modal. Used the checking name and Escape before background action assertions |
| New v1 boundary11 | 9 PASS /2 FAIL | CAS losers correctly published conflict/cached-proof feedback, not the outer generic failure. Asserted that branch and explicitly exercised losing local retry |
| Expanded v1 boundary13 | 11 PASS /2 FAIL | Conflict admission intentionally rejects before operation reread. Asserted the exact protected local-retry message; no weakening of CAS/raw/dispatch assertions |
| Focused corrected CAS subset | 2/2 PASS | Followed by both complete51-case affected Chromium/Edge PASS runs |
| First v2 boundary17 | 15 PASS /2 FAIL | Capability refresh intentionally publishes denied grants, invalidating earlier negative authority. Added explicit current NOT_EXECUTED recheck before fresh-baseline review |
| Corrected v2 baseline subset | 2/2 PASS | Followed by all17 Chromium PASS,45.9s |
| Shared F02 first full Chromium | 243 executed:242 PASS /1 FAIL | Lab import encountered a destroyed execution context during a second navigation. Added visible Lab-ready wait; focused11 repository cases PASS. Later evidence below identified workspace reload interference, not a product startup defect |
| First F03 focused Edge123 | 123 executed:121 PASS /2 FAIL | Receipt original-result fixture returned `null` while restored raw-note dispatch sent `""`; the keyboard case attempted modal reopen during close/focus restoration |
| Unchanged targeted Edge reproduction | 2 executed:1 PASS /1 Receipt FAIL | Reproduced the exact-note mismatch; keyboard transition race was established from its trace |
| Corrected Edge subset at `436b18a` | 2/2 PASS,9.9s | Test-only fixture echoes the exact sent note; keyboard test waits for modal removal/restored focus before reopening. Followed by the earlier436b18a 123/123 Edge PASS checkpoint |
| Shared F02 second full Chromium | 243 executed:241 PASS /2 FAIL | Each old Lab timeout trace showed ten Vite full-reload signals followed by a document GET mid-test. Triggering file was not identified; no product startup defect was established |
| Unchanged old Lab cases with files frozen | 2/2 PASS,8.3s | No further source/test change was needed for those cases. The earlier frozen436b18a 273-case F03 Chromium checkpoint then passed all cases; the current788ed56f 275-case run also passed the retained Lab cases |

No increased timeout, automatic test retry, required skip or ignored assertion converts these attempts to PASS. Explicit diagnostic/final reruns are recorded as separate attempts. All watched workspace writes were frozen during the final serial browser gates after the reload interference was identified. Explicit controlled 403/404/503/aborted-resource console messages use the existing `Failed to load resource:` exclusion; unexpected requests, fallback business writes and application page/console errors are still asserted. Raw traces/logs remain private outside Git.

## Keyboard and visual observations

Automated browser actions exercise real Enter/Tab while a check is pending, explicit Space/Tab/Enter Create consent, Escape dismissal and restored opener focus. These actions do not establish attended Telex/VNI or Narrator acceptance.

The initial51-case checkpoint's report records inspection of four Chromium/Edge images: Sales1280×720 Light and Receipt Post1440×900 Dark, with readable target dialogs, revoked identifiers absent and no target overlap/clipping. Root separately recorded actual inspection of two F02 terminal Edge captures (`web5-terminal-sales-create-msedge.png`, `web5-terminal-receipt-post-msedge.png`): Dark was stable without overlap; Light was a valid scrollable modal captured at a scrolled position. An earlier Dark opening-transition capture was corrected with disabled screenshot animations. These are bounded checkpoint observations, not a claim of final F03 visual review, physical scaling or accessibility acceptance. Screenshots use controlled fixture data and remain outside the repository.

## Completion limits

F03's bounded nonproduction technical gates are verified at 788ed56f: independent source review, own 1,397-unit/typecheck/build/artifact, full Chromium 275, focused Edge 125 and current-code paired actual-port integration. Earlier candidate counts remain attached to their executed source. Exact-head CI and merge disposition are recorded in the delivery PR before acceptance/merge; this file does not claim future hosted PASS or require a self-referential commit pin.

Same-key resend remains **DISABLED / NOT APPROVED**. UNKNOWN/404/timeout/expiry never prove rollback; no automatic mutation or new-key replay is authorized. B03 operator CLI/retention/backup rehearsal, positive support-case closure, F04/B05 full IIS, separately attended Telex/VNI/Narrator/scaling and F05/B06 production decisions remain NOT RUN / NOT APPROVED. Controlled HTTP, TestServer and synthetic composition do not replace those gates. Archived WEB1–04 and independent CEX remain unchanged.
