# WEB4-05 / F04 — failure pilot evidence (2026-11-02)

**Status: DONE (bounded); Owner accepted; PR #21/backend #84 merged 2026-11-02.** Owner selected WEB4-05 and explicitly authorized B05 test fixture plus fresh nonproduction SQL/IIS Express pilot. [Owning plan](../../plans/20261101-002-web4-reliability-web.md) · [runbook](../../development/WEB4_PILOT_RUNBOOK.md). F05/B06, resend UI, full IIS and production are not selected.

## Source and environment

- Frontend baseline `b7d36c1813d94da2a6c6c68617d1c596136300d4`; pilot/regression source `e80062936269cc591113b4b0f39106ac51b3c499`, final lost-response synchronization `79c7e5a6117029dbc8e6968976b71fda103c88a3`, [PR #21](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/21). No production runtime/dependency/theme changes.
- Backend baseline `ca26a6c91bbbfe21807b9519bd2c4a7974f0e3d9`; final B05 fixture source `4d3c75e3ec5c0cb2f165418137d800e5ae5c0762`, [PR #84](https://github.com/chung6a8m/MyDmsVn/pull/84). Earlier checkpoints below are development results only.
- B01 corpus remains `1c603c6ac57e59a3f7b4bc6ca976b2d531c079aa`; B04 runtime remains `bd871518fd162927d938babd5535a2ddf91c2ad5`, merged through backend PR #83. No canonical fixture bytes changed.
- Windows10.0.26300.0; Node22.14.0, npm11.6.0, Playwright1.64.1; Chromium156.0.8078.4/revision1248, Edge156.0.4314.58; .NET Framework4.8.10008, SDK8.0.427, IIS Express10.0.26013.1000. Owned SQL probe captured14.0.2140.2 / RTM / Developer Edition(64-bit), without server address/credentials. No Browser plugin; repository Playwright used.
- Production JS `index-BJ1J40gf.js` SHA256 `7293AE7AD17A1B21F860ABC849993ABA81DD04EF383CF482DAA99293C8C39FB6`; CSS `index-B31yTrPj.css` SHA256 `1CA4F8307032398D70ECD50FBBAE1D104F3D30FBF6CD87B767560D1B1BE802A0`. All9 published assets match the final local build byte-for-byte.

## Executed frontend checks

| Command | Executed result | Boundary |
|---|---|---|
| `npm.cmd ci` | PASS,419 installed; audit2 low/4 moderate reported, no dependency changes | Locked install |
| `npm.cmd run typecheck` | PASS | Strict TS including pilot helpers |
| `npm.cmd run build` | PASS; existing >500kB chunk warning | Production assets |
| `npm.cmd run test:unit` | 1,218/1,218 PASS,66 files,0 skip | Full unit/component |
| `npm.cmd run test:e2e -- tests/e2e/web4FailureBoundaries.spec.ts --project=chromium --workers=1` | 3/3 PASS | New native-browser/controlled HTTP regressions |
| `npm.cmd run test:e2e -- --project=chromium --workers=2 --forbid-only` | 196/196 PASS,4.3m,0 skip | Full frontend browser regression |
| `npm.cmd run test:e2e -- --config playwright.edge.config.ts tests/e2e/web4FailureBoundaries.spec.ts tests/e2e/web4RecoveryWorkspace.spec.ts tests/e2e/web4OperationRepository.spec.ts tests/e2e/durableDraftWorkspace.spec.ts tests/e2e/draftRepository.spec.ts --workers=2 --forbid-only` | 62/62 PASS,1.8m,0 skip | Focused native Edge |
| `npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1 --forbid-only` | 1/1 PASS | No Lab/fake production leakage |

Local logs/TRX/screenshots remain outside Git or ignored test-results; no secret-bearing manifest/trace/HAR committed. Full Chromium and Edge above use controlled HTTP and native IndexedDB, not SQL. Pilot-only source refinements followed those runs; typecheck/build were rerun, unchanged e2e specs were not repeated without cause.

## Development failures and review

1. New secret-free Inventory regression initially2 PASS/1 FAIL: fixture omitted `/lookup` and hid a stock panel. Corrected matching stock filters and kept both real Dockview panels visible; focused3/3 and full196/196 passed. No product bug/fix.
2. First real Chromium development invocation:9/10 browser PASS; one valuation test failed on ambiguous `role=region` matching both Dockview group and document. Changed test selector to the document `section` and await detail readiness. Wrapper0 PASS/1 FAIL; cleanup returned without secondary error. This was before final concurrency/gift/race additions and final oracle strengthening, not final acceptance.
3. Backend overlapping rebuild hit locked testhost DLL (`MSB3027/MSB3021`);0 tests executed. After the pilot drained, rebuild and56/56 SQL-free fixture validators passed. Only one coordinator now executes SQL/host/build owners.
4. Independent review found unsanitized credential-bearing Playwright exceptions and missing live same-key concurrency/cross-tab/duplicate-gift proof. Sanitized login/fetch failures and boolean secret guard; added explicit same-key Create pair/conflict, real two-workspace Save race, duplicate paid/gift full depletion. Scoped re-review: no remaining P1/P2; actual final live results are recorded below.
5. Second development pilot10/11 browser PASS: one shared fixture actor exceeded the unchanged10-login/5-minute limiter before valuation. Assigned the independent quota/security cases to the existing `alice` fixture account and assert login HTTP status; did not change limiter or retry authentication.
6. Third development pilot11/11 browser PASS(50.1s), wrapper FAIL: actual SQL `DBNull` projected through Newtonsoft implicit string conversion produced a String-null token. A regression through the real record mapper reproduced RED; explicit JSON Null fixed this while preserving exact comparison. All six command projections plus existing fixture validators62/62 PASS.
7. Fourth development pilot11/11 browser PASS(47.7s), wrapper FAIL: SQL Server rejected reserved `LineNo` alias in the new valuation oracle. Bracketed qualified identifiers and alias; no assertion/value formula changed. Rebuilt source `4d3c75e`,62/62 pure PASS. Final fresh paired runs below must pass the complete oracle, not just browser rows.

## Live and hosted verification

The first complete Chromium run at `e800629`/`4d3c75e` passed **11/11 browser cases in 50.4s and 1/1 .NET wrapper in 1m14s**, including independent SQL oracle and cleanup. Edge then executed **2 passed, 1 failed, 8 not run**: `loseCreate` returned when the toolbar appeared after durable persistence, before the intercepted response finished. Reload destroyed the `readStore` callback context. The correction at `79c7e5a` reads the operation before dispatch and waits for the actual `outcome-unknown` UI. Independent source review confirmed this is a real response-completion boundary, with no weakened assertions; typecheck passed. Final paired verification is recorded below.

| Browser scenario | Evidence boundary |
|---|---|
| Six commands: missing/wrong epoch headers | Real HTTPS rejection for all six mutation routes and protected status |
| Absent status / revoked Write | Real 404/403 leaves UNKNOWN locked, one attempted send |
| Mismatched COMMITTED / corrupt fingerprint | Deliberate negative response/native storage injection, no settle/unlock |
| Quota/schema/composition | Native IndexedDB fault injection, raw draft preserved, no write; synthetic composition only |
| Logout/new actor | Raw draft and operation isolation through the shipped UI |
| CSP/Origin/refresh | Actual production headers/cookie, refresh and cross-origin rejection |
| Two workspaces Save race | Real shared actor/draft, one durable intent/write, losing raw buffer retained |
| Changed database epoch/layout | Actual fixture epoch rotation, v3 and legacy layouts, stale-tab write/status rejection |
| Sales lost Create/Update/Post ack | Actual HTTP200 then dropped acknowledgement, reload/explicit status, original identity/version, Write without Read |
| Receipt lost Create/Update/Post ack | Same six-command boundary, Receipt Post ack has no invented version |
| Cross-module valuation/Inventory | Weighted average, backdated receipt, frozen COGS, separate warehouse, duplicate paid/gift full depletion, explicit same-key concurrency/conflict; adjacent dirty Sales retained |

Final paired run at frontend `79c7e5a` / backend fixture `4d3c75e`, same published assets:

| Separate fresh owned database | Browser | .NET wrapper | Independent oracle / cleanup |
|---|---|---|---|
| Chromium | **11/11 PASS**, 50.6s, 0 skip | **1/1 PASS**, 1m14s | PASS / PASS |
| Edge | **11/11 PASS**, 1.1m, 0 skip | **1/1 PASS**, 1m29s | PASS / PASS |

Actual TRX: backend `TestResults/web4-f04-chromium-complete/web4-chromium-complete.trx` and `TestResults/web4-f04-edge-complete/web4-edge-complete.trx`. Wrapper output: local TEMP `web4-f04-live-chromium-complete.log` / `web4-f04-live-edge-complete.log`; owned run directories `iis-ec296dda6f5244d3a13d029a0845de02` / `iis-564f50728b4647dc9fafddfe3597c41d`. Each captured all **12 completion IDs (not 12 tests), 22 unique operations and 8 posted documents**. The backend independently compared the complete physical journal/source/Posted union, actors and fingerprints, one-to-one source/ledger/value correspondence, and recomputed quantity/value/moving average/COGS. Cleanup completed without exception and removed private manifest/public CA files; database/runtime login and host cleanup are fixture-owned assertions. A browser result alone is not the SQL oracle.

Screenshots of recovered Sales/Receipt and split Inventory/dirty Sales were inspected outside Git (`web4-live-sales-chromium.png`, `web4-live-goods-receipt-chromium.png`, `web4-live-valuation-chromium.png`, plus corresponding Edge captures). They support observable UI only. Independent reviews found no remaining actionable P1/P2 after the corrections above; the final synchronization was separately reviewed against the actual command state transition.

Hosted frontend checkpoint [run 41372380722](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/41372380722) passed typecheck/build, **1,218 unit, 196 Chromium and 1 production-isolation tests**. Checkout was PR synthetic merge `b580892` of `e800629` into `b7d36c1`, not the later synchronization commit. Hosted backend [run 41372747630](https://github.com/chung6a8m/MyDmsVn/actions/runs/41372747630) passed **506 HttpHost + 62 pure fixture tests**, 0 skipped, at synthetic merge `c548a950a2667778222ff6021c8d3d99eb0b962a` of `be93fc0` into `ca26a6c`. These CI jobs have no live SQL/credentials; final-head checks remain separate.

Focused backend Security SQL gates also passed **86/86**, 0 skipped (journal 22, protected read 24, operations HTTP 17, auth 7, principal provisioning 16), Inventory `WebOperationCommandTests` passed **7/7**, and migration `WebAuthMigrationTests` passed **17/17**, all 0 skipped: **110 distinct SQL rows**. Actual migration TRX: backend `TestResults/web4-b05-migrations-final/web4-b05-migrations-final.trx`. Commands, migration confirmation and backend CI are owned by the [B05 evidence in PR #84](https://github.com/chung6a8m/MyDmsVn/pull/84); these rows are separate from the two browser wrapper rows. Final-head CI is checked separately on each PR after documentation publication.

## Retained limits

Same-key resend remains disabled. Real OS process-crash/Commit proof and product user-confirmed resend are NOT RUN; test-client same-key concurrency and aborted acknowledgement are narrower. Synthetic composition is not attended Telex/VNI/Narrator. Full IIS/production and F05/B06 handoff/roadmap closeout remain NOT RUN/unselected. Archived WEB1–03 evidence is unchanged; Owner acceptance and merge are recorded explicitly below.

## Owner acceptance and merge — 2026-11-02

Owner requested review, fixes if needed, merge after CI PASS and completion of WEB4-05 within the recorded bounds. Fresh independent frontend and backend reviews found no actionable P0/P1/P2; no executable change was needed. GitHub had no unresolved review threads.

- Frontend reviewed head `9d9fd84aad5143b03012f8fd82f4c2b23a8cdbef`: [CI run 41373656805](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/41373656805) PASS, typecheck/build, 1,218 unit/component, 196 Chromium and 1 production isolation test. Actual PR checkout `10225bb7e5c87f7de4d7024101b62977dc3ccab7`.
- Backend reviewed head `1d5ce74f0babf687423a3912af40a6fa713a690e`: [CI run 41373962644](https://github.com/chung6a8m/MyDmsVn/actions/runs/41373962644) PASS, 506 HttpHost and 62 SQL-free fixture tests, no failures/skips; actual PR checkout `f0d9de7a24a58e7f303d60e833aa7fda98114b68`.
- Backend [PR #84](https://github.com/chung6a8m/MyDmsVn/pull/84) merged first at `9ef084a61c1dd0e9f59be049fb5fbb51870e9444`; frontend [PR #21](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/21) then merged at `f7765f052a66242e978a38daa4c22221ea262411`. Merge trees match their reviewed CI-passing heads.

**WEB4-05/F04+B05 is DONE (bounded).** The earlier live pilot and 110 focused SQL rows remain the executed integration evidence; this closeout changes Markdown only. Documentation checks cover local links, UTF-8/LF, status consistency and diff; no new browser/SQL run is claimed for the closeout. Roadmap 04 remains active with F05/B06 PLANNED. Same-key resend, process-crash/Commit, attended IME/Narrator and full IIS/production retain the limits above.
