# WEB6 — Frontend manual same-key resend and durable recovery design

**Status: selected design / PLANNED. Feature remains DISABLED by default (2026-11-03).** [Owning WEB6 frontend plan](../plans/20261103-001-web6-recovery-quality-web.md) · [acceptance gates](../development/WEB6_WEB_ACCEPTANCE.md) · [Codex handoff](../development/WEB6_CODEX_HANDOFF.md) · [inherited WEB5 UX](WEB5_RECOVERY_AND_RELEASE_BOUNDARIES.md) · [backend protocol](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB6_RECOVERY_OPERATION_PROTOCOL.md).

## 1. Define the operation, not an "ordinary retry"

The browser already persists the original immutable `FrozenWeb4Operation` and transaction-complete original draft+intent before first mutation dispatch. `web4MutationRuntime.write` uses `crypto.randomUUID()` to create **new** operations and must **never** be called for manual resend. `frozenWriteRequest` strictly validates the original, sets `Idempotency-Key` + `X-MyDmsVn-Deployment-Epoch` and sends original frozen body through `HttpTransport`; it is the correct wire pattern to reuse, **not** a mandate to bypass its current expected-request/current-owner checks. Current `RecoverySupport` has permanently disabled `Gửi lại đúng thao tác` and `Mở khóa thao tác`.

**Target:** a human selects a specific original `DISPATCHED/UNKNOWN` intent, reviews a sanitized operation summary, explicitly confirms that resending *might execute the originally intended business operation once*, and the browser makes **at most one additional HTTP transmission per durable consent** with *exact original* GUID, method, route, target, body, epoch, fingerprint and expected version. Backend SQL journal controls **at most one committed business effect per original key**; two requests on the wire cannot be assumed impossible if original was already in flight.

**Non-target:** automatic network retry; new UUID behind resend; re-Post after NOT_EXECUTED; generic edit unlock; background queue; local/online timer retry; universal retry interceptor; global user consent; virtual "support case closed" proof; automatic two-tab broadcast write; package/framework/UI-theme migration; new business module.

## 2. State / decision table

| Fresh server + local observation | Manual same-key action | UI outcome |
|---|---|---|
| Original COMMITTED, valid original result | **Not needed**, zero HTTP mutation | Authorized GET + atomic local SETTLED |
| COMMITTED with RESULT_EXPIRED/RESULT_UNAVAILABLE, missing original version/line IDs | **Forbidden** | PROTECTED, operator case/business verification only |
| Valid durable SQL NOT_EXECUTED/CANCELLED | **Forbidden for old key** | Original negative CAS; separate reviewed NEW intent and new GUID after fresh baseline |
| UNKNOWN/INDETERMINATE, exact valid original, known server mode/eligibility and bounded result retention, current grant, explicit consent | **Potentially allowed** in approved pilot, exactly one claim | Revalidate; same frozen request; may execute once; remain protected until COMMITTED/result |
| Status404/NOT_OBSERVED alone, timeout or HTTP 5xx | Not an eligibility proof | UNKNOWN; no auto action; separate fresh verified gate required |
| Auth/session revoked, original Write/Post revoked, actor/epoch/generation changed | Forbidden | PROTECTED, no info leak |
| Old web4 host without versioned eligibility, non-web5 schema/mode, wrong fingerprint or expired window | Forbidden | PROTECTED; positive original-v1 protected GET fallback where applicable |
| Two-tab claim winner/loser or IDB abort/quota/versionchange | Loser must not send; failure does not re-open claim | No additional network POST/PUT; local-only recovery |
| Tab closes after durable claim, before/on fetch; lost response after dispatch | **No automatic retry on restore** | UNKNOWN; safe bounded GET status/result, operator escalation if not resolved |

Never equate HTTP 404 or missing journal row with durable NOT_EXECUTED. A transaction can be in progress or server may be unavailable. The user is not allowed to instruct the browser to "fix" this with a new GUID.

## 3. Proposed interfaces and file ownership

Implement in narrow layers, treating these as **proposed names** subject to source review:

- `src/infrastructure/drafts/web4OperationRepository.ts`: extend `Web4OperationRepository` with `claimManualResend(input)`, `readManualResendClaim` and explicit versioned claim schema. Persist in existing indexed stores if an atomic invariant can be proven; otherwise use a dedicated `manualResendClaims` store and bump IndexedDB version with real upgrade tests. No accidental deletion of historical `DISPATCHED`, `SETTLED`, `REJECTED` or v2 `NOT_EXECUTED` records. Keep synchronous IDB guard and commit completion semantics.
- `src/infrastructure/http/manualResendOriginal.ts`: strict original frozen validation/hash via `decodeFrozenWeb4Operation`, same ActorScope, safe request boundary and `web4OperationPath`; use existing transport, Bearer and `frozenWriteRequest` implementation pattern with no transformed current UI payload and no new UUID. The ordinary write path remains unchanged and cannot call this method without a durable claim.
- `src/app/runtime/web4MutationRuntime.ts`: `manualResendEligibility` and `confirmManualResend` are separate from `write()`, `checkResult()` and `retryLocalResult`. Reuse `owners`, `pending`, `known`, `validated`, `negativeLineages`, `negativeAdmission` and `authorityRevision` fences. Upon a confirmed original response reuse `settle`/`reject` existing CAS + feature mapping. Dispatched UNKNOWN retains state.
- `src/app/workspace/RecoverySupport.tsx` and existing caller: safe enabled/disabled state, explanatory modal, consent and accessible feedback. Keep disabled `Mở khóa thao tác` until a *separately authorized* operator unlock protocol exists (not part of this roadmap); do not expose unverified support ticket creation.
- `src/infrastructure/http/operationResolutionPort.ts` and `operationStatusPort.ts`: safe GET status/result, separate original Write/Post authority; do not change `web4-v1` and `web5-resolution-v1` payload schemas. If backend B01 decides a versioned eligibility endpoint is indispensable, build a separate strict Zod decoder/transport and corpus, reviewed with backend B04 before enabling.
- `tests/unit/drafts`, `tests/unit/http`, `tests/e2e/web5TerminalResolution.spec.ts`, `web5RecoveryBoundaries.spec.ts`, `web5HistoricalRecovery.spec.ts` and actual SQL bridge tests are natural regression hosts; inspect current names/harnesses before editing.

No persisted browser record grants server-side authority. The final HTTP API always validates current session, actor, epoch, operation kind permission and journal fingerprint.

## 4. Durable atomic one-shot claim

Design draft, operation and claim as one **transactionally checked identity**. Suggested record (not final wire contract):

`{schemaVersion:1, actorKey, deploymentEpoch, operationId, requestFingerprint, feature, localDocumentId, draftSequence, operationSequence, editRevision, generation, consentId, claimedAtUtc, state:"CLAIMED"|"RESPONSE_OBSERVED"}`.

Claim must be keyed uniquely by `actorKey + deploymentEpoch + operationId`; fingerprint and all other fields are compared as values. Do not key solely by localDocumentId or tab ID (both can change). All fields derive from **trusted in-app records** except consentId generated for UI accountability. Do not store token, cookie, permission snapshot, sensitive note or raw body in claim.

1. **Preflight read-only:** current actor scope, original grant (Create/Update Write or Post), matching live/restore ownership, original frozen hash/draft CAS, no known COMMITTED/terminal/expired state. Call current protected status and optional versioned capability; a separate server eligible hint is **not an HTTP mutation lock**.
2. **Consent:** user reviews immutable action and confirms. Record ephemeral consent bound to exact current operation/draft revision, with no reusable global "remember choice." Any asynchronous change revokes it.
3. **Atomic claim:** one IDB readwrite transaction with `drafts`/`operations`/`claims` (or equivalent) rechecks expected draft sequence, operation `DISPATCHED`/sequence, actor/epoch/key/fingerprint/revision and no prior claim; stores claim before committing. A loser fails with conflict. No fetch inside this transaction.
4. **Just before HTTP:** recheck ownership, non-disposed runtime, signal, current auth grant/server context and original frozen digest. If changed, send zero; **do not delete consumed claim to make retry easy**. If no way to safely continue, leave protected, use GET and operator path.
5. **Dispatch:** exactly once from that claim, via standard `HttpTransport.request` with current token, strict body+result decoding and original `Idempotency-Key`. No automatic retry after 401, 408, network loss, app restart or fetch cancellation. Optional status GET after is a separate operation.
6. **Completion:** use original result/negative typed decoder and existing `repository.settle` or `resolveNegative`/`reject` when applicable. If local commit fails, retain UNKNOWN; `retryLocalResult` can persist already-known result **without a new HTTP mutation**. A claim marked RESPONSE_OBSERVED is still not authoritative settlement until IDB transaction completes.
7. **Reload/two tabs:** reading an existing claim never triggers `fetch`. Tab B refuses dispatch once Tab A's claim committed; `BroadcastChannel`/Web Locks may improve presentation but are not correctness gates. A crashed "pre-fetch" claim remains consumed; this conservative failure mode is intentional.

A later product need for another manual attempt requires a **separate policy, versioned claim and independent review**. This roadmap authorizes at most one resend claim per original key, so no "unlock and try again" button after unknown outcome.

## 5. Backend eligibility and retention guard

Existing backend `SqlWebOperationJournal.AdmitAsync` may execute the original operation if no durable journal row exists; this is semantically intended under manual consent. An operator could concurrently record durable negative. All actual writes serialize on the same epoch+actor/key SQL fence, but a client GET can race with POST. A backend "can resend" read-only response **cannot guarantee a future write result**; it is only an admission hint. Keep all server-side checks final at write time.

Current original results have a seven-day retention window. The frontend cannot establish eligibility solely from `Date.now`, a local cached timestamp or status404. Backend B01 must choose a trusted bounded window/compatible host gate and B04 must verify its behavior; until then, manual-resend eligibility remains **not implemented/disabled**. Expired/compacted tombstones cannot be reused; original result unavailable must remain protected even if COMMITTED business outcome is proven.

Backwards compatibility is ADDITIVE (ADR0015): old cached `web4-v1` browser ↔ new `web5` host retains v1 contract; new frontend ↔ old `web4` host cannot gain new capability, but should support protected positive v1 recovery. Do not convert deployment epoch into frontend bundle version. Never try to start a schema12 host on a schema13 database.

## 6. User experience and accessibility

Use shadcn/ui Nova/Base UI defaults, no new Business Compact typography. The recovery panel should show clear statuses:

- **"Kiểm tra kết quả"** performs protected status GET, not POST/PUT.
- **"Gửi lại đúng thao tác"** becomes enabled only after every entitlement, identity, time-window, feature and one-shot condition passes; use explicit modal confirming that this may process the original sale/receipt once if not processed earlier.
- **"Mở khóa thao tác"** remains disabled unless separately authorized; a terminal negative is handled via existing reviewed-new-intent flow.
- **"Sao chép thông tin hỗ trợ"** continues sanitized operatorMetadata only; no tokens, request bodies, raw lines or customer data.
- After a click, show per-tab busy and durable-claim state; keyboard Enter/Space/Escape, focus return and modal dismissal never dispatch writes. If preflight changes while modal open, disable/abort without request.
- A second click, close/reopen, reload, browser reconnect, timeout or session refresh must not resend. Explain consumed attempt and current UNKNOWN truthfully without claiming a support case exists.

Preserve AG Grid Product/UoM/Qty/Gift line identity and keyboard behavior, Dockview close admission, Floating UI lookup, durable draft raw note/decimal, Sales duplicate products/gifts and Receipt uniqueness. Test native tab focus and composition/Telex/VNI when attended; do not conflate Linux Chromium CI with Windows Narrator/IME evidence.

## 7. Required test-first matrix

| Gate | Test method | Mandatory result |
|---|---|---|
| F6-RES-01 | Strict frozen wire codec and original-result port unit | Same GUID/body/method/route/fingerprint, no UI-built payload, no new UUID |
| F6-RES-02 | IDB native two-tab claim contention | Winner exactly one durable claim, loser zero HTTP mutation |
| F6-RES-03 | IDB abort/quota/versionchange/blocked upgrade | No dispatch before committed claim, no wrong-source data loss |
| F6-RES-04 | Browser tab crash after claim, before/on request | No auto mutation on restore, original remains protected |
| F6-RES-05 | Auth/actor/epoch/grant/generation changed at each async boundary | Zero mutations after revoke; stale response cannot SETTLE wrong document |
| F6-RES-06 | Fresh COMMITTED, NOT_EXECUTED, expired/unavailable, 404/timeout/403 and wrong old host | Correct GET/locked behavior, no illegal manual resend |
| F6-RES-07 | All six Sales/Receipt original commands via true SQL and native Chromium/Edge | One client transmission per consent, one SQL business effect, original COMMITTED outcome and actual stock/ledger oracle |
| F6-RES-08 | Keyboard/confirmation/new-intent post-negative | Explicit user consent and original-only; no hidden Enter/Tab/timeout trigger |
| F6-RES-09 | Auth refresh pipeline and HTTP 401/5xx during dispatched write | No automatic mutation retry, READ may recheck safely |
| F6-RES-10 | Closed/changed tab or cross-actor restore | No unauthorized stored claim adoption, leaked results or corrupted drafts |
| F6-COMP-01 | Cached old/new candidate, original v1 DISPATCHED and additive v2 | No invalid new capability, correct original grants and no old-schema downgrade |
| F6-REL-01 | Exact built asset/provenance and B06 target-vs-actual | NO-GO unless explicitly accepted |

No mock-only test counts as SQL journal proof. Browser tests may assert network mutations, but independent physical SQL oracle must establish business no-double-effect. Never treat a clean new fixture's cleanup as evidence of historical quarantine deletion.

## 8. Implementation gates and decision record

1. F01 design accepted with backend B01 eligible policy; no capability live.
2. F02 implementation behind default-off flag + review P0/P1=0, focused unit/native IDB.
3. Backend B04 six-command SQL proof accepted; no new add-on endpoint without schema/contract review.
4. F03 real Chromium+Edge/SQL tests and Owner **explicit nonproduction pilot** permission; then a candidate-specific opt-in may enable original resend for that pilot only.
5. F04 exact pair IIS Express/SQL/cutover/measurement and B05/B06 operator evidence. Independent target-vs-actual and production decision remain deferred until the separate gate.

**Fail closed:** anything ambiguous leaves original document/operation PROTECTED. A safe UI showing UNKNOWN is correct even if inconvenient; a fake "success"/"not executed" or automatic second mutation is a data-integrity defect.
