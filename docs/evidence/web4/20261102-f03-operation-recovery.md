# WEB4-04 / F03 — Durable operation intents and protected recovery

Date: 2026-11-02, Asia/Bangkok. **DONE (bounded); Owner accepted and both PRs merged 2026-11-02.** Earlier candidate verification below is preserved; the final disposition is recorded at the end. WEB4-04 selects F02 + F03. This is not frontend F04 or the B05 live pilot. [Owning plan](../../plans/20261101-002-web4-reliability-web.md) · [design](../../design/WEB4_DURABLE_DRAFT_AND_RECOVERY.md) · [execution checklist](../../development/WEB4_F03_IMPLEMENTATION_CHECKLIST.md).

## Source and dependencies

- Web baseline `68398accdd03a1ed78a2e3bec7c5cb2499457b6d`; F02 source `825711b52d4e1e06f68dfea2989f783085171d2c`, documented at `a4b37a70ad3da29706560f93190fc1c6bdd02610`.
- F03 core runtime/test source **`3a34fd986fce53950c8658ab0f68a946d21b4dd7`**, final operator-preview UI source **`e44b1bb025fe03c5acb2f75ccff47bf3686ec62c`**. Developed on `codex/web4-f03-operation-recovery` stacked on F02; the final WEB4-04 candidate is delivered together through [frontend draft PR #20](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/20). F02's original evidence remains its earlier bounded checkpoint.
- Owner explicitly instructed implementing missing B04 first. Backend runtime pin `bd871518fd162927d938babd5535a2ddf91c2ad5`; test-only port bridge / rejection oracle `55c6d04d54d3ec08be8f236427350fffdea9dcbf`; evidence head `b225bee1370abac77d4e852302ca45572cd8d3be`, [backend draft PR #83](https://github.com/chung6a8m/MyDmsVn/pull/83). Its [evidence](https://github.com/chung6a8m/MyDmsVn/blob/b225bee1370abac77d4e852302ca45572cd8d3be/docs/evidence/web4/20261102-b04-http-operations.md) owns SQL/runtime results.
- B01 remains `1c603c6ac57e59a3f7b4bc6ca976b2d531c079aa`, manifest SHA256 `0acab190e7fe126d53c13c0510a1958365e5a6e1fda78a4321da78297e0b3f1a`. The 48 mirrored corpus blobs, package locks, business valuation and archived WEB1–03 evidence are unchanged.

## Implemented boundary

Production Save/Post enters the durable coordinator after the feature barrier. It freezes the six B01 requests, generates one GUIDv4, atomically writes the immutable operation and matching draft checkpoint, waits for transaction completion, rechecks scope/identity/revision/grant, then dispatches once with the original key and authenticated epoch. There is no unkeyed or memory-only production write fallback.

Positive original response or explicit protected status is strictly decoded and bound to the frozen request's rederived SHA256, operation identity, method, route, target and epoch. Local settlement completes before applying the original document/line IDs/version or command-specific Post acknowledgement to the feature store. Sales Post preserves its version; Receipt Post never invents one. Inventory observes only the resulting positive Posted transition. Public document Get does not settle a protected operation or run automatically after Post.

Lost acknowledgement, storage failure after dispatch, invalid/missing intent, absent/denied/expired/mismatched status and late actor/epoch/generation/revision remain locked. Reload requires explicit local preview/restore and an explicit “Kiểm tra kết quả” action; it sends GET only. The dialog shows module, operation ID, database epoch and sanitized support correlation. Storage retry with a cached result repeats only the local transaction, not HTTP. Same-key resend UI remains disabled under the outstanding real-process-crash gate.

A strict first direct business rejection may atomically become local REJECTED only for the fresh unique dispatch admitted by this coordinator. The allowlist is pinned ValidationError400 for all commands and module-specific NotFound404 / ConcurrencyConflict409 / AlreadyPosted409 for Update/Post. Auth/idempotency/deployment/generic failures and negative status never qualify. Rejection preserves exact draft/raw/client identity; conflict/not-found/already-posted requires an explicit authorized server review before further writing, including after restore. A new key is created only for a subsequent explicit user intent.

Generic draft writes/deletes cannot bypass an unresolved operation by tampering with the draft marker. Safe admitted deletion rehashes matching terminal records, then atomically compares their exact keys/bytes and draft CAS before removing both draft and terminal payloads. Corrupt/unknown/changed/foreign records remain untouched. Failed cleanup is reported without retaining authentication.

## Verification and corrections

Windows 10.0.26300.0; Node 22.14.0, npm 11.6.0, TypeScript 5.9.3, React 19.3.1, Vite 8.3.5, Vitest 5.0.5, Playwright 1.64.1. Actual browsers: Chromium 156.0.8078.4 and Microsoft Edge 156.0.4314.58. Browser plugin was unavailable; the pinned repository Playwright projects own and close Vite. No repository edits occurred while those suites ran.

Development failures were retained as evidence, not counted as PASS:

- Nine rejection/coordinator tests first failed against the incomplete positive-only service, then passed after the first-dispatch rejection path and local retry were wired.
- Independent queue review found atomic-lease gaps in discard/release; the lease now blocks those paths and checks the completed checkpoint/signature/sequence. Focused queue tests passed.
- F02 hosted run [41361514892](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/41361514892) passed typecheck/build/982 units but failed browser regression: 116 passed, 41 failed. Legacy HTTP fixtures omitted mandatory context; their mutation/recovery expectations needed the pinned WEB4 behavior. The three Lab layout failures were a real optional-scope-shape bug: explicit `deploymentEpoch: undefined` reached the frozen v1 decoder. One new RED unit reproduced it; migration now supplies the actor-only shape only in the epoch-less Lab path. Production still rejects v1/v2 import. No assertions were skipped to obtain a green run.
- First F03 UI run: 13 passed, one failed because a test selected the first UUID-sorted operation after a second rejected intent. It now selects the actual request key.
- First complete local Chromium run: 187 passed, two failed. Actor invalidation now clears old private RAM, so its regression asserts successful reload, no stale beforeunload prompt and no other-actor preview. Added controls reduced available vertical space: the Inventory grid minimum was reduced to preserve a visible, hit-testable pagination control at 1280×720; the existing strict DOM assertion stays.
- Final local full run executed 192 cases: 191 PASS and one new cleanup fixture failure (passing a full draft where an exact namespace was required). The corrected namespace fixture passed its focused Chromium rerun; production source was unchanged. Hosted run 41364739776 then passed all 192 at the same core source. The later operator-preview correction adds one case, bringing final discovery to 193.
- Final review found terminal operation payloads surviving draft cleanup. A native RED test demonstrated the retained REJECTED payload. The rehash + exact-record-set + two-store CAS deletion above fixes it; native cases also exercise corrupted fingerprint, a change during asynchronous hashing, transaction abort and honest logout retry.

- Final UI review found that corrupt intent correctly prevented restore but hid the recorded operator ID/epoch from the preview. A focused RED browser case reproduced the missing ID. The small preview correction retains this unverified metadata without opening the document or sending HTTP; all 15 recovery UI cases then passed on both Chromium and Edge.

Final commands from the Web root:

```powershell
npm.cmd run test:unit
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:e2e -- --project=chromium --workers=2 --max-failures=3 --forbid-only
npm.cmd run test:e2e -- --config playwright.edge.config.ts tests/e2e/web4OperationRepository.spec.ts tests/e2e/draftRepository.spec.ts tests/e2e/web4RecoveryWorkspace.spec.ts tests/e2e/durableDraftWorkspace.spec.ts tests/e2e/web2-http.spec.ts tests/e2e/web3-receipt.spec.ts tests/e2e/web3-inventory.spec.ts --workers=2 --max-failures=3 --forbid-only
npm.cmd run test:e2e -- --project=chromium tests/e2e/web4RecoveryWorkspace.spec.ts --workers=2 --forbid-only
npm.cmd run test:e2e -- --config playwright.edge.config.ts tests/e2e/web4RecoveryWorkspace.spec.ts --workers=2 --forbid-only
npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1 --forbid-only
```

| Verification | PASS / executed | Failed / skipped |
|---|---:|---:|
| Unit/component, 66 files | 1218 / 1218 | 0 / 0 |
| Full local Chromium | 191 / 192 | 1 fixture failure / 0 |
| Focused Chromium after correcting that fixture | 1 / 1 | 0 / 0 |
| Focused Edge at core source | 96 / 96 | 0 / 0 |
| Hosted full Chromium at core source | 192 / 192 | 0 / 0 |
| Final operator-preview UI, Chromium | 15 / 15 | 0 / 0 |
| Final operator-preview UI, Edge | 15 / 15 | 0 / 0 |
| Production artifact isolation, final UI build | 1 / 1 | 0 / 0 |

Native storage cases (21 operation + 13 draft) are included in the full/focused core browser totals, not added again. Final F03 production-components/native-IDB UI has 15 cases per browser: six reload recoveries without Read, five negative/status-identity cases, post-response quota/local-only retry, two fresh rejection/new-explicit-intent cases and corrupt-intent operator preview. The final Edge UI run repeats 14 of the core 96 cases and adds one: 97 unique cases across the runs, not 111. The existing HTTP browser regression additionally checks dirty adjacent Sales, Inventory invalidation, explicit Get403 after Posted, keyboard/raw/lookup/close, actor/refresh and version/client-line identity. Browser HTTP is controlled fixture data; it is not the live SQL pilot. Build has the existing large-chunk warning; typecheck and build succeed.

Screenshots of recovery, UNKNOWN operator guidance and Inventory light/dark/split views were inspected at 1280×720 and 1440×900. Controls remain readable and actionable; these automated captures do not claim attended Telex/VNI/Narrator. Raw logs, screenshots and controlled traces stay local; none contains live credentials.

## Actual frontend port / backend TestServer integration

The new `vitest.web4.integration.config.ts` selects one opt-in Vitest lifecycle case, driven by the backend-owned net48 test fixture through a current-user ACL named pipe. Production TypeScript auth/transport/frozen ports/status codecs send actual bytes/headers through OWIN routing, real SQL sessions/handlers/journal and restricted runtime permissions. It is excluded from the default secret-free unit/CI selectors.

At core frontend source `3a34fd9` (the later UI-only change does not touch these ports), Release/net48 selector `FullyQualifiedName~WebOperationHttpSqlTests.Frontend_ports_recover_six_commands_through_actual_TestServer` passed: **one .NET wrapper and one Vitest case**, zero failed/skipped, 20.627 seconds. TRX `TestResults/web4-frontend-ports-final/web4-frontend-ports-final.trx`. Six unique commands each have an initial dispatched response suppressed at the frontend fetch boundary, explicit status readback and a deliberate same-key replay in the test. It asserts no retry before that explicit action, two actual detail 403 denials and a TestServer/service-provider restart. This test replay does not enable the product UI.

Independent SQL oracle: six committed journal rows, one posted Sale and Receipt, four Sale lines, two Receipt lines, six ledger and six valuation entries; product quantity 14 / value 210, other product quantity 3 / value 7.5, Sale amount 85 / COGS 92.5 / profit −7.5 and gift amount 0. Workers/child process drained before owned teardown; a separate master query verified zero generated test databases remain. Tokens/connection strings/passwords are never persisted or printed.

The backend separately passed eight bridge protocol cases and one SQL case with 18 first-dispatch business rejections and unchanged source/stock/journal/sequence state. Those are separate .NET rows, not additional browser/Vitest cases. Backend hosted Windows CI is PASS at `b225bee1370abac77d4e852302ca45572cd8d3be`: [run41363414852](https://github.com/chung6a8m/MyDmsVn/actions/runs/41363414852).

## Review, CI and limits

Independent review of the coordinator, ports, feature application, queue and UI has no remaining P1/P2 after the recorded corrections; terminal purge was additionally reviewed by the parent. Diff, UTF-8-no-BOM/LF, current documentation links and unchanged corpus/lock/archive boundaries were checked.

Frontend hosted CI **PASS** on core source `3a34fd986fce53950c8658ab0f68a946d21b4dd7`: [run 41364739776](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/41364739776), job 125022394185. Logs confirm 66 files / 1,218 unit/component, 192 Chromium (7.7 minutes) and 1 production-artifact case, with typecheck/build successful. Final operator-preview source `e44b1bb` has the separate 15/15 local Chromium and Edge checks above plus a fresh production build/artifact check. Subsequent combined-candidate HEAD checks are reported on [PR #20](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/20); this record pins the actual run rather than assigning its PASS to an untested commit.

B05/F04 live production React + IIS Express HTTPS + SQL + Chromium/Edge, real OS process death/socket loss at Commit, attended IME/Narrator, full IIS and production activation are **NOT RUN / NOT APPROVED**. TestServer/provider restart and a suppressed observed response are narrower evidence. Same-key resend remains gated; no operator unlock/delete-to-retry, TTL deletion of unknowns, merge or deployment is performed. F04/F05 remain PLANNED pending selection. This candidate completes the requested implementation scope, not Owner acceptance of the roadmap.

## Owner acceptance and merge — 2026-11-02

Owner instructed: “Review, fix findings nếu có, merge các PR và hoàn thành WEB4-04”. Independent read-only frontend and backend reviewers evaluated the complete PR ranges against the owning F02/F03 and B04 plans. Neither found an actionable P0/P1/P2 or required a runtime change. The minor findings were stale frontend test-policy wording (“no execution yet” and unconditional resend) and stale backend CI selectors; the documentation closeout corrects them while retaining the same-key resend safety gate.

Immediately before merge, both PR heads and base branches were rechecked, both worktrees were clean, canonical corpora/dependencies remained unchanged and the exact-head hosted jobs were confirmed successful:

- Frontend head `f61d1da80c4929abee23f600fd5780d25ff5b861`: [CI 41365960004](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/41365960004), 66 files / 1,218 unit/component, 193 Chromium, 1 production-artifact case, typecheck/build PASS; zero failed/skipped.
- Backend head `b225bee1370abac77d4e852302ca45572cd8d3be`: [Windows CI 41363414852](https://github.com/chung6a8m/MyDmsVn/actions/runs/41363414852), locked restore/build/nonempty complete HttpHost execution PASS. Prior local SQL/Edge/actual-port results remain tied to the source pins above; this read-only review did not rerun them.
- Backend [PR #83](https://github.com/chung6a8m/MyDmsVn/pull/83) merged first at `59ca21d16f7839c6d7c553395a367e465591652b`, then frontend [PR #20](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/20) at `604c02e3cd1e959fd976fb80d194371c9ceec42b`. Both merges used expected-head SHA checks. Git tree comparisons confirmed each merge contains exactly its reviewed candidate tree.

**WEB4-04/F02+F03 and prerequisite B04 are accepted as DONE (bounded).** The closeout edits only current selectors, policy clarification and task evidence, with diff/link/encoding checks; no new SQL, browser or runtime PASS is inferred from Markdown. The full Roadmap 04 is not closed: F04+B05 live React/IIS Express HTTPS/SQL/browser acceptance, real process-crash/Commit evidence, F05+B06 operator handoff, attended IME/Narrator and full IIS/production remain outside this acceptance. Same-key resend remains disabled, UNKNOWN cannot be discarded to retry, and no deployment occurred.
