# WEB6 Manual Same-Key Resend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement WEB6 F02a, F02b and F03 as a default-off, explicitly confirmed, one-shot resend of the exact persisted original operation.

**Architecture:** Extend the shared IndexedDB database with versioned receipt and claim stores, using a single draft/operation/claim readwrite CAS before network dispatch. Add strict `web6-resend-eligibility-v1` read ports and a dedicated frozen-operation mutation sender, orchestrated by the existing mutation runtime and exposed through the existing recovery UI only when a candidate-specific default-off gate is enabled.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Zod 4, IndexedDB, Vitest 5, Playwright 1.64, Base UI Dialog.

**Spec:** `docs/design/WEB6_MANUAL_RESEND_AND_RECOVERY_UX.md`; authoritative backend contract at MyDmsVn `59817c2e2ef8f79c90155b232bd06327f992138d`.

## Global Constraints

- Feature remains default OFF; no release or pilot enablement is part of this plan.
- No mutation retry after 401, timeout, 5xx, reload, reconnect, effect or timer.
- Resend uses the original GUIDv4, method, route, target, epoch, fingerprint and persisted body; it never calls ordinary `write()`.
- Receipt is opaque, never logged/exported, and must be durably stored before the original dispatch to confer future eligibility.
- A committed claim is consumed permanently, including crash or ambiguous network failure.
- Archived WEB4/WEB5 fixtures and evidence remain byte-identical.
- Real SQL/IIS/Edge acceptance is reported `BLOCKED / NOT RUN` unless an owned current candidate is available.

## Review Focus

- Two tabs racing the same operation: exactly one durable claim and loser zero mutation (Task 1 native browser test).
- Database v1 upgrade with an already-open peer: preserve drafts/operations and fail closed on blocked/versionchange (Task 1 browser tests).
- Actor, epoch, permission, generation, edit revision or operation bytes changing after any await: zero mutation (Task 3 runtime tests).
- Eligibility 404, DENY, INDETERMINATE, malformed or expired response: zero mutation (Task 2/3 tests).
- Dialog Enter/Escape/double-click/IME and focus restoration: no implicit confirmation and at most one explicit call (Task 4 component/browser tests).

---

### Task 1: F02a shared IndexedDB receipt and one-shot claim

**Files:**
- Create: `src/infrastructure/drafts/web6ManualResendRepository.ts`
- Create: `src/infrastructure/drafts/draftDatabase.ts`
- Modify: `src/infrastructure/drafts/web4OperationRepository.ts`
- Modify: `src/infrastructure/drafts/indexedDbDraftRepository.ts`
- Test: `tests/e2e/web6ManualResendRepository.spec.ts`
- Test: `tests/e2e/helpers/web6ManualResendRepositoryHarness.ts`

**Interfaces:**
- Produces: `storeManualResendReceipt(input)`, `readManualResendReceipt(key)`, `claimManualResend(input)`, `readManualResendClaim(key)`, `observeManualResendResponse(input)`.
- Claim input binds actor/epoch/operation/fingerprint/document, draft and operation sequences, edit revision, generation and consent ID.

- [x] Write native IndexedDB RED tests for v1 upgrade preservation, receipt corruption, exact one-winner contention, duplicate/stale/quota/abort/blocked/versionchange and reload-consumed behavior.
- [x] Run the focused Chromium spec and verify failures are due to the missing repository/schema.
- [x] Add the shared version-2 opener and strict receipt/claim codecs; update both existing repository open paths to require all four stores.
- [x] Implement receipt persistence and the atomic `drafts + operations + manualResendClaims` CAS without network work inside the transaction.
- [x] Run focused native browser tests, then existing draft/operation repository regressions.
- [x] Record F02a evidence and commit the bounded change.

### Task 2: F02b strict WEB6 read ports and original-only sender

**Files:**
- Create: `src/infrastructure/http/web6ResendEligibilityPort.ts`
- Create: `src/infrastructure/http/manualResendRequest.ts`
- Modify: `src/infrastructure/http/httpTransport.ts`
- Modify: `src/infrastructure/http/frozenWriteRequest.ts`
- Test: `tests/unit/http/web6ResendEligibilityPort.test.ts`
- Test: `tests/unit/http/manualResendRequest.test.ts`

**Interfaces:**
- Consumes: validated `FrozenWeb4Operation` and durable opaque receipt.
- Produces: strict context/receipt/eligibility reads and `manualResendRequest(...)` that transmits only the frozen operation.

- [x] Write RED corpus-driven tests for all six operation kinds, seven-digit UTC, large IDs, candidate/actor/epoch/fingerprint mismatches and every decision/reason.
- [x] Write RED transport tests proving only the three exact GET v3 routes are allowlisted and mutation 401/timeout/5xx is never retried.
- [x] Implement strict Zod codecs, identity matching and bounded opaque receipt handling.
- [x] Implement the dedicated frozen sender with no UUID creation and original headers/body/path.
- [x] Run focused tests and existing HTTP/auth/wire regressions.
- [x] Record F02b evidence and commit on a stacked F02b branch.

### Task 3: F02b runtime receipt-before-first-dispatch and guarded manual resend

**Files:**
- Modify: `src/app/runtime/web4MutationRuntime.ts`
- Modify: `src/app/runtime/createProductionRuntime.tsx`
- Modify: `src/infrastructure/drafts/web4OperationRepository.ts`
- Test: `tests/unit/drafts/web4MutationRuntime.test.ts`

**Interfaces:**
- Produces: `manualResendInfo(feature,id)`, `prepareManualResend(feature,id)`, and `confirmManualResend(feature,id,consentId)` with all async fences.

- [ ] Write RED runtime tests for OFF behavior, receipt acquisition/storage before first dispatch, storage failure preserving ordinary write behavior without resend entitlement, claim-before-network, stale scopes, duplicate claim and ambiguous failure consumption.
- [ ] Add receipt acquisition as an optional default-off pre-dispatch path without changing accepted OFF write behavior.
- [ ] Add fresh context/eligibility preflight, durable claim and original-only dispatch using existing settle/reject handling.
- [ ] Recheck actor, authority revision, owner/session/generation/edit revision and persisted operation after every await.
- [ ] Run focused runtime plus six-operation and negative-lineage regressions.
- [ ] Record F02b evidence and commit.

### Task 4: F03 accessible explicit confirmation UI

**Files:**
- Modify: `src/app/workspace/RecoverySupport.tsx`
- Modify: `src/app/workspace/LocalDraftControls.tsx`
- Test: `tests/components/RecoverySupport.test.tsx`
- Test: `tests/e2e/web6ManualResend.spec.ts`

**Interfaces:**
- Consumes: runtime manual-resend availability/preflight/confirm callbacks.
- Produces: sanitized, focus-safe dialog with explicit risk confirmation and consumed UNKNOWN state.

- [ ] Write RED component tests for sanitized labels, default focus on cancel, Escape/Enter/IME/double-click, focus restoration and consumed state.
- [ ] Implement the existing Nova/Base UI dialog without new styling framework or sensitive data display.
- [ ] Wire recovery controls to the current document/runtime owner; leave `Mở khóa thao tác` disabled.
- [ ] Add Chromium integration for close/reopen, two tabs and zero hidden mutation; run focused AG Grid/Dockview/lookup regressions.
- [ ] Record F03 as implemented and separate local browser proof from SQL/Edge acceptance.
- [ ] Commit on a stacked F03 branch.

### Task 5: Verification and PR handoff

**Files:**
- Modify: `docs/plans/20261103-001-web6-recovery-quality-web.md`
- Modify: `docs/development/WEB6_WEB_ACCEPTANCE.md`
- Create/Modify: `docs/evidence/web6/20261110-f02a-durable-claim.md`
- Create/Modify: `docs/evidence/web6/20261110-f02b-frozen-transport.md`
- Create/Modify: `docs/evidence/web6/20261110-f03-manual-resend-ux.md`

- [ ] Run `npm ci`, focused RED/GREEN selectors, full unit suite, typecheck and build; record exact counts and retries.
- [ ] Run focused/full Chromium and Edge only where the configured runner is owned and available.
- [ ] Check corpus trees, `git diff --check`, feature default OFF and production artifact isolation.
- [ ] Report real SQL/IIS acceptance as `BLOCKED / NOT RUN` unless current owned fixtures/runbooks can be proven.
- [ ] Push the three stacked branches and open three non-merged PRs with explicit bases/dependencies.
