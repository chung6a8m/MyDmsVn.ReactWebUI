# WEB2 HTTP/JWT + Sales end-to-end — closeout archive (2026-11-01)

**Decision: COMPLETED — OWNER_ACCEPTED_EXCEPTION (2026-11-01).** The Owner explicitly accepted **the final blocked full-IIS deployment-acceptance gate** as a bounded exception after reviewing WEB2-10. This closes **Roadmap 02 execution**, **not** full IIS validation or production deployment. See the [frozen execution plan](plans/20261031-002-http-jwt-sales-vertical-slice.md), [WEB2 evidence](../../evidence/20261031-web2-http-jwt-sales.md#2026-11-01--owner-closeout-and-full-iis-exception) and [current plan selector](../../plans/README.md).

## Preserved acceptance decision

| Scope | Final disposition |
|---|---|
| WEB2-01–WEB2-09 | **DONE (bounded)**, per original task-specific contract, .NET/SQL and frontend automated-HTTP evidence |
| WEB2-10 | **DONE in the tested IIS Express/HTTPS + real SQL + Chromium/Edge pilot scope; full IIS = OWNER_ACCEPTED_EXCEPTION / NOT RUN** |
| Roadmap 02 | **COMPLETED WITH OWNER-ACCEPTED EXCEPTION**; no new WEB2 tasks selected |
| Production release, full IIS | **NOT APPROVED / NOT VERIFIED**; acceptance decision does not certify IIS app pool/ACL/binding/TLS, operational audit retention, proxy/multiworker controls or deployment readiness |

**Inspected before closeout:** web `main@1d75917f7a3f7e4ae7a891bd242b2d9bb70c9b11` ([PR #10](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/10)), backend `main@6a62a98993e698c3baf146e30200f754db3cb37f` ([PR #72](https://github.com/chung6a8m/MyDmsVn/pull/72)). The WEB2-10 verified source/test candidate was web `36c1bca80e02ea3f42ecf08578072d68ddd6e6de` and backend `9480d1b79c012b50aff725612989c7dc861b2973`. The main merge SHAs represent the reviewed merged state; this documentation closeout does not rerun its tests.

## Runtime evidence preserved, not upgraded

- Frontend: **245/245 unit/component**, **91/91 Chromium regression**, **1/1 production-artifact isolation** PASS.
- Backend: **325/325 selected .NET rows** PASS, including HTTP/JWT/CSRF, bounded SQL security/migration, published host smoke and two browser wrappers; **16/16 live browser cases** (8 Chromium + 8 Edge) separately PASS.
- Pilot: actual **net48 System.Web hosted under IIS Express HTTPS**, deployed production SPA, restricted SQL Server non-production schema11, real cookie/JWT/permission/Sales Create/Update/Post/unknown-recovery and independent SQL stock/value/COGS/ledger oracle. It is **not a full IIS/WAS/W3SVC deployment test**. A dropped response was injected after the real backend committed, not a physical network-loss test.
- React fake WEB-01–WEB-08 historical evidence, backend Local/desktop tests and unrelated WinForms CEX are separate; do not propagate PASS/approval between scopes.

## Explicitly retained limitations

1. **Accepted exception (the only waived WEB2-10 gate):** full IIS deployment acceptance **NOT RUN** because the candidate Windows Home environment lacks W3SVC/WAS/appcmd. This is **not** marked PASS and does **not** authorize a production rollout.
2. **Deferred verification/operation, not waived as PASS:** IIS app-pool identity, real deployment ACL/bindings/TLS, operator audit sink/destination/retention, distributed/multiworker abuse policy, candidate-specific attended IME/Narrator and broader cross-site/browser security matrix. Verify independently before a production deployment where applicable.
3. **Design risks remain:** JWT access in localStorage can be exfiltrated by XSS despite CSP; draft/unknown mutation context is memory-only across page reload; no backend idempotency/recovery journal; no mixed desktop/schema11 writer rollout approval.

## Archive and future-work rules

- The [frozen plan](plans/20261031-002-http-jwt-sales-vertical-slice.md) preserves original implementation instructions/status prose as **historical** with links rebased; its `WEB2-10 IN_PROGRESS` statements describe **2026-10-31**, superseded **for roadmap disposition only** by this dated Owner decision.
- The [former plan URL](../../plans/20261031-002-http-jwt-sales-vertical-slice.md) is a compatibility/heading-anchor page. Technical source of truth stays in [frontend integration design](../../design/WEB2_FRONTEND_INTEGRATION.md), [backend HTTP contract](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB2_HTTP_AUTH_AND_WIRE_CONTRACT.md) and [pilot runbook](../../development/WEB2_PILOT_RUNBOOK.md). Historical [execution handoff](../../development/WEB2_CODEX_HANDOFF.md) is **not an active Codex task queue**.
- [Evidence](../../evidence/20261031-web2-http-jwt-sales.md) stays at its original path: append the Owner decision without rewriting observed commands/failures or treating skipped full-IIS/attended steps as PASS.
- Any further Web module, production rollout, full-IIS verification or durable recovery needs a **new Owner-selected plan** and new evidence. No source, tests, dependencies, DB, secrets or deployment resources change in this docs-only archive.
