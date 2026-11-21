# WEB7-06 — Exact Decimal Input Mechanics

**Ngày:** 2026-11-21 · **PR:** [#51](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/51) (independent-review fixes applied; exact-HEAD CI is the merge gate) · **base:** `main` `2a8c413e3f11688d6b97aa891d2bc2341b732892` (WEB7-05 merged).

**Scope:** W7-DEC-01..04 from the [owning roadmap](../../plans/20261120-001-web7-product-shell-ui-lab.md#web7-06) and [matrix](../../development/WEB7_ACCEPTANCE_MATRIX.md). This is a frontend UI extraction, not an update to decimal arithmetic, session ownership or WEB6 recovery.

## Changes

- `src/shared/inputs/DecimalInput.tsx`: controlled Base UI/Nova text input with `inputMode="decimal"`, exact raw + composition callbacks, optional Escape signal and keyboard capture callback. No `Number`, parsing, formatting, rounding, max length, built-in `type=number`, form state or blur-triggered commits.
- `src/shared/grid/DecimalCellEditor.tsx` and `src/features/goodsReceipt/GoodsReceiptEditors.tsx`: same shared control; captured session/line `useRef(props)`, original buffer and printable `eventKey` startup retained; raw publication/restore still call their own session APIs; stable `documentFieldId` and `data-line-id` retained.
- `src/lab/DecimalInputStates.tsx` and `src/lab/ComponentsLab.tsx`: DEV-only field/inline cell-style demo using the exact shared input, local-only state, comma/extra-zero, incomplete, invalid, 65-character, readonly/disabled, IME and Escape states.
- `tests/components/inputs/DecimalInput.test.tsx` and `tests/e2e/decimal-input.spec.ts`: raw accuracy, composition guard, Escape forwarding, accessibility, Lab and real Sales/Receipt editor interactions.

## Acceptance mapping

| ID | Source contract | Tests |
|---|---|---|
| W7-DEC-01 | Raw remains string; domain exact decimal/BigInt and both parsers are untouched | New DecimalInput component/Lab + existing Sales/Receipt decimal unit tests |
| W7-DEC-02 | Composition, Escape, keyboard capture and lifetime binding stay correct; invalid raw survives blur/remount | New component/Chromium tests + existing Sales editing/review round 4/Receipt E2E |
| W7-DEC-03 | Session raw write + Save barriers remain the single authority, not an input-local copy; final keystroke reaches snapshot | New Sales Chromium snapshot + existing editorBarrier/Receipt editing tests |
| W7-DEC-04 | Receipt 64-char bound and duplicate-product validator; Sales gift, duplicate-line identity, 200 lines and overflow policy remain feature-specific | New 65-char Lab + existing Sales/Receipt validators and editing tests |

## Scoped source review finding and remediation

- During source review, found an Escape recovery regression risk: a session raw buffer can retain `composing=true` when AG Grid unmounts an editor mid-IME. The newly mounted input has no active native composition; guarding Escape on the **session** composing flag would prevent restoring the orphaned buffer. The shared input now guards only the live local/native IME state. New component regression explicitly checks a remounted editor with stale `composing=true`.
- Added Chromium mid-string insertion assertions for Sales and Receipt Lab inputs, checking both exact value and caret position. Existing business Save and parser behavior remains untouched.
- This is a scoped implementer source review, **not** an independent reviewer approval. All source/test changes must be tested again on the updated HEAD; older cancelled CI is not evidence for the new commit.

## Independent review remediation (2026-11-21)

- **P2 fixed:** The initial remounted-input Escape test covered only the callback, not the session buffer restored by the two actual AG Grid adapters. If an earlier editor left `composing=true`, both adapters captured that orphaned buffer as the Escape baseline; Escape restored the stale flag and Save remained blocked. Sales and Receipt now treat a composing entry buffer as having no stable original; Escape clears it and falls back to the canonical draft value.
- **Regression:** Added real Sales and Receipt editor + session + Save-barrier component cases to `tests/components/inputs/DecimalInput.test.tsx`; they assert that Escape removes the orphaned raw buffer and `prepareSave` becomes ready. This is distinct from the existing callback-only stale-IME test.
- Source fix commits: `02485f0` (Sales), `da1a14b` (Receipt), `eeb0442` (tests). Independent review: [PR #51 review](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/51#pullrequestreview-6002344875). No domain parser, validation, business Save/Post, or WEB6 behavior changed.

## Verification

- **Source review:** both call sites use the shared control with original `useRef` editor identity, raw write/restore, disabled state and stable accessibility attributes. No changes to domain decimal helpers, session stores, barriers, WEB6/backend/API, manifest/lock or production Lab graph.
- **Local environment:** no checkout/npm packages or outbound GitHub network access available in the execution container; local `npm ci`, TypeScript, Vitest and native Chromium **NOT RUN**. Do not infer PASS from source inspection.
- **Pre-review CI:** Exact pre-review SHA `b3d5d40cd846dc36327e940c4248bcde82c719b7` completed [Web checks #44853997559](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44853997559) successfully: typecheck/build, 1,825 unit/component PASS / 1 SKIP, 311/311 Chromium, 3/3 production-artifact isolation. These results **do not certify subsequent review-fix commits**.
- **Post-review acceptance:** Check the [PR #51 conversation and checks](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/51) for the exact final HEAD SHA, latest run, review disposition and merge result. Only successful final-HEAD CI can satisfy the merge gate; cancelled or older runs do not.
- **Independent source review:** P2 orphaned-IME restoration finding remediated in the feature adapters; no remaining P1/P2 identified from the reviewed changes. GitHub review comment records the details.

## Boundaries

Synthetic composition and Chromium fake ports/HTTP stubs do not replace attended Windows Telex/VNI/Narrator, Edge, SQL/IIS, real operator tests or release approval (**NOT RUN**). WEB6 staging remains NOT ACCEPTED / production NO-GO; ordinary resend OFF. No new business mutations/idempotency behavior.
