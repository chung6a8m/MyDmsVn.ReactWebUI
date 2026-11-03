# Roadmap selector — MyDmsVn.ReactWebUI

## Archived Roadmap 05 — Operational Safety & Production Readiness (2026-11-03)

**OWNER-DIRECTED EXECUTION CLOSEOUT: CLOSED / ARCHIVED — BOUNDED IMPLEMENTATION; PRODUCTION READINESS DEFERRED / NO-GO.** [Archive decision](../archive/20261103-web5-bounded-closeout/README.md) · [frozen frontend plan](../archive/20261103-web5-bounded-closeout/plans/20261102-001-web5-operational-safety-web.md) · [former heading anchors](20261102-001-web5-operational-safety-web.md) · [final closeout evidence](../evidence/web5/20261103-web5-roadmap-closeout.md) · [F05 release handoff](../evidence/web5/20261103-f05-release-handoff.md) · [backend companion archive](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/archive/20261103-web5-bounded-closeout/README.md).

Frontend F01–F05 **DONE in their bounded scopes**: F01 source/contract, F02 terminal-resolution UX, F03 nonproduction browser/SQL bridge, F04 IIS Express bounded acceptance with Owner-accepted NOT RUN exceptions, F05 documentation-only release handoff ([PR #30](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/30) merged). **F5-REL-05 NOT RUN / UNSATISFIED**: no approved B06 thresholds or final paired production candidate. Backend B01/B02/B04 A+B bounded DONE; B03 NOT RUN/INCOMPLETE, B05 PARTIAL/NOT ACCEPTED (B05-A owned-host admission [PR #95](https://github.com/chung6a8m/MyDmsVn/pull/95) merged), B06 NOT RUN/DEFERRED.

**STAGING NOT ACCEPTED / PRODUCTION NO-GO / DEFERRED; same-key resend DISABLED.** Full IIS/unperformed Narrator `OWNER_ACCEPTED_EXCEPTION / NOT RUN`; direct reverse-proxy topology `NOT_APPLICABLE`; direct-host spoof rejection applicable. Two earlier SQL database/manifests QUARANTINED/BLOCKED. Workload/cutover, limiter/audit and service recovery/RPO/RTO remain NOT RUN. This archive closes only the WEB5 execution queue, not remaining production requirements; subsequent work requires a new Owner-selected plan. WEB1–04 evidence and backend CEX remain unchanged.

## Archived Roadmap 04 — Web Reliability & Delivery Foundation

[Archive disposition](../archive/20261102-web4-reliability/README.md) · [frozen owning plan](../archive/20261102-web4-reliability/plans/20261101-002-web4-reliability-web.md) · [former plan compatibility anchors](20261101-002-web4-reliability-web.md) · [F05 Owner acceptance/evidence](../evidence/web4/20261102-f05-operator-handoff.md) · [backend companion archive](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/archive/20261102-web4-reliability/README.md).

Owner accepted recorded WEB4-06 scope/limits and authorized frontend PR #22/backend #85 merge after final CI PASS/review and subsequent archive. [User guide](../development/WEB4_USER_RECOVERY_GUIDE.md), [draft/recovery design](../design/WEB4_DURABLE_DRAFT_AND_RECOVERY.md), [acceptance matrix](../development/WEB4_WEB_ACCEPTANCE.md), [historical handoff](../development/WEB4_CODEX_HANDOFF.md) and [evidence index](../evidence/web4/README.md) remain references, not execution queues. Keep the existing canonical contract, durable intent and no-auto-replay boundaries. Same-key resend/operator unlock, crash/Commit proof, operator rehearsal/tooling, full IIS/production, production audit retention/distributed limiter and attended candidate tests remain unapproved or unverified.

## Archived Roadmap 03 — Goods Receipt & Inventory Web Integration

- [Archive and final disposition](../archive/20261101-web3-goods-receipt-inventory/README.md) · [frozen owning plan](../archive/20261101-web3-goods-receipt-inventory/plans/20261101-001-web3-goods-receipt-inventory-web.md) · [former plan compatibility anchors](20261101-001-web3-goods-receipt-inventory-web.md) · [unchanged WEB3 evidence](../evidence/web3/README.md). Owner accepted WEB3-06 scope/limits and frontend PR #17 / backend PR #78 merged on 2026-11-01.
- [Workspace design](../design/WEB3_MULTI_MODULE_WORKSPACE.md), [Receipt/Inventory design](../design/WEB3_GOODS_RECEIPT_INVENTORY_UI.md), [acceptance matrix](../development/WEB3_ACCEPTANCE_MATRIX.md) and [historical handoff](../development/WEB3_CODEX_HANDOFF.md) remain references, not an execution queue.
- [Backend companion archive](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/archive/20261101-web3-goods-receipt-inventory/README.md) owns B01–B05. Backend CEX-A01–A05 remains separately active and unchanged. Full IIS/production and attended Telex/VNI/Narrator remain NOT RUN; backend CI NOT CONFIGURED / NOT RUN is an accepted limit, not PASS. All recorded security, recovery and operational limitations remain unchanged.

## Completed Roadmap 02 — net48 HTTP/JWT + Sales end-to-end

- **2026-11-01 Owner decision:** WEB2-01–09 **DONE (bounded)**; WEB2-10 **DONE in the proven IIS Express HTTPS + SQL Server non-production + Chromium/Edge pilot scope**, with **full IIS acceptance: OWNER_ACCEPTED_EXCEPTION / NOT RUN**. The exception closes the roadmap **without marking full IIS PASS**.
- [Archive and final disposition](../archive/20261101-web2-http-jwt-sales/README.md) · [frozen execution plan](../archive/20261101-web2-http-jwt-sales/plans/20261031-002-http-jwt-sales-vertical-slice.md) · [former plan compatibility anchors](20261031-002-http-jwt-sales-vertical-slice.md) · [original evidence and appended Owner decision](../evidence/20261031-web2-http-jwt-sales.md#2026-11-01--owner-closeout-and-full-iis-exception).
- [Technical design](../design/WEB2_FRONTEND_INTEGRATION.md), [pilot runbook](../development/WEB2_PILOT_RUNBOOK.md), [historical Codex handoff](../development/WEB2_CODEX_HANDOFF.md), [server companion archive](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/archive/20261101-web2-http-jwt-sales/README.md). These are **references**, not active execution authorization.
- Verified results (historic WEB2-10 candidate): **245/245 frontend unit/component**, **91/91 Chromium regression**, **1/1 production-artifact**, **325/325 selected .NET rows** (server), **16/16 separate live Chromium/Edge browser cases**, with independent SQL stock/value/COGS/ledger oracle. Full IIS and operational/production readiness were **not tested or approved**.
- Retained limitations for a future *separately authorized* scope: full IIS deployment configuration, audit destination/retention, multiworker abuse controls, candidate-specific attended IME/accessibility, JWT localStorage XSS risk, memory-only drafts/unknown recovery and lack of an idempotency journal. None is reclassified as PASS.

## Completed Roadmap 01 — fake workspace/editing foundation

[WEB-01–08 historical plan](20261031-001-web-workspace-editing-foundation.md) · [original fake-scope evidence](../evidence/20261031-web-foundation.md) · [Foundation design](../design/WEB_UI_FOUNDATION.md). **COMPLETED / fake scope (2026-10-31)**. Original 135 unit/component, 78 Chromium and Owner-confirmed 24/24 attended cases remain bound to that candidate, not WEB2.

## Rule for subsequent roadmap selection

The Owner must explicitly select a new dated plan after inspecting current `main` and applicable tests. Never use archived WEB2/WEB3/WEB4 steps, historic BLOCKED statuses or old Codex prompts as an active queue. Keep live contracts owned by their source/design, and preserve evidence with original commit/runner/candidate provenance. Documentation-only closeout adds no frontend/.NET/SQL/browser runtime PASS.
