# WEB3 — Acceptance matrix and test ownership

**Status:** PLAN / NO WEB3 EXECUTION EVIDENCE YET. Scope selection: [frontend WEB3 plan](../plans/20261101-001-web3-goods-receipt-inventory-web.md); backend-owned independent SQL oracle: [WEB3 stock acceptance](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB3_STOCK_LEDGER_ACCEPTANCE.md). **Source of truth for execution rules:** [frontend TEST_POLICY](../TEST_POLICY.md) and backend `docs/TEST_POLICY.md`. This matrix tracks behaviors; it is **not** an additional test framework or a manifest with fake PASS counts. Proposed IDs below are scenario names, **not** discovered test case names.

## 1. Evidence levels

| Level | Runner / owner | What it can prove | What it cannot |
|---|---|---|---|
| F unit/component | Vitest + Testing Library, Web | parser, state, validation, async identity, field errors | real Dockview routing, TLS/SQL/posting |
| F browser fake | Playwright Chromium (+ Edge where selected), Web | actual DOM/grid/keyboard/Dockview and fake failure injection | HTTP host/auth restrictions, SQL ledger |
| B HTTP SQL-free | existing net48 HttpHost.Tests | routing, wire, security middleware, actor fencing via stubs | SQL grants/transactions |
| B SQL | Inventory/Security and affected backend owners on non-prod SQL | actual database schema, transactions, access/ledger/COGS | Web keyboard/DOM |
| Live HTTPS | backend-owned IIS Express fixture + Web production build/Playwright Chromium/Edge | real Browser→JWT→HTTP→Application→SQL plus independent stock oracle | full IIS/production or attended IME |
| Attended input | operator on selected candidate | Telex/VNI, Edge/Narrator observed behavior | general production acceptance beyond selected candidate |

Use level(s) appropriate to changed boundary, not one blanket suite per PR. Failed/missing/skipped test == not PASS. WEB2 historical counts stay separate from WEB3.

## 2. Workspace, identity and keyboard (Web F02/F04/F05)

| ID | Action / setup | Assertion |
|---|---|---|
| W3-WKS-01 | Open Sales#sameInteger and Receipt#sameInteger in one Dockview | No key collision; correct tab/caption/store/toolbar, independent raw buffers |
| W3-WKS-02 | Two new unsaved Receipts plus one unsaved Sale | Unique sessionId and clientLineIds, no cross-document input |
| W3-WKS-03 | Move/split/remove/add Dockview panels during invalid/raw edit | Same session and draft remain; remove is not close |
| W3-WKS-04 | Close/close-all/reset/restore with Sales dirty + Receipt pending/unknown | Admission blocks unsafe close; Cancel/Save/Discard scoped correctly |
| W3-WKS-05 | `schemaVersion:1` Sales-only layout → v2 | Preserve sanitized legacy Sales panels; reject malformed/unknown/cross-actor; never persist raw draft |
| W3-WKS-06 | Logout, refresh failure, same user new session, another user | Actor fence, no session/data leakage or late response into new scope |
| W3-WKS-07 | Read-only Inventory panel active then Ctrl+shortcut/close | No Sales/Receipt mutation or accidental Save/Post |
| W3-EDT-01 | Product lookup typed key-by-key; arrows; Enter/Tab | Highlight then commit once; focus Quantity cell without auto-opening editor |
| W3-EDT-02 | Escape, pointer selection, slow search response | Committed Product stays if candidate canceled; late results do not overwrite selection |
| W3-EDT-03 | Invalid qty/cost raw or composing state, Save/close | Visible raw input retained, no write dispatched, accessible field feedback |
| W3-EDT-04 | Add/remove/reorder rows, duplicate Product | Stable clientLineId, duplicate blocked by local and server validation, no silent de-dup |
| W3-EDT-05 | Posted or denied/busy/unknown state via mouse/keyboard/paste | No mutation or editor opening, no disabled-action bypass |

Browser runs use real AG Grid Community/Dockview/Floating UI; `fill()` and synthetic composition do not count as per-key/IME proof. Test viewport 1280×720/1440×900 and appropriate theme/zoom when changed.

## 3. HTTP protocol and receipt behavior (F03/F04 + B02/B03)

| ID | Action / setup | Assertion |
|---|---|---|
| W3-WIRE-01 | int64 9007199254740993 and MaxInt64 fields | String round-trip; JSON number/overflow rejected, no precision loss |
| W3-WIRE-02 | max four-digit qty/unitCost, carry and boundary | Exact decimal strings/preview, no Number parse, server valuation authoritative |
| W3-WIRE-03 | ReceiptDate and StockCard UTC range incl fractional seconds | No timezone shift; invalid local/non-Z UTC rejected |
| W3-WIRE-04 | 1/200 unique Product rows, then duplicate/201 | Valid accepted; duplicate and >200 fail safe, no SQL changes |
| W3-WIRE-05 | Update with replacement rows and response line IDs changed | Correct ordered sent snapshot mapping; no stale Product/line ID attachment |
| W3-WIRE-06 | Unknown fields, duplicate JSON keys, malformed UTF8/query, numeric decimal token | Validation/protocol failure before mutation |
| W3-REC-01 | Create → Update → Get Draft → Post | Authoritative receiptNo/version, row ordering, Posted/read-only |
| W3-REC-02 | Save success then detail Get 403/error | Keep confirmed Save baseline and selected/known labels; no ambiguous write state |
| W3-REC-03 | Post ack without version then Get 403/5xx | Confirm Posted immediately, no fabricated version or Post replay |
| W3-REC-04 | Create/Update/Post commits then response lost | Session outcome unknown locked; no automatic retry on network/refresh/reload |
| W3-REC-05 | Competing stale rowversion writes | 409 with conflict resolution; preserve dirty draft until explicit user decision |
| W3-REC-06 | Two rapid Save/Post invocations | Exactly one active request per intent, no duplicate posting |
| W3-REC-07 | Inactive product/warehouse/employee historical Get | Labels/IDs maintained; active lookup list absence doesn't wipe document |
| W3-REC-08 | Receipt list paging/search/status/warehouse | Page count/total authoritative, filters reset page, no Sales cursor |
| W3-REC-09 | Server validation field path `lines[index].*` after reorder | Error mapped using captured request index → clientLineId; focus and fieldless feedback |
| W3-REC-10 | Server grants Write/Post but not Read and vice versa | UI hint separate; server 403 independent; no fabricated Get authority |

## 4. Inventory read, auth and cross-module tests (F05/F06 + B)

| ID | Scenario | Assertion |
|---|---|---|
| W3-INV-01 | Balances Warehouse/Product/search/page | Q/V and nullable avg from server; null not zero, paging stable |
| W3-INV-02 | StockCard required keys, UTC range/page | Real signed Qty/Value, document type/no, server ledger order |
| W3-INV-03 | Open source via stock-card link with separate Read denied | Link gated and server denial respected, StockCard remains readable |
| W3-INV-04 | Receipt Post after balance/card loaded | Affected query keys invalidated/read, not another dirty document |
| W3-AUTH-01 | Feature-specific capabilities including Sales-only/Receipt-only/read-only | No global Read/Write/Post flag leakage |
| W3-AUTH-02 | Revoked permission / session after auth | Protected reads/writes 401/403 as applicable; no stale actor mutation |
| W3-AUTH-03 | Malicious Origin, invalid Cookie/Bearer, script injection | Existing HTTPS/Origin/CSRF/CSP/localStorage boundary preserved |
| W3-LIVE-01 | Real browser Receipt Create/Edit/Post → Stock Balances/Card | Physical SQL Q/V/ledger/valuation equals displayed projections |
| W3-LIVE-02 | Real browser Sales Post after Receipt | Actual moving average cost, StockCard negative source, no duplicate ledger |
| W3-LIVE-03 | New Receipt Post after historical Sales | Previously frozen Sale COGS/profit and valuation unchanged |
| W3-LIVE-04 | Concurrent actors Post/revocation and failed writes | Real SQL locks/authorization/rollback; no cross-actor leak or duplicate Post |

B4 physical SQL scenarios are defined only in backend [SQL acceptance](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB3_STOCK_LEDGER_ACCEPTANCE.md). Browser test expecting stock values computed by frontend is **not** an independent oracle.

## 5. Build and execution commands (source verified as of selection)

Use supported Windows/Node engines from `package.json` (npm 11.6.0 and Node >=22.14 <23), current lockfile and [TEST_POLICY](../TEST_POLICY.md). Proposed targeted test paths must be confirmed in the implementation PR before invocation; no zero-test PASS.

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:unit
npm.cmd run test:e2e -- --project=chromium
npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1
```

Use existing `playwright.edge.config.ts` where Edge is installed, under existing exclude/serial rules. Real packaged pilot follows [WEB2 pilot runbook](WEB2_PILOT_RUNBOOK.md) as a **fixture pattern**, but the WEB3 scenarios, source SHAs and evidence are new. Backend-only SQL tests use its `tests/README.md` and exclusive owned non-production instance; never pass credentials to frontend.

For each PR record: exact command, discovered selectors/case count, observed count PASS/FAIL/SKIP (including Theory rows where relevant), candidate tool versions, expected vs observed outcome, cleanup and blocked gates. No fabricated success, no copying WEB2 test totals. CI should run secret-free Web jobs first; SQL HTTPS/Edge hosted acceptance remains explicit Windows/operator-run unless a supported private runner exists.

## 6. Release boundary and evidence checklist

WEB3 may reach **COMPLETED (bounded pilot)** only after owner-reviewed real browser HTTP SQL oracle plus focused multi-module keyboard/actor/regression checks. Its acceptance does **not** authorize production. Preserve as separate not approved/not tested: full IIS deployment, audit retention, distributed rate limiting, durable drafts/idempotency, current-candidate attended IME/Narrator, JWT XSS/localStorage residual and environment release prerequisites.

Write new evidence under `docs/evidence/web3/` after tests end; avoid editing archived WEB2 evidence. Save no raw Playwright trace/HAR/video with auth tokens or SQL credential, and do not run Tailwind watcher/browser tests while writing Markdown that could trigger a page reload.
