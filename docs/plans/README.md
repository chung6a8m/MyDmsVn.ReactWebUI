# Roadmap selector — MyDmsVn.ReactWebUI


## Active Roadmap 04 — Web Reliability & Delivery Foundation (Owner selected 2026-11-01)

**Owner selected WEB4-01/F01 execution; F01 BLOCKED on unpublished backend B01 corpus after local source/design checkpoint. F02–F05 PLANNED / NOT RUN.** [Frontend owning plan](20261101-002-web4-reliability-web.md) · [F01 checkpoint](../development/WEB4_F01_SOURCE_CHECKPOINT.md) · [F01 evidence](../evidence/web4/20261101-web4-01-contract.md) · [Durable Draft/Recovery design](../design/WEB4_DURABLE_DRAFT_AND_RECOVERY.md) · [Codex handoff](../development/WEB4_CODEX_HANDOFF.md) · [Web acceptance matrix](../development/WEB4_WEB_ACCEPTANCE.md). This roadmap adds IndexedDB user-reviewed draft restoration, durable immutable operation intents, strict backend status reconciliation for the existing six Sales/Receipt Create/Update/Post commands and cross-module browser/SQL pilot. Keep existing Web CI and prevent automatic mutation replay.

**Backend companion B01–B06:** https://github.com/chung6a8m/MyDmsVn/blob/main/docs/plans/20261101-003-web4-reliability-server.md. Backend owns Windows net48 SQL-free CI, Web-only journal/schema12 proposal (B01 source verification mandatory), HTTP transaction/permission contract and physical SQL oracle; frontend does not independently design its backend protocol. Execute B01→F01 checkpoint first; B02 can run alongside B03, F02 follows F01, F03 follows B04, F04+B05 then F05+B06. F01 remains blocked at its contract pin gate; F02–F05 remain PLANNED until separately verified/merged. Roadmap 03 stays archived; full IIS/production/attended candidate tests stay NOT RUN; independently active WinForms CEX remains unchanged.


**Updated:** 2026-11-01 (WEB4-01 source checkpoint). **Current selection:** Roadmap 04 F01 BLOCKED — B01 corpus absent; F02–F05 PLANNED / NOT RUN. Roadmap 03 is **ARCHIVED / COMPLETED (bounded)**, all F01–F06 DONE. Roadmap 02 remains closed with its accepted full-IIS exception; no production deployment selected.

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

The Owner must explicitly select a new dated plan after inspecting current `main` and applicable tests. Never use archived WEB2/WEB3 steps, historic BLOCKED statuses or old Codex prompts as an active queue. Keep live contracts owned by their source/design, and preserve evidence with original commit/runner/candidate provenance. Documentation-only closeout adds no frontend/.NET/SQL/browser runtime PASS.
