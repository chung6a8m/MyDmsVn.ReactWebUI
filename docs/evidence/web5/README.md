# WEB5 frontend evidence index — selected, not executed

**2026-11-02: Roadmap 05 selected, F01–F05 PLANNED / NOT RUN.** This index contains NO WEB5 runtime/browser/SQL/IIS or attended evidence yet. Activating the roadmap is a documentation-only change.

**Roadmap review corrections (docs-only, 2026-11-02):** P1-01/P1-02 and P2-01–04 addressed in plan, design, acceptance and Codex handoff. Added F5-RES-12/13, F5-COMP-01/02, F5-IIS-04/05 and F5-REL-04/05, linked to backend B5 gates. All are PLANNED/NOT RUN; no actual browser/SQL/IIS/attended evidence or product activation comes from this review.

**Round-2 P1-01 docs clarification (2026-11-02):** F02 and F04 require strict-mode recovery of pre-existing WEB4 `schemaVersion: 1` `DISPATCHED/UNKNOWN` records through the backend's protected read-only legacy v1 status path, never legacy POST/PUT. Gates F5-COMP-03/04 and F5-RES-14 are PLANNED / NOT RUN; no implementation or frontend tests executed by this documentation correction.

**Review vòng 3 — docs-only correction (2026-11-02):** protected status follows original immutable operation kind (Create/Update Write, Post Post), not general Read. Denied Read with original Write/Post allowed is a positive result; revoked original grant denies. F5-COMP-03/04 and F5-RES-14 are strict-only, marked `NOT_APPLICABLE` for additive with ADR explanation. Acceptance table is now continuous. F01–F05 remain PLANNED / NOT RUN.

| Owner | Current state | Future actual evidence |
|---|---|---|
| F01 source/contract checkpoint and crash semantics | PLANNED | `YYYYMMDD-f01-source.md` |
| F02 terminal-negative client and gated manual resend | PLANNED | `YYYYMMDD-f02-resolution.md` |
| F03 native browser and CI acceptance | PLANNED | `YYYYMMDD-f03-browser-ci.md` |
| F04 real full IIS + SQL/Edge/Chromium + attended | PLANNED | `YYYYMMDD-f04-iis-attended.md` |
| F05 release handoff/Owner decision | PLANNED | `YYYYMMDD-f05-release.md` |

[Own task plan](../../plans/20261102-001-web5-operational-safety-web.md) · [UX design](../../design/WEB5_RECOVERY_AND_RELEASE_BOUNDARIES.md) · [acceptance](../../development/WEB5_WEB_ACCEPTANCE.md) · [Codex handoff](../../development/WEB5_CODEX_HANDOFF.md) · [WEB4 historical evidence](../web4/README.md). Historical 1,218 unit/196 Chromium and 11+11 IIS Express/SQL browser cases remain WEB4 candidate evidence, NOT rerun WEB5 PASS. New results require exact candidate, runner, discovered/executed counts, cleanup, negative/safety proofs and separate Owner acceptance.
