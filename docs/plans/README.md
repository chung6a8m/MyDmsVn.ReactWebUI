# Roadmap selector — MyDmsVn.ReactWebUI

**Updated:** 2026-11-01. **Current selection:** **NO ACTIVE WEB IMPLEMENTATION ROADMAP**. Roadmap 02 closed as **COMPLETED WITH OWNER_ACCEPTED_EXCEPTION** on the Owner's explicit direction. No next roadmap or production deployment was selected by this closeout.

## Completed Roadmap 02 — net48 HTTP/JWT + Sales end-to-end

- **2026-11-01 Owner decision:** WEB2-01–09 **DONE (bounded)**; WEB2-10 **DONE in the proven IIS Express HTTPS + SQL Server non-production + Chromium/Edge pilot scope**, with **full IIS acceptance: OWNER_ACCEPTED_EXCEPTION / NOT RUN**. The exception closes the roadmap **without marking full IIS PASS**.
- [Archive and final disposition](../archive/20261101-web2-http-jwt-sales/README.md) · [frozen execution plan](../archive/20261101-web2-http-jwt-sales/plans/20261031-002-http-jwt-sales-vertical-slice.md) · [former plan compatibility anchors](20261031-002-http-jwt-sales-vertical-slice.md) · [original evidence and appended Owner decision](../evidence/20261031-web2-http-jwt-sales.md#2026-11-01--owner-closeout-and-full-iis-exception).
- [Technical design](../design/WEB2_FRONTEND_INTEGRATION.md), [pilot runbook](../development/WEB2_PILOT_RUNBOOK.md), [historical Codex handoff](../development/WEB2_CODEX_HANDOFF.md), [server companion archive](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/archive/20261101-web2-http-jwt-sales/README.md). These are **references**, not active execution authorization.
- Verified results (historic WEB2-10 candidate): **245/245 frontend unit/component**, **91/91 Chromium regression**, **1/1 production-artifact**, **325/325 selected .NET rows** (server), **16/16 separate live Chromium/Edge browser cases**, with independent SQL stock/value/COGS/ledger oracle. Full IIS and operational/production readiness were **not tested or approved**.
- Retained limitations for a future *separately authorized* scope: full IIS deployment configuration, audit destination/retention, multiworker abuse controls, candidate-specific attended IME/accessibility, JWT localStorage XSS risk, memory-only drafts/unknown recovery and lack of an idempotency journal. None is reclassified as PASS.

## Completed Roadmap 01 — fake workspace/editing foundation

[WEB-01–08 historical plan](20261031-001-web-workspace-editing-foundation.md) · [original fake-scope evidence](../evidence/20261031-web-foundation.md) · [Foundation design](../design/WEB_UI_FOUNDATION.md). **COMPLETED / fake scope (2026-10-31)**. Original 135 unit/component, 78 Chromium and Owner-confirmed 24/24 attended cases remain bound to that candidate, not WEB2.

## Rule for next selection

The Owner must explicitly select a new dated plan after inspecting current `main` and applicable tests. Never use archived WEB2 steps, historic BLOCKED statuses or old Codex prompts as an active queue. Keep live contracts owned by their source/design, and preserve evidence with original commit/runner/candidate provenance. Documentation-only closeout adds no frontend/.NET/SQL/browser runtime PASS.
