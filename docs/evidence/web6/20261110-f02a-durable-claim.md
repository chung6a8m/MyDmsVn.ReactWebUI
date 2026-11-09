# WEB6 F02a — durable receipt and one-shot claim

**Date:** 2026-11-10 (Asia/Bangkok). **State:** IMPLEMENTED / LOCALLY VERIFIED; feature remains OFF. F02b/F03 paired browser+SQL acceptance is NOT RUN.

## Scope and provenance

- Frontend base: `92afef7c9090605a172ffc351d1e641d9df12100` on branch `codex/web6-f02-durable-claim`.
- Backend authoritative contract: merge `59817c2e2ef8f79c90155b232bd06327f992138d`, PR #104, `web6-resend-eligibility-v1`.
- Database `mydmsvn-drafts-v1` upgrades from version 1 to version 2 and adds only `manualResendReceipts` and `manualResendClaims`; existing `drafts` and `operations` records are preserved.
- The claim transaction reads draft, operation, receipt, existing claim and retained same-document lineage, then commits `CLAIMED` before any future HTTP mutation. `RESPONSE_OBSERVED` is monotonic; no API clears a claim.
- Receipt/claim codecs reject malformed identity, timestamp, receipt and record shapes. Receipt remains opaque and is not included in support metadata.

## Verification

| Command | Executed | Pass | Fail | Skip/retry | Result |
|---|---:|---:|---:|---:|---|
| `npm ci` | 420 packages audited | — | — | 0 | exit 0; 6 pre-existing audit findings (2 low, 4 moderate), no lock change |
| Baseline `npm run test:unit` | 1,404 | 1,404 | 0 | 0/0 | PASS before implementation |
| RED `npm run test:e2e -- web6ManualResendRepository.spec.ts` | 5 | 0 | 5 | 0/0 | Expected missing repository/module |
| Native claim GREEN `npx playwright test web6ManualResendRepository.spec.ts --project=chromium` | 8 | 8 | 0 | 0/0 | PASS; includes two pages/one winner, reload, quota, abort, corrupt receipt, blocked/versionchange, v1 upgrade and negative lineage |
| Existing repository regression `npx playwright test web4OperationRepository.spec.ts draftRepository.spec.ts --project=chromium` | 34 | 34 | 0 | 0/0 | PASS |
| Final F02a combined native gate `npx playwright test web6ManualResendRepository.spec.ts web4OperationRepository.spec.ts draftRepository.spec.ts --project=chromium` | 42 | 42 | 0 | 0/0 | PASS |
| `npm run typecheck` | 1 command | 1 | 0 | 0/0 | PASS |
| `git diff --check` | 1 command | 1 | 0 | 0/0 | PASS |

The first repository regression run exposed nine test-helper version assumptions after the intentional schema bump; production data paths were not relaxed. Helpers were updated to open the current database or use version 3 only when deliberately exercising blocked/versionchange behavior, then all 34 passed without retry.

## Limits

- No F02b eligibility port, original-only HTTP send or runtime orchestration is claimed by this evidence.
- No IIS Express, Edge, SQL fixture, independent business oracle, attended IME/Narrator, staging or production run occurred.
- Runtime resend remains default OFF. This evidence is not Owner approval for a pilot or release.
