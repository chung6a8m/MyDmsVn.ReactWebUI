# WEB6 F03 — guarded manual resend UX

**Date:** 2026-11-10 (Asia/Bangkok). **State:** IMPLEMENTED / LOCAL BROWSER VERIFIED; ACTUAL SQL ACCEPTANCE BLOCKED. Runtime and production artifact remain default OFF.

## Candidate and behavior

- Reviewed implementation commit: `2769eefda3fca5d58e810a48fbb8c36a5d4da061`; stacked dependency: F02b commit `bc9d57c`; backend authority: merged PR #104 / `59817c2e2ef8f79c90155b232bd06327f992138d` / `web6-resend-eligibility-v1`.
- `RecoverySupport` exposes the action only when the runtime was explicitly constructed with a candidate-bound manual resend configuration. The ordinary production construction supplies none.
- The dialog names the risk that this may perform the business action for the first time, shows only operation kind, sanitized document label and an abbreviated operation ID, and never displays receipt, JWT, body, customer or note.
- Cancel/Escape is safe; cancel receives initial focus and focus returns to the opener. IME composition suppresses Enter confirmation. A synchronous guard plus durable claim prevents double-click transmission. After confirmation the UI treats the right as consumed and only GET/local recovery and support remain.
- `Mở khóa thao tác` remains disabled. Terminal NOT_EXECUTED continues through the existing reviewed-new-intent path.

## Verification

| Gate | Executed | Pass | Fail | Skip/retry | State |
|---|---:|---:|---:|---:|---|
| Focused component + six-kind runtime | 75 | 75 | 0 | 0/0 | PASS |
| Chromium dialog pointer/keyboard/Escape/IME/double-click | 1 | 1 | 0 | 0/0 | PASS |
| Full unit regression | 1,444 in 75 files | 1,444 | 0 | 0/0 | PASS |
| `npm run build` | 2,578 transformed modules | 2,578 | 0 | 0/0 | PASS; existing bundle-size warning only |
| Native Chromium selected IDB/dialog/default-OFF support/workspace/lookup regression | 32 | 32 | 0 | 0/0 | PASS |
| Focused Windows Edge native IDB + dialog | 9 | 9 | 0 | 0/0 | PASS |
| IIS Express + backend-owned disposable SQL + independent business oracle | 0 | 0 | 0 | 0/0 | BLOCKED / NOT RUN |
| Attended Telex/VNI, 100%/125%, Narrator | 0 | 0 | 0 | 0/0 | NOT RUN |

Environment: Windows, Node `22.14.0`, npm `11.6.0`, Playwright `1.64.1`, bundled Chromium `156.0.8078.4`, Microsoft Edge `157.0.4341.42`. Commands used the repository Playwright web server and native browser IndexedDB. No frozen deployable artifact was produced, so no candidate artifact hash is claimed.

The Chromium/Edge dialog harness is real browser/component integration with controlled mocked authority; it is not SQL or backend acceptance. No pilot, staging or production approval is inferred. F04/B05 paired candidate work remains separate.
