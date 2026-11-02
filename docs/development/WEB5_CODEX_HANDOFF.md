# Codex handoff — Roadmap 05 ReactWebUI

**Roadmap selected 2026-11-02; F01–F05 PLANNED/NOT RUN.** Read [AGENTS](../../AGENTS.md) → [current selector](../plans/README.md) → [owning plan](../plans/20261102-001-web5-operational-safety-web.md) → [recovery/UX design](../design/WEB5_RECOVERY_AND_RELEASE_BOUNDARIES.md) → [acceptance](WEB5_WEB_ACCEPTANCE.md), [test policy](../TEST_POLICY.md), [WEB4 original user guide](WEB4_USER_RECOVERY_GUIDE.md), actual `src`/`tests` and latest main. Backend's separately reviewed B02 versioned contract must be read rather than guessed.

## Sequence for separate frontend PRs

| Suggested branch | Scope | Gate |
|---|---|---|
| `codex/web5-f01-source-recovery-checkpoint` | Source mapping, B01 crash context, additive/strict old-client requirements | B01 and B04-A can proceed in parallel; no resend |
| `codex/web5-f02-terminal-recovery-ux` | Versioned resolution port, legacy v1 recovery under **original Write/Post even if ordinary Read denied**, IDB/CAS, positive/negative UX | Backend B02+B04-B applicable gates; B5-COMP-03/04 strict only; Owner resend separate |
| `codex/web5-f03-browser-ci` | Native Chromium/Edge IDB, regression and backend SQL bridge; separate UI and SQL evidence | B04-A/B protected lane and accepted F02 |
| `codex/web5-f04-full-iis-acceptance` | Actual IIS, cached old/new client, SQL oracle, performance/RPO/RTO baseline, attended IME/Narrator | Backend B05 full IIS/security and chosen B02 protocol |
| `codex/web5-f05-release-handoff` | Positive case closure, recovery guide, measured threshold/Owner decision dossier | B06 paired evidence and approved targets |

All PRs target main, isolated current-head worktrees, small owned change sets and exact dated evidence. F02 acceptance requires B5-NEG-08 full six-command/two-order SQL proof and B04-B protected CI. F05 reports operator BUSINESS case closure separately from client editable recovery; neither proves production GO. Rebase/correct links after companion backend PR merge. Keep Tailwind v4/Nova/Base UI defaults, AG Grid Community, Dockview, Floating UI and feature-owned Zustand. Preserve WEB4 canonical fingerprints/ports, actor+epoch+generation fencing, local draft raw values, original line identities and no fake Lab production.

## Copy-ready task prompt

~~~text
Implement only selected WEB5 frontend Fxx. Read docs/plans/README.md,
docs/plans/20261102-001-web5-operational-safety-web.md,
docs/design/WEB5_RECOVERY_AND_RELEASE_BOUNDARIES.md,
docs/development/WEB5_WEB_ACCEPTANCE.md, docs/TEST_POLICY.md
and currently implemented source/tests; start fresh current main isolated branch.
Pin B01/B02 backend actual merged source, exact authoritative contract and 48 blob corpus.
B01 and backend B04-A can run in parallel; B02 implementation waits for B04-A.
F02 implementation waits for B02+B04-B acceptance and chosen additive policy OR strict policy with an explicit authorized recovery-only read of prior WEB4 v1 immutable intents. Original Create/Update Write or Post grant (even with denied ordinary Read) authorizes protected original status; revoked original Write/Post denies. Strict-only B5-COMP-03/04/F5-COMP-03/04/F5-RES-14 are `NOT_APPLICABLE` under additive, not PASS or skipped required tests. Strict must block legacy POST/PUT while preserving original COMMITTED status readback and safe client-side schema-v1 restoration.
Implement COMMITTED-result-expired support closure WITHOUT client edit unlock or automatic replay;
approve any local case archival separately, with CAS/permission/retention tests.
F04 must test live cached old client against new IIS backend and measured p95/p99/RPO/RTO
against Owner-selected numeric gates; do not invent a version header or a production SLA.
Do not infer NOT_EXECUTED from absent status, HTTP404 or expired result.
Keep UNKNOWN safe, same-key resend OFF until real process-crash and SQL terminal
proof + explicit Owner gate. No automatic replay, no new-key retry of unknown.
Inspect operationsContext.ts literal web4-v1, web4OperationCodec.ts frozen v1, and
web4OperationRepository.ts DISPATCHED/checkpoint before changing context/migration.
New client must recover pre-cutover v1 UNKNOWN under new context via B02 read-only status,
rehash with original WEB4 codec, preserve original result and IDB atomics, never resend.
Use stored original Create/Update Write or Post grant: denied Read + original grant is POSITIVE,
revoked original grant is NEGATIVE. Sales Post includes original version, Receipt Post has none.
Test positive/absent/expired/forbidden/corrupt/epoch-shift/IDB crash in Chromium+Edge.
Implement narrow strict consumer/state/CAS changes, test RED→GREEN,
run actual unit, native Chromium/Edge, artifact and approved SQL/host boundaries.
Record exact SHA and actual executed/passed/failed/skipped per runner,
cleanups, separate mock versus SQL, sanitized screenshots and review findings.
Open narrow PR to main; don't deploy or claim full IIS from IIS Express.
~~~

## Delivery evidence/checklist

Record exact source and dev/test changes, contract/version compatibility, wrong actor/epoch/permission/revocation and no replay assertions; source->IDB transaction complete->HTTP->SQL->recovery lifecycle; invalid raw/IME/focus and two-tab conflict tests; authentic browser and SQL ownership separate; current PR CI and actual Edge; no tokens/cookies/raw credential traces. Independent reviewer reports P0/P1/P2, exact remaining gates, case statuses. Update owning plan only for reviewed verified task, not from task dispatch. Docs-only activation checks internal links, encoding and Markdown diff; it runs no browser/SQL tests.
