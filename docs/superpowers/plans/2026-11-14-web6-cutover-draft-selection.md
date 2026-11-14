# WEB6 Cutover Draft Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the WEB6 cutover acceptance harness restore the protected draft for the exact operation under test when multiple protected drafts coexist.

**Architecture:** Keep recovery inside the Playwright pilot and use the operation ID already captured from the immutable operation record as the row identity. The product runtime remains unchanged; a focused Vitest guard pins the call contract and the live Playwright scenario remains the behavioral acceptance boundary.

**Tech Stack:** TypeScript, Playwright, Vitest, npm

**Spec:** `docs/superpowers/specs/2026-11-14-web6-cutover-draft-selection-design.md`

## Global Constraints

- Test/harness-only change; no product runtime or dependency changes.
- Never select a protected draft by row position or global protected-draft count.
- Preserve no-automatic-mutation-retry and all WEB6 actor/epoch/fingerprint fences.
- Do not touch the retained live candidate or its SQL allocations.

## Review Focus

- Two protected drafts coexist: recovery opens only the row whose support metadata contains the requested operation ID.
- Missing target operation: the one-row assertion fails closed rather than choosing another draft.
- Duplicate target identity: the one-row assertion fails closed.
- Every cutover scenario call supplies the operation it is currently validating.
- Existing single-draft scenarios retain their behavior.

---

### Task 1: Operation-keyed cutover recovery

**Files:**
- Modify: `tests/pilot/web6-cutover-live.spec.ts`
- Modify: `tests/unit/http/web6CutoverPilot.test.ts`

**Interfaces:**
- Consumes: `DurableOperationRecord.operationId` and the support metadata rendered inside each protected draft row.
- Produces: `recovery(page: Page, operationId: string): Promise<Locator>`.

- [x] **Step 1: Write the failing regression test**

Replace the global-count source guard with assertions that `recovery` accepts `operationId`, filters the protected row by both the protected label and operation ID, requires one matching row, and that each call passes the scenario's current operation ID.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd run test:unit -- tests/unit/http/web6CutoverPilot.test.ts`

Expected: FAIL because the current helper has no `operationId` parameter and its calls omit the target identity.

- [x] **Step 3: Implement the minimal harness correction**

Change `recovery(page)` to `recovery(page, operationId)`, narrow the list item with `hasText: operationId`, keep `toHaveCount(1)` on that keyed locator, and pass the relevant operation ID at every call site.

- [x] **Step 4: Verify GREEN and affected gates**

Run the focused test, `npm.cmd run typecheck`, `npm.cmd run build`, full `npm.cmd run test:unit`, and the repository's existing full Chromium/focused Edge regression commands applicable to this harness-only change. Report exact counts and any unrun live gate honestly.

- [x] **Step 5: Review the diff and commit**

Confirm only the two harness/test files and these approved design/plan records changed; commit the correction on the existing isolated frontend branch.
