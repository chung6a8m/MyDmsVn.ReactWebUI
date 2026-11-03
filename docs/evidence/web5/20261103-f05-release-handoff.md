# WEB5-05 — Release handoff preparation (2026-11-03)

**Status: HANDOFF IN PROGRESS / STAGING NOT ACCEPTED / PRODUCTION NO-GO-DEFERRED.** This is a reviewable bounded dossier, not B06 final evidence or a production release candidate. The Owner has selected F05 and amended the bounded topology; that does not approve production, same-key resend or roadmap closure. B05 remains in progress/not accepted, B03/B06 are incomplete, and there is no exact final paired release candidate. `NO-GO / DEFERRED` is therefore the only safe release disposition for the currently available evidence; a later named Owner decision on an exact candidate is still required for any promotion.

## Owner amendment classification

| Item | Disposition |
|---|---|
| Full IIS | `OWNER_ACCEPTED_EXCEPTION / NOT RUN` for bounded nonproduction IIS Express; retained as a historical production/full-stage gate |
| Narrator steps not performed, including UNKNOWN recovery | `OWNER_ACCEPTED_EXCEPTION / NOT RUN`; no accessibility PASS inferred |
| Trusted reverse-proxy deployment/topology testing | `NOT_APPLICABLE`; selected topology is direct same-origin IIS Express with no proxy |
| Direct-host forwarded-header spoof rejection and JWT/cookie/CSRF/Origin/CSP | Applicable; must be evidenced independently |
| Workload/cutover | `BLOCKED / NOT RUN` until host ownership is verified without relying only on PID 4 or an unverified endpoint |
| Two earlier SQL allocation/manifest cleanups | `BLOCKED`; retain quarantine until exact ownership, stable quiescence and valid authority are proven |
| Full-stage/production, service targets and B06 decision | `DEFERRED`; current production disposition `NO-GO` |

## Provenance and evidence

| Item | Recorded state |
|---|---|
| Frontend starting main | `ea32ed74ea704d8bc5a60f5387801b25f7d9804d`, tree `721a97ae168075819892070003b3e6ecf7798d8a`; F04 delivery PR #28 merged. This is not an acceptance run for this F05 documentation branch. |
| Frontend lock | `package-lock.json` SHA-256 `283593a2d944b2031ce57c8c8a59f18755e51b25ab6767571ef3ffdd341f55e9` at starting main. Final release lock and exact asset manifest/hashes: **NOT ESTABLISHED**. |
| Backend observed main | `6f51dfffb38a58ecd380efe61dd2fbc89647bc58` (PR #92 merged); this is not a paired release candidate or evidence that B05 was accepted. Final B06 source/tree/lock and package manifest: **NOT ESTABLISHED**. |
| Backend independent security follow-up | Tested source `e1804769c3406d871c034dd19b855d96bb1d88be`, tree `4e6b18a505d62665147f03caf1d32eb063cadd79`; evidence-only follow-up head `f1846db` in [PR #94](https://github.com/chung6a8m/MyDmsVn/pull/94), based on `6f51dff`. It records a deliberate 2-case mutation RED, focused 65/65 and complete HttpHost.Tests 554/554 SQL-free PASS in [candidate evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web5-b05-independent-security/docs/evidence/web5/20261103-b05-independent-security.md). Production runtime source is unchanged; PR/CI/merge remain separate and this is not IIS Express, B05 acceptance or a paired release candidate. |
| Contract | ADR0015 additive compatibility, schema 13, `web5-resolution-v1`; F02 pins exact corpus and backend implementation in [F02 evidence](20261102-f02-terminal-resolution.md). Deployment mode, schema verification, service principal and grants for a final candidate: **NOT ESTABLISHED**. |
| F01–F03 | [F01](20261102-web5-01-closeout.md), [F02](20261102-f02-terminal-resolution.md), [F03](20261102-f03-browser-acceptance.md): bounded evidence on their stated candidate pins; consult their actual counts and limits. Do not transfer results to another candidate. |
| F04 / B05 | [F04](20261103-f04-iis-express-progress.md) records Owner-accepted IIS Express exceptions. Paired original-first checkpoint: frontend `b6513033bd8c86389a733dbd2c56fec035fedaf0`, backend fixture `aa144289e4f91bcb4cb73af40554d6e83ce9144c`, 14/14 browser plus 1/1 SQL-oracle wrapper in each of Chromium and Edge. Published host DLL was built from `68cf49e5c16811f2777d271808488d70ba7b66cb`, SHA-256 `aa65e68c9d39ed97d43626d7f53d4d5c1fe989313d8500766b35eeb0244284f5`, not the fixture commit. Earlier two database/manifest quarantines remain retained. This is not full IIS or final-head evidence. [Backend B05 evidence](https://github.com/chung6a8m/MyDmsVn/blob/6f51dfffb38a58ecd380efe61dd2fbc89647bc58/docs/evidence/web5/20261103-b05-iis-express-wip.md). |
| Backend B01–B04 | Refer to [backend evidence index](https://github.com/chung6a8m/MyDmsVn/blob/6f51dfffb38a58ecd380efe61dd2fbc89647bc58/docs/evidence/web5/README.md) for exact source and individual gates; B04-B source `2d727002` has 167/167 reported SQL checks. B03 operator CLI and rehearsal remain **NOT RUN**. |
| B06 final dossier | **PLANNED / NOT RUN**; exact paired candidate, independent review, final assets and Owner decision remain outstanding. |

## Release register — target versus actual

No numeric target has been approved in this dossier. The following must be paired with B06's Owner-approved targets and candidate-specific actuals before a release decision; blank values are not a pass.

| Measure or gate | Approved target | Actual / disposition |
|---|---|---|
| Full IIS W3SVC/WAS and host identity | Not supplied | **OWNER_ACCEPTED_EXCEPTION / NOT RUN** for bounded scope; future full-stage gate remains deferred. |
| Reverse-proxy deployment/topology | Direct topology; no proxy | **NOT_APPLICABLE**. Direct-host supplied-forwarded-header rejection remains applicable. |
| Direct-host security, audit and limiter | Existing contract; final target not supplied | JWT/cookie/CSRF/Origin/CSP/mode/schema controls require exact-candidate evidence; single-worker limiter/audit remain independently applicable. |
| SQL-free direct-host source verification | Reject all forwarded authority; preserve HSTS/CSP/auth boundaries | Backend PR #94 candidate reports focused 65/65 and complete HttpHost.Tests 554/554 PASS; no IIS listener, SQL, audit-retention or workload claim. |
| Cached old/new client, pending UNKNOWN and rollback matrix | Not supplied | **NOT RUN** on deployed hosts. |
| Mixed workload p50/p95/p99 per command, errors/timeouts, throughput, concurrency and worker/SQL saturation | Not supplied | **BLOCKED / NOT RUN** on verified host ownership. |
| Journal/compaction growth, alert response and UNKNOWN queue age | Not supplied | **NOT RUN**. |
| Backup, restore, service RPO and RTO | Not supplied | Service RPO/RTO **NOT RUN**. A single fixture backup/restore observation in F04 is not a service measurement. |
| Retention and audit operation | Not supplied | Final deployed policy and operational verification **NOT ESTABLISHED**. Seven-day original-result window is not a recovery SLA. |
| Attended input and Narrator | Candidate-specific acceptance | F04 records limited self-reported observations; unperformed Narrator steps are **OWNER_ACCEPTED_EXCEPTION / NOT RUN**. |
| B03 operations and B06 final paired dossier | Applicable runbook and reviewed evidence | **NOT RUN / NOT AVAILABLE**. |

CEX WinForms remains independently active; this work grants it no new approval or change. Browser access tokens in localStorage retain the known XSS exposure; refresh credentials are HttpOnly/Secure/SameSite=Strict cookies. Final deployed CSP, origin/CSRF, permissions, retention and operational controls require their own verified evidence; browser storage is not a secure place for credentials or unredacted support exports.

## Support disposition

See the [user recovery guide](../../development/WEB4_USER_RECOVERY_GUIDE.md) for the implemented steps. Record only sanitized correlation/operation identifiers and epoch through an approved support channel; do not collect JWTs, cookies, passwords, raw payloads or browser storage. Preserve the local protected intent and escalate to the authorized backend operations owner. Do not use DevTools to edit state, delete journal records, or resend with a new key to work around UNKNOWN. No delivered production operator CLI or local archive is claimed here.

| Case | Support interpretation and client boundary |
|---|---|
| COMMITTED with original result available | Authorized protected status may recover the exact original result; normal settlement requires its identity and local checks. |
| BUSINESS_COMMITTED_RESULT_UNAVAILABLE | Business case can be tracked and closed through an operator-confirmed support ticket if that process exists. Ticket closure is not client settlement: intent remains PROTECTED, no inferred version or edit unlock. After the seven-day original-result window escalate; no assumption of rollback. |
| INDETERMINATE, status 404, timeout, denied or expired | Remains UNKNOWN/protected; absence of a result is not proof of rollback or authorization to resend. |
| Durable NOT_EXECUTED | Only fresh authorized matching proof and atomic local CAS can release the original lock. Review fresh baseline/capability and separately consent to any new intent; never automatically retry. |

Optional local case/draft archival requires a separate Owner-approved policy, explicit user consent, matching actor/epoch/operation/CAS, durable minimal ticket link, warning and tests. It is **NOT IMPLEMENTED / NOT APPROVED**; it is neither business deletion nor edit unlock.

## Decision record and remaining work

- Final frontend/backend candidate source/tree, assets, package locks, mode/schema/principal and B06 dossier: **PENDING / DEFERRED**.
- Full IIS and unperformed Narrator: **OWNER_ACCEPTED_EXCEPTION / NOT RUN**. Reverse-proxy topology: **NOT_APPLICABLE**. These classifications do not transfer to other gates.
- Host ownership, cutover/workload and quarantine cleanup: **BLOCKED**. Retention/audit/limiter, service recovery measurements and B03 rehearsal remain **NOT RUN / INCOMPLETE**.
- Owner target-versus-actual and residual-risk review: **PENDING**.
- Current evidence disposition: **STAGING NOT ACCEPTED / PRODUCTION NO-GO-DEFERRED**. This is not a later `PRODUCTION GO` decision; do not infer promotion from F04 acceptance, a merge or CI.
- Roadmap archive/closure: **NOT AUTHORIZED**. Retain execution plans and evidence until the required explicit disposition.

## F05 documentation verification

This preparation changes documentation only. Fresh diff/link/encoding checks and independent P0/P1/P2 review are recorded in the delivery PR before acceptance. No browser, SQL, full IIS, attended operation or runtime verification is claimed by this documentation preparation.
