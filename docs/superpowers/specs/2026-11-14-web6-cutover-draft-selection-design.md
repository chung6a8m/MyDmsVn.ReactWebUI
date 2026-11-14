# WEB6 Cutover Draft Selection Design

## Intent

Correct the frontend live-acceptance harness regression exposed by fresh candidate `web6-20261114-29acf1cf`. The cutover scenario legitimately retains more than one protected `UNKNOWN` draft, so recovery must restore the draft for the operation currently under test rather than require the dialog to contain exactly one protected draft.

## Scope and constraints

- Change test/harness code only; do not change product runtime, UI, wire contracts, IndexedDB schema, or resend policy.
- Preserve every protected draft and all existing actor, epoch, fingerprint, permission, and no-automatic-retry fences.
- Do not reuse, retry, query, or clean the retained live candidate.
- Keep the existing browser-visible support identifier as the selection key; never select by list position.

## Approaches

1. **Select the recovery row by `operationId` (chosen).** Pass the target operation ID into `recovery`, filter the protected draft row by that identifier, require exactly one matching row, and open it. This follows the existing `web4-helpers.ts` pattern and remains correct when unrelated protected drafts coexist.
2. Delete or settle the earlier protected draft before creating the next operation. Rejected because it weakens the scenario and would hide the real multi-draft recovery boundary.
3. Select the newest or last protected row. Rejected because DOM order is not an identity contract and could restore the wrong immutable intent.

## Verification

Use TDD. First replace the current source-text assertion with a regression that requires operation-keyed recovery and proves every call supplies the intended operation ID; observe it fail on the current helper. Then make the minimal harness change, run the focused Vitest file, typecheck, build, the full unit suite, and the existing frontend regression gates required by repository policy. No fresh live attempt is part of this correction.
