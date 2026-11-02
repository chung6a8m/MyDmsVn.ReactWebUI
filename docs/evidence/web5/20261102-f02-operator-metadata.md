# WEB5-02 / F02 — Read-only operator metadata fallback

**Date:** 2026-11-02 (Asia/Bangkok). **Read-only fallback: IMPLEMENTED / VERIFIED (bounded). Full terminal-resolution milestone: BLOCKED. Same-key resend: DISABLED / NOT APPROVED.** Owner selected WEB5-02; this record follows the explicit missing-backend fallback in the [owning plan §3](../../plans/20261102-001-web5-operational-safety-web.md#3-f02--terminal-resolution-ux-and-conditional-explicit-resend-web5-02). [Consumer design](../../design/WEB5_RECOVERY_AND_RELEASE_BOUNDARIES.md) · [acceptance](../../development/WEB5_WEB_ACCEPTANCE.md) · [Test Policy](../../TEST_POLICY.md). No backend work or production release is authorized by this fallback.

## 1. Source and prerequisite audit

| Item | Pin / finding |
| --- | --- |
| Frontend fresh base | `9759935319aaa287247a68e33fd9ab6a7793dc58` (`origin/main`, fetched before isolated worktree creation) |
| Runtime/unit candidate | `ff4288d81a002e5f63bc10d199a475799ecd0493` (`feat(recovery): add gated read-only operator metadata`) |
| Final native-test candidate | `8dba99484440f6bf224bf230fb7be5b26ddefdc7`: test-only reload synchronization; production source unchanged |
| Implementation branch | `codex/web5-f02-terminal-recovery-ux` |
| Backend merged main | `3aed45a5116f8d45ce7bfe061dc7f996b125a05b`, verified against `git ls-remote origin refs/heads/main` on 2026-11-02 |
| Existing accepted prerequisite | B01 process-crash proof and B04-A baseline; immutable source/runs and observed limits remain in [F01 closeout](20261102-web5-01-closeout.md) |
| Backend compatibility direction | [ADR0015 at exact merged source](https://github.com/chung6a8m/MyDmsVn/blob/3aed45a5116f8d45ce7bfe061dc7f996b125a05b/docs/adr/0015-web5-additive-recovery-boundary.md): additive WEB4 compatibility / future schema013 |
| Missing prerequisite | B02 executable resolution route/DTO/corpus/schema013/admission and B04-B exact-candidate SQL proof: NOT IMPLEMENTED / NOT RUN |
| Protected WEB4 corpus | 48 blobs, frontend `tests/fixtures/web4-v1/corpus` and backend `docs/contracts/web4-v1` tree both `fcab4a1e7505b150a132ce2899002930e9f2a6ee` |

Independent read-only audit inspected backend `OperationsController.cs`, `SqlWebOperationReadRepository.cs`, ADR0015 and B04-A evidence. Existing production routes are `/api/v1/operations/context` and `/api/v1/operations/{operationId}`. A v1 CANCELLED/unavailable/expired response cannot become a terminal-negative certificate. The illustrative resolution URL in the design is not an executable contract. This task does not invent it or modify the existing status decoder, mutation ports or frozen fixtures.

## 2. Selected implementation and safety boundary

The selected fallback adds sanitized read-only support metadata to the existing local draft/recovery dialog. Identifiers are lookup hints, never proof of SQL outcome or a confirmed support ticket. Corrupt/unsupported records expose only bounded unverified identifiers from admitted metadata; arbitrary stored payloads and local names are not support content. Current actor/epoch/generation and original Write/Post authority govern visibility and recovery; ordinary Read denial alone does not deny original status.

The existing runtime remains the single owner of known outcomes. A distinct local-only retry may persist an already-known original result/rejection after quota/abort, with the original ownership and IDB CAS checks; it must never fall through to HTTP. Manual protected status checking retains the existing v1 GET path. Terminal unlock and same-key resend controls remain disabled. No new certificate, local terminal state, ticket persistence/closure, archive, HTTP mutation or new-key retry is added.

Unknown, absent, expired and unavailable results remain protected. No version/result/SQL rollback is inferred. The scope preserves raw drafts, client line identity, exact wire values, original result differences and immutable frozen intent. Archived WEB1–04 evidence and backend CEX remain unchanged.

## 3. Verification record

Browser plugin is not available in this session; validation uses the repository's pinned Playwright runner as required by Test Policy. Flow under test: production route with controlled HTTP → lost write acknowledgement/restored UNKNOWN → recovery dialog metadata and explicit GET/local-only actions → protected state with zero resend. Native IndexedDB, real Dockview/AG Grid and Base UI modal are exercised; this is frontend verification, not SQL or full IIS acceptance.

Initial baseline: Windows, Node `22.14.0`, npm `11.6.0`; `npm.cmd ci` installed 419 packages from unchanged lockfile. npm reported 2 low/4 moderate audit findings; no dependency upgrade or audit fix was applied in this scoped task. Before edits, `npm.cmd run test:unit -- tests/unit/drafts/web4MutationRuntime.test.ts tests/unit/drafts/durableDraftWorkspace.test.ts tests/unit/drafts/productionDrafts.test.ts` passed **50/50** tests in 3 files.

### RED→GREEN and exact local candidate

Local unit/typecheck/build/full Chromium/artifact checks below ran on `ff4288d81a002e5f63bc10d199a475799ecd0493`; final focused Edge ran on `8dba99484440f6bf224bf230fb7be5b26ddefdc7`, which changes only the new reload test's synchronization. Production source and unit tests are identical across those commits. Initial RED assertions exposed: missing bounded metadata output (2), unfiltered foreign-actor quarantine (1), absent recovery controls (1), clipboard-unavailable TypeError/missing fallback (1), cached-proof UI still offering GET (1), revoked-record restore opening after async validation (1), and a snapshot-derived preview for a corrupt operation (1). Runtime API tests first failed because the new local-only/admission methods did not exist; they subsequently passed. These were intentional development failures, corrected before final verification. Final source omits unresolved snapshot previews, rechecks record-specific permission after async validation, gives a clipboard fallback and separates local-only versus GET actions.

The initial 72-case Edge run at `ff4288d` executed **71 passed / 1 failed / 0 skipped**: `reload without cached proof has GET but no local retry` reloaded while the controlled route was still evaluating IndexedDB. Trace showed reload at120060.762ms, route operation-read completion at120063.787ms and quota-enabling evaluation at120073.865ms, followed by destroyed-context failure. The opener is published at durable begin, so it was not proof that the cached result/quota failure existed. Commit `8dba994` waits for the enabled local-only retry, visible local-persistence failure and absent GET before reload, preserving exact one-write/zero-GET assertions before and after. The failing Edge case then passed1/1 and all new WEB5 Edge cases passed8/8; the final complete focused72 run below is the acceptance result. No timeout increase, arbitrary sleep, retry setting or production change masks this failure.

| Command / gate | Discovered / executed / passed | Failed / skipped | Result |
| --- | --- | --- | --- |
| `npm.cmd ci` | 419 packages from lockfile | — | PASS; Node22.14.0/npm11.6.0 |
| `npm.cmd run typecheck` | strict TypeScript | — | PASS, exit 0 |
| `npm.cmd run build` | production Vite artifact | — | PASS, exit 0 |
| `npm.cmd run test:unit` | 1,238 / 1,238 / 1,238 in 68 files | 0 / 0 | PASS |
| `npm.cmd run test:e2e -- tests/e2e/web5OperatorMetadata.spec.ts tests/e2e/web4RecoveryWorkspace.spec.ts --project=chromium --workers=2` | 25 / 25 / 25 | 0 / 0 | Focused PASS: 8 new WEB5 + 17 retained WEB4 cases |
| `npm.cmd run test:e2e -- --project=chromium --workers=2 --forbid-only` | 206 / 206 / 206 | 0 / 0 | Full Chromium PASS |
| `npm.cmd run test:e2e -- --config playwright.edge.config.ts tests/e2e/web5OperatorMetadata.spec.ts tests/e2e/web4RecoveryWorkspace.spec.ts tests/e2e/web4OperationRepository.spec.ts tests/e2e/durableDraftWorkspace.spec.ts tests/e2e/web4FailureBoundaries.spec.ts tests/e2e/draftRepository.spec.ts --workers=2 --forbid-only` | 72 / 72 / 72 in 6 files | 0 / 0 | Focused Edge PASS, not full Edge suite |
| `npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1 --forbid-only` | 1 / 1 / 1 | 0 / 0 | Artifact excludes fake runtime/Lab routes |

Runner: Windows NT10.0.26300.0; Playwright1.64.1; Chromium156.0.8078.4; Microsoft Edge156.0.4314.58. Vite test server owns `http://127.0.0.1:5173`; production preview owns port5174. Tests use isolated browser contexts/native IndexedDB and controlled HTTP; no backend host/database/SQL resource was created. Test servers exited after their suites. Existing NO_COLOR/FORCE_COLOR warning and Vite chunk-size advisory remain, with no functional failure. Intentional 503/404 resource-failure console entries are distinguished from unexpected requests/application errors, which the target flows assert absent.

Mutation counts are asserted rather than inferred: each lost-ack case observes exactly one initial write, with zero additional mutation on dialog, keyboard, reload or status check; unsupported/quarantined records issue zero writes/status reads. Cached-proof retry adds zero status GET and zero mutation; manual unavailable/expired checks add one status GET and preserve DISPATCHED/protected draft. Six original Create/Update/Post outcomes remain covered, including ordinary Read denial with original Write/Post, Sales Post version and Receipt Post without invented version. Existing repository/failure suites exercise CAS, quota, two-tab races, raw/line identity and actor/epoch fencing. These results do not prove B02 terminal certificates or real SQL.

### Rendered QA and artifact pins

Sales UNKNOWN at 1280×720 Light and Receipt Post UNKNOWN at 1440×900 Dark were rendered and visually inspected, using the app's actual theme control. Metadata, disabled reasons and action text are readable; the shorter modal scrolls within its viewport. Native Tab order, Escape→opener focus and Enter→reopen passed. Page identity/meaningful content, absent framework overlay, application console health and interaction state were verified through the native target flows. Screenshots contain fixture data only, no credentials or real business data, and remain outside Git in the runner TEMP directory: `web5-metadata-sales-create-{chromium,msedge}.png` and `web5-metadata-receipt-post-{chromium,msedge}.png`. This is not attended Narrator/IME, OS scaling or mobile acceptance.

Local artifact SHA256 at the code candidate: `dist/assets/index-CODFT342.js` = `B0DC694DCCB330D45FDB6804012B1F468CF483EC13CCF2BD1853BEF420550D52`; `dist/assets/index-io_KjKCp.css` = `1D481D99749429B6F18DAF87919F8C6839579839EC23AC28FA5ECE6980DF2A80`. A rebuild after final documentation updates passed and reproduced both hashes exactly. Frozen WEB4 tree, HTTP ports/decoder, dependency pins and generated UI are unchanged. Documentation-only delivery validates UTF-8 without BOM/LF, links/anchors and diff whitespace; final PR checks record the exact documentation head separately.

### Review and delivery

Independent implementation review of `9759935..ff4288d` found no actionable P0/P1/P2 and approved the bounded fallback. It checked original-grant admission, async restore/bind, metadata/copy scope, local-only no-HTTP behavior and unchanged contracts. One P3 observation is deferred: generic copy success/failure feedback may persist if the support component is reused for another document before unmount; this changes no copied payload, authority, settlement or HTTP action. A shared validation-cache race was investigated but not established as a concrete native failure; no false defect/PASS claim is made for untested schedules.

The owning plan requires a narrow PR to main. Its description/checks record the final head and hosted CI; local results above are bound to the unchanged implementation/test candidate, not assumed from earlier WEB4/F01 runs. No merge, production deployment or complete F02 acceptance is implied.

## 4. Acceptance disposition

| Gate | Disposition for this fallback |
| --- | --- |
| F5-RES-07 disabled default | PASS for disabled-control/no-resend behavior only; resend itself DISABLED / NOT APPROVED |
| F5-RES-11 operator/error/UNKNOWN metadata UX | PASS within the read-only fallback: unverified metadata, current-scope privacy, keyboard/focus and action distinction; attended screen reader remains NOT RUN |
| F5-RES-01/02/04/08/09/10 retained WEB4 behavior | Retained WEB4 regressions PASS on this candidate; B02-specific certificate/SQL requirements remain BLOCKED/NOT RUN |
| F5-RES-03/05/06 terminal negative | BLOCKED: no accepted B02 certificate/corpus or B04-B SQL proof |
| F5-RES-12 business-case closure | NOT RUN: B03 workflow is not delivered by this fallback; no local edit unlock |
| F5-RES-13 optional archival | NOT APPROVED / NOT IMPLEMENTED; separate Owner policy required |
| F5-COMP-01 runtime extension | BLOCKED pending accepted B02/B04-B; exact existing WEB4 contract retained |
| F5-COMP-03/04 and F5-RES-14 strict-only | NOT_APPLICABLE under additive ADR0015, not PASS or skipped mandatory tests |
| F03/F04/F05, real SQL bridge/full IIS, attended Telex/VNI/Narrator | NOT RUN by this task; no roadmap promotion or production decision |

The fallback can be delivered for review without claiming full F02 DONE. Reopening conditional terminal work requires the actual accepted backend route/DTO/corpus/migration and six-command/two-order B04-B proof. Resend additionally needs distinct Owner UI acceptance.
