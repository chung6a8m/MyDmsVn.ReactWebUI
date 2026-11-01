# WEB3 frontend evidence index

**Selected:** 2026-11-01. This index includes F01 contract checks and F02 multi-module Workspace verification, with separate existing Sales HTTPS/SQL regression. It records **no real Receipt/Inventory or cross-module WEB3 SQL acceptance**. Owner: [WEB3-F01–F06](../../plans/20261101-001-web3-goods-receipt-inventory-web.md). [Scenario matrix](../../development/WEB3_ACCEPTANCE_MATRIX.md). [Backend-owned SQL evidence](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/evidence/web3/README.md) is separate.

- [2026-11-01 — WEB3-01 contract/architecture checkpoint](20261101-web3-01-contract-checkpoint.md): pinned source review, frontend design decisions, canonical corpus/provenance and contract/document verification; checkpoint review/acceptance is tracked in the owning plans. No runtime integration suites executed.

- [2026-11-01 — WEB3-02 multi-module Workspace](20261101-web3-02-multi-module-workspace.md): actor/module registry, close/command policies, capability hints, v1→v2 layout and Sales regressions; Receipt/Inventory are Lab lifetime probes only.

For each implementation PR create a dated evidence file here **after** tests finish. Record the exact task/PR and Web/backend SHAs; Node/npm, OS and browser versions; commands and nonempty discovered/executed test counts (PASS/FAIL/SKIP); raw keyboard/focus/Dockview/actor/mutation scenario IDs; backend SQL/HTTP evidence link where applicable; cleanup/secret hygiene; previous failures and corrections; blocked/not-run gates; Owner decision. Distinguish fake Playwright from live HTTPS/SQL/browser and attended IME/Narrator. Do not commit JWT/password/cookies, HAR, trace or sensitive test outputs.

WEB2/WEB1 historical evidence remains immutable. Full IIS, production, durable drafts/idempotency, audit retention and attended current-candidate inputs are **not approved/tested** by creating this index. No fake PASS counts.
