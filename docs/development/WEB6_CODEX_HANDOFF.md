# Codex handoff — WEB6 frontend (manual same-key resend)

**Owner-selected new roadmap 2026-11-03; PLANNED / NOT RUN.** [Active plan](../plans/20261103-001-web6-recovery-quality-web.md) · [durable/UX design](../design/WEB6_MANUAL_RESEND_AND_RECOVERY_UX.md) · [frontend acceptance](WEB6_WEB_ACCEPTANCE.md) · [WEB5 archived evidence](../archive/20261103-web5-bounded-closeout/README.md) · [backend operator and SQL plan](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/plans/20261103-001-web6-recovery-quality-backend.md). Source is React/TS/Vite with Tailwind v4 and Nova/Base UI, AG Grid Community, Dockview and Floating UI; no Business Compact override. Backend remains net48, schema13 `web5` direct same-origin IIS Express for bounded tests.

## Execution map and exact source seams

**F01 — source audit/contract/UX:** inspect `src/app/runtime/web4MutationRuntime.ts`, `src/infrastructure/drafts/web4OperationRepository.ts`, `src/infrastructure/http/{web4OperationCodec,frozenWriteRequest,operationStatusPort,operationResolutionPort,httpTransport}.ts`, `src/app/workspace/RecoverySupport.tsx` and real current caller paths. Contrast WEB4 48-blob and WEB5 40-file corpora, current actor/epoch/capabilities, `DISPATCHED` vs `NOT_EXECUTED` vs `SETTLED`. Publish explicit original identity/eligibility/retention/missing-result matrix; keep flag OFF. Consume backend B01 policy and no unversioned drift.

**F02a — durable one-shot claim:** test-first API `claimManualResend`/`readManualResendClaim` (proposed names), compatible IDB schema. Atomically compare `drafts`+`operations` ownership, editRevision, operation local sequence, actor/epoch/fingerprint, no terminal/previous claim, then commit claim; only after transaction completion is a transport send eligible. Create two-tab simultaneous race, blocked-upgrade/quota/abort/crash/reload tests using native IndexedDB. A claim is consumed on ambiguous failure; never automatically reset or re-send.

**F02b — frozen resend port/runtime:** do not invoke `write()`, which creates new UUID. Reuse original validated `FrozenWeb4Operation` and existing `frozenWriteRequest` safety pattern through standard `HttpTransport` with exactly original `Idempotency-Key` and epoch, body and method. Recheck current original Write/Post grant (ordinary Read alone is not authority), live scope, candidate flag/host gate/retention, active tab and AbortSignal after async operations. Keep `checkResult` GET-only and `retryLocalResult` local-only; no 401/timeout/5xx automatic POST/PUT retransmission. Settle only via existing IDB CAS/decoded original result. Gate remains default OFF until B04 SQL proof and F03 complete.

**F03 — user confirmation and native browser:** wire currently disabled `Gửi lại đúng thao tác` button to a guarded modal that precisely explains it may execute the *original* business action once, no prechecked blanket consent. Keep `Mở khóa thao tác` disabled. Add keyboard/real browser, two-tab, stale grant, old host, terminal NTE, COMMITTED-result-unavailable, expiry, support correlation and all six operations tests. Cross-actor/epoch permission revoke and ordinary Read denied + original Write/Post granted should behave correctly. Regression: AG Grid lookup keyboard, Dockview close/reopen, raw buffers, browser refresh, all existing durable negative branches. Verify actual backend B04 SQL oracle separately, not only Playwright mock.

**F04 — paired acceptance:** consume backend B05 accepted source, actual published backend DLL + frontend dist from immutable pair (hashes), current schema13/role and HTTPS IIS Express owned-host queue admission. Verify actual Chromium/Edge, old cached client vs new host, new client vs old host, six original commands+manual, Sql journal/ledger/stock/valuation, nonproduction workload/error/timeout p50/p95/p99, backup service recovery/UNKNOWN aging and limiter/audit. No fake production/full IIS PASS.

**F05 — support/release handoff:** update user guide/support matrix, distinguish manual SAME-key (only with consent), true NTE NEW intent, original COMMITTED GET settlement, business-only support closure for unavailable result. Pair B06 exact hashes/targets/actual results and Owner decisions. Do not report a created ticket just from a correlation ID.

## PR policy

| PR | Contents | Minimum evidence |
|---|---|---|
| F01 `codex/web6-f01-resend-policy` | review docs/threat matrix/eligibility only | frozen corpus/diff checked |
| F02a `codex/web6-f02-durable-claim` | IDB schema/atomic claim only | raw state preserved; native real IDB/2-tab race |
| F02b `codex/web6-f02-frozen-transport` | standard transport original-only, runtime gate default OFF | six codec/failure/401/timeout cases |
| F03 `codex/web6-f03-manual-resend-ux` | modal/support states, native actual browser | real Chromium/Edge and backend B04 actual SQL |
| F04a `codex/web6-f04-paired-cutover` | published pair/compatibility | IIS Express ownership, SQL oracle, stale tab |
| F04b `codex/web6-f04-measured-quality` | workload/recovery/sink and metrics | source+artifacts, p50/95/99 and application RPO/RTO |
| F05 `codex/web6-f05-support-and-release` | docs/decision only | Owner target-vs-actual/no-go register |

Every PR must report exact source SHA/trees and binary/JS artifact as applicable, test command/selected category/discovered count, pass/fail/skipped/retries, actual vs mocked SQL, rediscovered bugs/failures, owned-resource cleanup and source review findings. No unrelated refactor/package/theme restyle. Keep UTF-8 no BOM/LF for React folders and existing formatter/editorconfig, locked npm, no credential in IDB or support export.

## Critical stop rules

- Never auto-send after timeout, reload, connectivity regain or 401; mutation fetch is at most once per durable approved human consent and SQL effect once per original key.
- Missing status/404 is **not NOT_EXECUTED**; persistent NTE uses new intent and reviewed baseline, never the original key; result expired/unavailable remains PROTECTED.
- If original immutable hash cannot be reconstructed from retained IDB, if a claim is already present, if 2-tab/IDB/CAS/current auth is uncertain, or if backend eligibility/retention cannot be trusted, disable action rather than infer safety.
- Do not accept F03 as finished before backend B04 real SQL race gates and current browser+SQL evidence. Full IIS/Narrator remain NOT RUN in local bounded scope; staging and production NO-GO until separate Owner approval.
- Treat Codex execution-policy blockers as `BLOCKED`; do not request extra administrator rights, delete WEB5 historical quarantined SQL or bind to foreign HTTP.sys listener. No Docker Desktop or new Windows VM prerequisite for F01–F03.

## Suggested Codex task instructions

For each selected PR: read this handoff, the owning design/acceptance and backend exact contract; inventory all current code/tests; author focused RED scenarios; implement minimal change; run selected GREEN and full relevant regression with actual discover/count guard; present candidate hash/cleanup/evidence; request review; address P0/P1/P2; merge only after Owner/test gates. **Do not execute F02–F05 merely because the roadmap documents merged.** Source-visible approval and an enabled feature are different decisions.
