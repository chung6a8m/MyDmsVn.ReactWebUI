# WEB6 F02b — signed eligibility and frozen original transport

**Date:** 2026-11-10 (Asia/Bangkok). **State:** IMPLEMENTATION IN PROGRESS / PORTS LOCALLY VERIFIED; feature remains OFF. Runtime orchestration and F03 acceptance are not yet claimed.

## Contract and scope

- Stacked base: F02a commit `12af953`; backend authority is merged PR #104 / `59817c2e2ef8f79c90155b232bd06327f992138d` / `web6-resend-eligibility-v1`.
- `HttpTransport` allowlists only exact GET context, receipt and eligibility v3 shapes. It does not allow arbitrary v3 routes or mutations.
- Strict Zod decoders bind candidate, actor, epoch, operation ID, fingerprint, kind, method, route and target; UTC fields require seven fractional digits and receipt remains opaque/bounded.
- `manualResendRequest` rehashes the persisted frozen operation and sends its exact path, body, original GUIDv4 key and epoch. It creates no UUID and inherits the existing mutation no-retry transport boundary.

## Verification so far

| Command | Executed | Pass | Fail | Skip/retry | Result |
|---|---:|---:|---:|---:|---|
| RED focused Vitest (modules absent) | 2 suites | 0 | 2 | 0/0 | Expected missing port/sender |
| Focused ports/sender | 31 | 31 | 0 | 0/0 | PASS |
| HTTP/auth/wire regression selection | 302 | 302 | 0 | 0/0 | PASS |
| `npm run typecheck` | 1 | 1 | 0 | 0/0 | PASS |

No IIS Express, SQL, Edge, attended IME/Narrator, staging or production run is claimed. The production runtime has not enabled the feature.
