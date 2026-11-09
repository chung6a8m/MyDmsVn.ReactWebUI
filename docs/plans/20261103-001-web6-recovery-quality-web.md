# Roadmap 06 — Recovery Completion & Production-like Quality (ReactWebUI)

**Owner selection: 2026-11-03. Execution state: SELECTED / PLANNED / DOCS ONLY.** Owner approved the **development** of explicit human-confirmed manual same-key resend while forbidding automatic HTTP mutation retry; completion of backend operator CLI/recovery (WEB5 B03) and a verified paired frontend/backend candidate under bounded IIS Express/SQL is part of this new workstream. **No production release, resend UI enable or blanket operator execution is approved by this docs-only plan.**

**Starting frontend main:** `a46acb1357d52f2a0551f7676592fc2cb8be50bd` (WEB5 archive PR #31); **paired backend main:** `3d4d79c595262569195c69d099a9124a24466b38` (PR #97). [Archived WEB5 frontend](../archive/20261103-web5-bounded-closeout/README.md) · [WEB5 final status](../evidence/web5/20261103-web5-roadmap-closeout.md) · [backend WEB6 roadmap](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/plans/20261103-001-web6-recovery-quality-backend.md).

**Technical references:** [WEB6 frontend state/UX design](../design/WEB6_MANUAL_RESEND_AND_RECOVERY_UX.md), [acceptance matrix](../development/WEB6_WEB_ACCEPTANCE.md), [Codex handoff](../development/WEB6_CODEX_HANDOFF.md), [evidence index](../evidence/web6/README.md), [WEB5 recovery design](../design/WEB5_RECOVERY_AND_RELEASE_BOUNDARIES.md), [WEB4 original recovery](../design/WEB4_DURABLE_DRAFT_AND_RECOVERY.md), [backend WEB6 operator protocol](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB6_RECOVERY_OPERATION_PROTOCOL.md). Historical WEB1–05 evidence remains immutable. Backend CEX-A01–A05 is separately ACTIVE and unchanged.

## 0. Invariants and scope

1. Only one optional **manual same-key resend** per explicit consent, per original `DISPATCHED/UNKNOWN` immutable intent, never an automatic mutation retry. Keep original GUIDv4/idempotency key, HTTP method, route/target, request body, fingerprint, expectedVersion and original actor/epoch. The request **may commit original business work once** if no original Commit occurred; make this risk explicit.
2. Existing backend `SqlWebOperationJournal` fences by actor/key/epoch and can replay original COMMITTED result or reject unavailable/terminal entry. This is an architectural prerequisite, **not** proof of the new browser flow. Backend WEB6 B04 must independently prove all six command races/negative/original-first and return/retention eligibility before frontend pilot enable.
3. Preserve strict `web4-v1` original frozen 48-blob corpus and the additive `web5-resolution-v1` 40-file corpus, explicit schema13/`web5`, old web4 exact12 compatibility and all six Sales/Receipt Create/Update/Post semantics. Do not mutate existing request schemas, code hashes or SQL mode flags just to enable UI.
4. Existing `src/app/runtime/web4MutationRuntime.ts`, `src/infrastructure/drafts/web4OperationRepository.ts`, `src/infrastructure/http/frozenWriteRequest.ts` and `src/app/workspace/RecoverySupport.tsx` are the source integration seams. New `manualResend` dispatch must use **original persisted frozen bytes**, not current draft, user-retyped inputs or new UUID. No direct bypass of auth/permissions/status scopes.
5. Respect actorKey, server deployment epoch, permission for original operation kind (Create/Update Write, Post Post), generation, document identity/editRevision, negative lineage, per-document IndexedDB CAS, raw buffers/lookup/clientLineIds and out-of-order async cancellation. Ordinary Read denied while original Write/Post allowed **still permits authorized protected status**, but new document editing baseline may separately require Read.
6. No auto retry: on timeout, 401/refresh, HTTP 5xx, reload, offline-to-online, ServiceWorker, React effect, navigation, double click, retry button, TanStack Query or timer. Bounded **GET status** retry/read-only recovery is allowed; `retryLocalResult` currently means **local IndexedDB result storage** and must remain non-HTTP-mutation.
7. Valid `NOT_EXECUTED` negative only releases its original lock after new server proof and atomic IDB CAS. It leads to a separately consented **new intent/new key** after fresh baseline, never a resend. COMMITTED with missing original result/version, expiry or absence remains PROTECTED. A 404/timeout never implies rollback or activates the resend button.
8. Keep React+TS+Vite, Tailwind CSS v4, shadcn/ui Nova/Base UI, AG Grid Community, Dockview, Floating UI lookup, current workspace/panel/feature stores and JWT access localStorage / HttpOnly refresh cookie decision. Avoid UI restyling and unauthorized package changes.
9. Frontend F01–F05 new work must be independently scoped PRs and evidence. Source tests and candidate acceptance do not imply full IIS, unperformed Narrator or production GO; do not delete/inspect previously quarantined SQL fixtures.

## 1. Work packages and dependency order

| Step | Frontend owner | Backend prerequisite | Exit |
|---|---|---|---|
| WEB6-01 | **F01** original-operation state/UX contract and consent matrix | B01 source and eligibility policy | No runtime, frozen corpus unchanged, explicit Owner technical gate |
| WEB6-02 | **F02** one-shot durable resend claim + frozen request transport, feature OFF | B04 real SQL resend safety proof required before pilot enable; B01 eligibility rules | IndexedDB atomic CAS, no auto dispatch, unit+native IDB tests |
| WEB6-03 | **F03** user-facing guarded action and confirmation, keyboard/a11y and failure recovery | B04 accepted, B02 operator support path available; B03 rehearsal for integrated closure | Native Chromium/Edge + true SQL integration for all six commands |
| WEB6-04 | **F04** actual published candidate, cutover, representative workload/negative scenarios | B02/B03/B04/B05 source accepted and candidate manifest frozen | Exact IIS Express/SQL/Chrome/Edge evidence + independent physical oracle |
| WEB6-05 | **F05** accurate user/operator handoff, final no-go/go dossier | B06 release-target register/Owner decision | Separate nonproduction pilot, staging and production decisions |

**Delivery discipline:** F02 code may be prepared behind a fail-closed feature flag while B04 SQL tests are ongoing. **Do not expose a clickable resend action until B04 and F02/F03 gates pass and Owner explicitly approves a bounded pilot**. F04 requires the merged/paired source, not arbitrary earlier frontend binaries. An old Web4 host cannot issue a WEB6 resend admission, and must keep UI disabled.

## 2. F01 — Frozen state, eligibility and UX source checkpoint

Inspect and map:
- `src/app/runtime/web4MutationRuntime.ts`: `write`, `inspect`, `validateRestore`, `bindRestored`, `checkResult`/`checkResolution`, `negativeReviewInfo`, `retryLocalResult`, auth/generation and in-flight `pending` guards.
- `src/infrastructure/drafts/web4OperationRepository.ts`, `draftRecord.ts`, `negativeLineageAdmission.ts`, `productionDrafts.ts`; current `DISPATCHED`/`SETTLED`/`REJECTED` and schema-v2 `NOT_EXECUTED` records, IDB `drafts`+`operations` transactional guards.
- `src/infrastructure/http/web4OperationCodec.ts`, `frozenWriteRequest.ts`, `operationStatusPort.ts`, `operationResolutionPort.ts`, `httpTransport.ts`: one HTTP mutation on first dispatch, no mutation replay on 401/refresh.
- `src/app/workspace/RecoverySupport.tsx` currently has disabled `Gửi lại đúng thao tác` and `Mở khóa thao tác`, with safe operator metadata/correlation. New design must not enable `Mở khóa` or promise a support ticket exists.

Freeze a decision table for COMMITTED, terminal NOT_EXECUTED, RESULT_UNAVAILABLE/EXPIRED, missing/404, timed out status, stale epoch/permission, old host, invalid IDB, multiple tabs. Establish exact original-operation method/route/body/hash and trusted server clock/retention policy. If trusted eligibility cannot be verified with existing response, B01/B04 must introduce a **separate additive read-only gate**; no speculative client age-only eligibility.

**UX copy:** same-key resend does not mean "try saving again with new payload." Explicitly explain that a second network send of **the exact original command** might post the sale/receipt once if the first did not finish. Show sanitized operation kind/document label, not raw note/customer names, include confirmation and keyboard navigation; no default checked state. Other support actions remain unchanged.

**F01 exit:** source diagram + user copy and threat model reviewed; B01 backend policy signed for implementation. No runtime flag enabled.

## 3. F02 — Durable single-consent resend state machine

Implement a **separate, feature-gated original replay path** within existing runtime infrastructure. Prefer extending `web4OperationRepository` with a new compatible durable claim record or dedicated IDB store (requires explicit schema/version review). Do **not** reclassify `DISPATCHED` as `REJECTED`, erase existing NTE lineage, consume the original operation ID as a new intent, or weaken raw draft persistence.

**Recommended durable claim:**

`ManualResendClaim { schemaVersion, actorKey, deploymentEpoch, operationId, frozenFingerprint, feature, localDocumentId, sourceDraftSequence, sourceOperationSequence, editRevision, generation, consentId, claimedAt, state: "CLAIMED" | "RESPONSE_OBSERVED" }`.

The claim is a local audit of the user's permission to attempt **one** dispatch, not proof of server execution. It must be written **in one IDB readwrite transaction** after comparing current draft/operation snapshots, expected sequences, identity/fingerprint, no existing claim and outstanding unresolved state. Any two-tab contender sees one winning claim. A crash/abort after durable claim but before/on HTTP sends **must not automatically release that claim**: the client cannot distinguish possible dispatch; it remains UNKNOWN and can only GET status. Do not write network requests in an IDB transaction. A BroadcastChannel/Web Locks optimization may notify tabs, but cannot substitute durable CAS. If a later second consent policy is desired, require separate Owner review and versioned tests; initially **one resend claim maximum per original key**.

**Transport:** decode and asynchronously rehash immutable persisted `FrozenWeb4Operation` (GUID, hash, kind, target, method and strict body size) before claim; do not construct new request from current editable draft. Reuse/refactor `frozenWriteRequest` to support original frozen-body dispatch under standard `HttpTransport`, Bearer token, same-origin, no redirect, deadline, and existing `Idempotency-Key`/`X-MyDmsVn-Deployment-Epoch` headers. Do not call `write()`, since it generates `crypto.randomUUID()`. Keep current `writeBoundary` semantic distinction between pre-dispatch failure and dispatched UNKNOWN; if uncertain, protect. Verify client guard immediately before request and server revalidates actor/session/permission/epoch.

**Preflight:** current auth; current original Write/Post grant; alive tab/document+generation/editRevision; matching local draft and unresolved original frozen fingerprint; no negative lineage conflict; server mode/version and bounded retention window; current protected resolution `GET`; no COMMITTED/NOT_EXECUTED/expired result; candidate-only flag. Backend `B04` owns independent server authorization/capacity. Consent token binds this exact immutable operation and expires on changed actor/context/permission; never persist a reusable global permission.

**After dispatch:** response matching original semantics settles through the existing `repository.settle`/`reject`/`resolveNegative` CAS, not an alternate optimistic update. If COMMITTED response is lost, call `checkResult` with safe GET (bounded); if local IDB commit fails leave protected and allow local-only storage retry. On wrong actor, permission change, timeout, 401, 403, 404, 409, 5xx, browser/tab crash or second tab conflict, never send another HTTP mutation automatically. Ensure the local claim and `DISPATCHED` survive reload/offline.

**F02 exit:** unit+native IndexedDB tests (quota, versionchange, blocked/open, late authorization, two tabs, corrupt claim, claim-before-network crash) and independent review; capability flag remains OFF pending F03 pilot approval.

## 4. F03 — UI and native-browser acceptance

Replace the permanent disabled resend button in `RecoverySupport` only when **all enabled predicates are satisfied** (flag, backend admission policy, current owned UNKNOWN, fresh original grant, exact decoded frozen intent, bounded retention, no claim or other pending action). Keep the `Mở khóa thao tác` button **disabled**; terminal negative follows the already implemented reviewed-new-intent flow, not arbitrary unlock.

Use accessible modal dialog with explicit checkbox or typed confirm for original immutable action, clear message that operation can execute for the first time, confirm/cancel keyboard behavior, busy/feedback in document tab, pointer/Tab/Enter/Escape handling. A modal opening/closing or focus restoration cannot trigger `Save` or `Post`. Keep helper/correlation copy size compact and Nova defaults; never show JWT, refresh token or raw payload in support export.

Browser tests:
- Original operation from each of six Sales/Receipt Create/Update/Post cases becomes UNKNOWN; after fresh server status and user opt-in, one observed HTTP resend with **same key+body+route**; physical SQL effect maximum one.
- COMMITTED available => recover by GET with **zero POST/PUT**. COMMITTED result expired => protected. Valid NOT_EXECUTED => reviewed new intent only, original key never sent; canceled/forbidden/session logout/old host/missing version keeps button disabled.
- Two open tabs in real Chromium/Edge IDB race: one durable winner, loser sees protected state and sends zero; reload after claim and network failure sends zero automatic attempts. A second click or pressed Enter cannot enqueue another operation. Optional one-tab inspect can occur without mutation.
- Original Read permission denied but corresponding Write/Post allowed status recovery; revoked original grant denied; no cross actor/epoch/generation/cross-document mixing.
- UTF-8 Telex/VNI text, lookup arrows/Enter/Tab, AG Grid line identity and raw decimal/RowVersion stability, Dockview close/reopen, 100%/125% Light/Dark if attended environment permits; unperformed Narrator through UNKNOWN remains NOT RUN, never PASS.

**F03 exit:** focused unit/native Chromium, focused Edge on Windows, actual SQL bridge and independent source/physical SQL oracle with no unresolved P0/P1; feature may be enabled for explicitly accepted nonproduction test pilot **only**. Do not claim production feature flag ON.

## 5. F04 — Paired production-like candidate acceptance

Work with backend B05 using a **single pinned pair**. Publish fresh backend net48/System.Web + compiled React assets into independently verified owned IIS Express HTTPS on Windows; require queue/controller/worker/route host admission from PR #95 before any request. Use real SQL Server schema13, distinct restricted runtime and operator roles; no foreign listener, no test on historical quarantined DB.

Test matched and mismatched host/client versions: new frontend/old `web4` host (safe v2/manual absence), cached old WEB4 tab/new compatible WEB5 host, open UNKNOWN across reload, session/permission revoke, mixed in-flight original/negative, compatible rollback without schema downgrade. Verify six business effects with independent journal/stock/ledger/COGS oracle, exception/refresh/CSP/Origin/cookie/limiter checks and per-worker single-worker assumption. Test operator support/maintenance CLI separately from frontend auth; backend B03 proof required.

Run bounded mixed workload with authenticated actors and record per-type p50/p95/p99 and sample sizes, throughput/error/timeout/worker/SQL resources/journal bytes; stage backup/restore and meaningful application recovery RPO/RTO. These are **measurements**, not invented SLA pass thresholds; backend B06 requires Owner-signed target-vs-actual for staging/release. If full IIS/Narrator unavailable on dev laptop, use `OWNER_ACCEPTED_EXCEPTION / NOT RUN` only for bounded nonproduction and maintain explicit production deferred.

**F04 exit:** exact source+asset hash and cross-repo tests, current candidate SQL/browser TRX, observed defects, quarantine and status mapping. No automatic mutation replay.

## 6. F05 — Support handoff and separate Owner decisions

Update accurate user help: `UNKNOWN` remains protected; `Gửi lại đúng thao tác` only under explicit valid pilot admission and one consent; original key/unchanged request might execute once; `Kiểm tra kết quả` read-only; `NOT_EXECUTED` requires new intent after reviewed fresh baseline; `COMMITTED` unavailable/version expired requires operator case and **does not** mean editable result. Support correlation is a lookup aid, not a created ticket. Never export secrets/raw business payload.

Pair backend B06 + frontend F05: source, lock and built artifacts/CI/SQL/browser evidence; baseline/measurement targets and observed; actual exceptions/limits; detailed operator workflow and recovery; explicit **three separate** decisions for nonproduction manual resend, staging acceptance and production release. A docs merge or all-green frontend CI cannot act as production approval. Do not archive until Owner instructs; leave prior WEB5 archive intact and backend CEX independent.

## 7. Small PR structure

| PR | Suggested branch | Implementation and test focus |
|---|---|---|
| F01 | `codex/web6-f01-resend-policy` | Source/UX contract, backend B01 consumed, no runtime |
| F02a | `codex/web6-f02-durable-claim` | IndexedDB versioned claim/CAS + native IDB tests; runtime flag OFF |
| F02b | `codex/web6-f02-frozen-transport` | Original frozen request send, 401/timeout/late result, authenticated gates; no UI enable |
| F03 | `codex/web6-f03-manual-resend-ux` | RecoverySupport modal, original-only action, browser/SQL bridge, no auto retry |
| F04a | `codex/web6-f04-paired-cutover` | Pinned IIS Express/SQL/browser six-cmd and compatibility |
| F04b | `codex/web6-f04-measured-quality` | Bounded load/alerts/recovery evidence and target handoff |
| F05 | `codex/web6-f05-support-and-release` | Candidate support docs, explicit Owner decision; no phantom GO |

Each PR must record exact real test selection, 0 skipped for claimed gates, native case counts with retried failures, source and built hash, independent SQL source/stock/ledger oracle, two-tab truth, cleanup of **new** owned fixtures only and review P0/P1/P2. Old WEB5 current statuses are historical; no automatic reactivation.

## 8. Initial status and stop rules

| Item | Initial state |
|---|---|
| F01 source/UX eligibility | PLANNED |
| F02a durable claim | IMPLEMENTED / LOCALLY VERIFIED; feature OFF |
| F02b frozen transport | IMPLEMENTED / LOCALLY VERIFIED; acceptance blocked; feature OFF |
| F03 manual action and browser proof | PLANNED |
| F04 paired actual candidate/cutover/workload/recovery | PLANNED |
| F05 support and readiness dossier | PLANNED |

**Stop immediately** if a client mutation occurs without fresh consent, if two tabs issue second transmissions for the same original key after the first claim, if a new GUID is created for manual resend, if expired/NOT_EXECUTED is resent, if backend journal makes two business effects, if SQL/HTTP host ownership is uncertain, or if an operator negative is inferred from missing status. Record BLOCKED instead of bypass. **STAGING NOT ACCEPTED / PRODUCTION NO-GO / DEFERRED** remains until explicitly replaced by Owner's new decision.
