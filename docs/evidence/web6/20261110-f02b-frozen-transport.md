# WEB6 F02b — signed eligibility and frozen original transport

**Date:** 2026-11-10 (Asia/Bangkok). **State:** IMPLEMENTED / LOCALLY VERIFIED; acceptance remains BLOCKED and feature remains OFF.

## Contract and scope

- Stacked base: F02a commit `12af953`; backend authority is merged PR #104 / `59817c2e2ef8f79c90155b232bd06327f992138d` / `web6-resend-eligibility-v1`.
- `HttpTransport` allowlists only exact GET context, receipt and eligibility v3 shapes. It does not allow arbitrary v3 routes or mutations.
- Strict Zod decoders bind candidate, actor, epoch, operation ID, fingerprint, kind, method, route and target; UTC fields require seven fractional digits and receipt remains opaque/bounded.
- `manualResendRequest` rehashes the persisted frozen operation and sends its exact path, body, original GUIDv4 key and epoch. It creates no UUID and inherits the existing mutation no-retry transport boundary.
- The runtime obtains and stores the signed receipt before the original mutation dispatch only when an explicitly injected candidate configuration exists. Missing/invalid receipt never grants resend and does not block the ordinary original write.
- Explicit preflight performs fresh context and eligibility GETs. Confirmation repeats the protected reads, commits the durable CAS claim, then uses the original frozen transport and existing settlement/rejection paths. Claim failure produces zero additional mutation; ambiguous failure never releases the claim.
- `createProductionRuntime` has no default candidate configuration. The shipped/default path remains OFF and the recovery action remains disabled.

## Verification so far

| Command | Executed | Pass | Fail | Skip/retry | Result |
|---|---:|---:|---:|---:|---|
| RED focused Vitest (modules absent) | 2 suites | 0 | 2 | 0/0 | Expected missing port/sender |
| Focused ports/sender | 31 | 31 | 0 | 0/0 | PASS |
| HTTP/auth/wire regression selection | 302 | 302 | 0 | 0/0 | PASS |
| Focused runtime, all six operation kinds | 72 | 72 | 0 | 0/0 | PASS |
| `npm run typecheck` | 1 | 1 | 0 | 0/0 | PASS |

No IIS Express, actual SQL oracle, Edge, attended IME/Narrator, staging or production run is claimed. F03 and paired backend acceptance remain blocked/not run; the production runtime has not enabled the feature.
