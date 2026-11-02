# Codex handoff — Roadmap 05 ReactWebUI

**Roadmap selected 2026-11-02; F01–F05 PLANNED/NOT RUN.** Read [AGENTS](../../AGENTS.md) → [current selector](../plans/README.md) → [owning plan](../plans/20261102-001-web5-operational-safety-web.md) → [recovery/UX design](../design/WEB5_RECOVERY_AND_RELEASE_BOUNDARIES.md) → [acceptance](WEB5_WEB_ACCEPTANCE.md), [test policy](../TEST_POLICY.md), [WEB4 original user guide](WEB4_USER_RECOVERY_GUIDE.md), actual `src`/`tests` and latest main. Backend's separately reviewed B02 versioned contract must be read rather than guessed.

## Sequence for separate frontend PRs

| Suggested branch | Scope | Gate |
|---|---|---|
| `codex/web5-f01-source-recovery-checkpoint` | Actual WEB4 source/state mapping, B01 proof consumer decision and focused no-unsafe-retry tests | B01 externally proven; no product resend |
| `codex/web5-f02-terminal-recovery-ux` | Versioned resolution port, IDB state and operator UX; conditional same-key manual confirm | Backend B02 durable tombstone and Owner resend gate |
| `codex/web5-f03-browser-ci` | Real native Chromium/Edge IDB and full frontend regression + backend SQL bridge handoff | B04 protected SQL lane and accepted F02 contract |
| `codex/web5-f04-full-iis-acceptance` | Real IIS staged browser/SQL and attended Telex/VNI/Narrator | Backend B05 full IIS/SQL/security readiness |
| `codex/web5-f05-release-handoff` | Source-backed guide, exact release candidate and support/Owner decision | B06 paired release evidence |

All PRs target main, isolated current-head worktrees, small owned change sets and exact dated evidence. Rebase/correct links after companion backend PR merge. Keep Tailwind v4/Nova/Base UI defaults, AG Grid Community, Dockview, Floating UI and feature-owned Zustand. Preserve WEB4 canonical fingerprints/ports, actor+epoch+generation fencing, local draft raw values, original line identities and no fake Lab production.

## Copy-ready task prompt

~~~text
Implement only selected WEB5 frontend Fxx. Read docs/plans/README.md,
docs/plans/20261102-001-web5-operational-safety-web.md,
docs/design/WEB5_RECOVERY_AND_RELEASE_BOUNDARIES.md,
docs/development/WEB5_WEB_ACCEPTANCE.md, docs/TEST_POLICY.md
and currently implemented source/tests; start fresh current main isolated branch.
Pin B01/B02 backend actual merged source, exact authoritative contract and 48 blob corpus.
Do not infer NOT_EXECUTED from absent status, HTTP404 or expired result.
Keep UNKNOWN safe, same-key resend OFF until real process-crash and SQL terminal
proof + explicit Owner gate. No automatic replay, no new-key retry of unknown.
Implement narrow strict consumer/state/CAS changes, test RED→GREEN,
run actual unit, native Chromium/Edge, artifact and approved SQL/host boundaries.
Record exact SHA and actual executed/passed/failed/skipped per runner,
cleanups, separate mock versus SQL, sanitized screenshots and review findings.
Open narrow PR to main; don't deploy or claim full IIS from IIS Express.
~~~

## Delivery evidence/checklist

Record exact source and dev/test changes, contract/version compatibility, wrong actor/epoch/permission/revocation and no replay assertions; source->IDB transaction complete->HTTP->SQL->recovery lifecycle; invalid raw/IME/focus and two-tab conflict tests; authentic browser and SQL ownership separate; current PR CI and actual Edge; no tokens/cookies/raw credential traces. Independent reviewer reports P0/P1/P2, exact remaining gates, case statuses. Update owning plan only for reviewed verified task, not from task dispatch. Docs-only activation checks internal links, encoding and Markdown diff; it runs no browser/SQL tests.
