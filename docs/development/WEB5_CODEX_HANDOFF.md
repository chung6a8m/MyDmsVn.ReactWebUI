# Codex handoff — Roadmap 05 ReactWebUI

**2026-11-03 disposition:** PR #28 merged F04 `DONE (bounded) / OWNER-ACCEPTED EXCEPTIONS`; PR #29 merged the initial F05 preparation. F05 is now `DONE (bounded handoff)` with the explicit decision `STAGING NOT ACCEPTED / PRODUCTION NO-GO / DEFERRED`. Full IIS and unperformed Narrator are `OWNER_ACCEPTED_EXCEPTION / NOT RUN`. The selected direct same-origin IIS Express topology has no reverse proxy, therefore trusted-proxy deployment/topology testing is `NOT_APPLICABLE`; direct-host forwarded-header spoof rejection remains applicable. Do not repeat F04/F05 wholesale. Only separately selected backend B05/B06 evidence or a new release candidate may change this disposition. Host ownership blocks workload/cutover; two SQL allocations/manifests remain quarantined; B03/B06 are incomplete. Same-key resend remains disabled and roadmap archive/closure is not authorized. [F04 evidence](../evidence/web5/20261103-f04-iis-express-progress.md) · [final F05 dossier](../evidence/web5/20261103-f05-release-handoff.md).

**Roadmap selected 2026-11-02; WEB5-01 / F01 DONE (bounded); F02 DONE (bounded) / VERIFIED NONPRODUCTION; F03 DONE (bounded) / VERIFIED NONPRODUCTION; F04 DONE (bounded) / OWNER-ACCEPTED EXCEPTIONS; F05 DONE (bounded handoff) / PRODUCTION NO-GO-DEFERRED.** [F01 closeout and immutable backend pins](../evidence/web5/20261102-web5-01-closeout.md). B01 and B04-A are merged; ADR0015 selects additive compatibility and schema013 direction and agrees F01 consumer semantics. Owner subsequently authorized B02/B04-B. Current [F02 terminal evidence](../evidence/web5/20261102-f02-terminal-resolution.md) pins backend `2d727002`, exact web5-resolution-v1/schema13, source hosted B04-B 167/167 PASS, port `b017da6` and core `5580755`. Backend final-head SQL/SQL-free checks PASS. F02 bounded technical verification consumes paired identical-source Chromium 275/275, focused Edge 125/125 and current actual SQL bridge PASS. Exact-head CI and merge disposition are recorded in the delivery PR before acceptance/merge. Do not repeat completed implementation or infer production approval. Read [AGENTS](../../AGENTS.md) → [current selector](../plans/README.md) → [owning plan](../plans/20261102-001-web5-operational-safety-web.md) → [recovery/UX design](../design/WEB5_RECOVERY_AND_RELEASE_BOUNDARIES.md) → [acceptance](WEB5_WEB_ACCEPTANCE.md), [test policy](../TEST_POLICY.md), [WEB4 user guide with WEB5 supplement](WEB4_USER_RECOVERY_GUIDE.md), actual `src`/`tests` and latest main. Backend's separately reviewed B02 versioned contract must be published and read before any future decoder change; the semantic ADR is not that wire contract.

[F03 browser/integration evidence](../evidence/web5/20261102-f03-browser-acceptance.md) records the completed bounded technical scope: 1,397 units, full Chromium 275, focused Edge 125 across nine specs, build/typecheck/artifact 1 and current actual-port integration (1 .NET wrapper + 1 Vitest) PASS. All four established F02 review findings are fixed and independently approved. Exact-head CI and merge disposition are recorded in the delivery PR before acceptance/merge; these local results do not claim future hosted CI PASS. F04 and F05 are closed only in their bounded dispositions; full IIS, attended Narrator, B03 CLI rehearsal, resend and production approval remain separate.

## Sequence for separate frontend PRs

| Suggested branch | Scope | Gate |
|---|---|---|
| `codex/web5-f01-source-recovery-checkpoint` | DONE bounded: source mapping, merged B01/B04-A, ADR0015 consumer agreement | [Closeout](../evidence/web5/20261102-web5-01-closeout.md); no resend |
| `codex/web5-f02-terminal-recovery-ux` | Implemented strict v2 resolution, atomic negative/raw preservation, fresh lineage/adoption, explicit Create intent and existing baseline review | [Terminal evidence](../evidence/web5/20261102-f02-terminal-resolution.md); bounded technical verification complete; exact-head CI/merge in [PR #26](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/26); [fallback evidence](../evidence/web5/20261102-f02-operator-metadata.md) historical; resend Owner gate separate |
| `codex/web5-f03-browser-acceptance` | DONE (bounded) / VERIFIED NONPRODUCTION: native Chromium/Edge IDB, regression and backend SQL bridge | [F03 evidence](../evidence/web5/20261102-f03-browser-acceptance.md); exact-head CI and merge disposition in the delivery PR before acceptance/merge |
| `codex/web5-f04-iis-express-acceptance` | MERGED PR #28; bounded actual IIS Express/browser/SQL evidence and explicit exceptions | Does not supply B05 completion or production/full-stage evidence |
| `codex/web5-f05-release-handoff` + finalization | DONE bounded: user/support guide, supported/unsupported matrix and exact-provenance `NO-GO / DEFERRED` dossier | Records incomplete B03/B05/B06 instead of inventing acceptance; no production or archive authorization |

All PRs target main, isolated current-head worktrees, small owned change sets and exact dated evidence. F02 acceptance requires B5-NEG-08 full six-command/two-order SQL proof and B04-B protected CI. F05 reports operator BUSINESS case closure separately from client editable recovery; neither proves production GO. Rebase/correct links after companion backend PR merge. Keep Tailwind v4/Nova/Base UI defaults, AG Grid Community, Dockview, Floating UI and feature-owned Zustand. Preserve WEB4 canonical fingerprints/ports, actor+epoch+generation fencing, local draft raw values, original line identities and no fake Lab production.

## Copy-ready task prompt

~~~text
Implement only selected WEB5 frontend Fxx. Read docs/plans/README.md,
docs/plans/20261102-001-web5-operational-safety-web.md,
docs/design/WEB5_RECOVERY_AND_RELEASE_BOUNDARIES.md,
docs/development/WEB5_WEB_ACCEPTANCE.md, docs/TEST_POLICY.md
and currently implemented source/tests; start fresh current main isolated branch.
Pin the actual reviewed backend source and exact authoritative contract; preserve the 48 WEB4 blobs.
Backend merge/final provenance remains a delivery gate; candidate checks do not imply merge.
B01 and backend B04-A can run in parallel; B02 implementation waits for B04-A.
F02 implementation now consumes backend `2d727002` plus its source B04-B PASS under additive ADR0015. F02 technical scope is DONE (bounded), with paired identical-source browser/SQL-bridge evidence. Exact-head CI and merge disposition are recorded in the delivery PR before acceptance/merge. Do not repeat implemented work. Retain the prior fallback as historical evidence. If backend authority is unavailable, keep protected behavior: no local certificate alone, no HTTP fallback from cached local retry, no automatic replay or status-error unlock. Original Create/Update Write or Post grant (even with denied ordinary Read) authorizes protected original status; revoked original Write/Post denies. Strict-only B5-COMP-03/04/F5-COMP-03/04/F5-RES-14 are `NOT_APPLICABLE` under additive, not PASS or skipped required tests. Strict must block legacy POST/PUT while preserving original COMMITTED status readback and safe client-side schema-v1 restoration.
F05 is DONE only as a bounded handoff with NO-GO / DEFERRED; do not reopen it or repeat F04 from this prompt.
The following are retained future gates and require a separately selected task/exact candidate:
COMMITTED-result-expired operator workflow, local case archival, live cached old client/new IIS cutover,
and measured p95/p99/RPO/RTO against Owner-selected numeric gates. They are not current instructions,
and no version header, production SLA, operator command or support-case closure may be invented.
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
Only if a new Owner-selected technical scope changes these boundaries: implement narrowly, test RED→GREEN,
run the applicable unit/native browser/artifact/approved SQL-host gates, and record exact SHA/counts/cleanup.
Do not deploy, claim full IIS from IIS Express, send workload traffic to an unverified host,
or clean quarantined SQL resources without exact ownership, quiescence and authority.
~~~

## Delivery evidence/checklist

Record exact source and dev/test changes, contract/version compatibility, wrong actor/epoch/permission/revocation and no replay assertions; source->IDB transaction complete->HTTP->SQL->recovery lifecycle; invalid raw/IME/focus and two-tab conflict tests; authentic browser and SQL ownership separate; current PR CI and actual Edge; no tokens/cookies/raw credential traces. Independent reviewer reports P0/P1/P2, exact remaining gates, case statuses. Update owning plan only for reviewed verified task, not from task dispatch. Docs-only activation checks internal links, encoding and Markdown diff; it runs no browser/SQL tests.
