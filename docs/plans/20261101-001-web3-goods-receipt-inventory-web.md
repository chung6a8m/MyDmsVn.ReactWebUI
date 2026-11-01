# Roadmap 03 — Goods Receipt & Inventory Web Integration

**Selected by Owner:** 2026-11-01. **State:** ACTIVE / F01 DONE (merged); F02 IN_PROGRESS — implementation and bounded verification complete; awaiting merge/acceptance. F03–F06 PLANNED. **Type:** multi-repository; current task is WEB3-02 multi-module Workspace, with Receipt/Inventory lifetime stubs confined to Lab. **Base:** current `main` at the time of task execution, not the historical WEB2 branch. **Scope:** non-production, real HTTP/SQL/browser integration; **not** release approval.

**Web source of truth:** this plan owns frontend tasks `WEB3-F01–F06`. [Multi-module workspace design](../design/WEB3_MULTI_MODULE_WORKSPACE.md), [Goods Receipt and Inventory Web UX](../design/WEB3_GOODS_RECEIPT_INVENTORY_UI.md), [test matrix](../development/WEB3_ACCEPTANCE_MATRIX.md) and [Codex handoff](../development/WEB3_CODEX_HANDOFF.md) are normative for this scope. **Server owner:** [MyDmsVn backend WEB3 plan](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/plans/20261101-002-web3-goods-receipt-inventory-http.md) owns `WEB3-B01–B05`; server [wire contract](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB3_INVENTORY_HTTP_WIRE.md) owns HTTP semantics. Keep cross-repo status/evidence separate; a GitHub PR is not runtime acceptance.

## 0. Why / deliverable / invariants

Roadmap 02 proved a Sales pilot on the existing `net48` System.Web/IIS Express HTTPS host, server-issued JWT + rotated HttpOnly refresh, production React + SQL and independent SQL stock/cost oracle. It did **not** prove multi-module workspace reuse, full IIS, operation idempotency, durable drafts or production readiness. WEB3 is a **second vertical slice** to test those reusable seams and to exercise Goods Receipt → Inventory → Sales through one authoritative SQL store.

**Business deliverables:** Goods Receipt List, Create/Update Draft, Get, Post; Stock Balances and Stock Card as **read-only** panels; links to permitted source documents. Keep Sales fully operational after refactoring.

**Architecture deliverables:** module-scoped panel descriptors, session/close admission, command routing, layout migration and actor/capability fencing without Sales-specific assumptions; feature-specific stores/ports/validators remain separate; shared HTTP/auth and numerical primitives remain shared.

**Do not change:** Sales duplicate-Product/gift/manual-price rules; Goods Receipt unique-Product rule; moving average Q/V/COGS and ledger posting protocol; existing Application handlers, UoW, LINQ to DB/DbUp ownership, JWT storage/cookie decisions; shadcn Nova/Base UI, Tailwind v4 defaults, AG Grid Community, Dockview/Floating UI. No WinFormsKit/Business Compact port, generic ERP form builder or new .NET target.

**Not in scope:** Inventory direct writes, transfer, adjustment, audit stocktake, returns, payment/debt, report/print builder, new costing algorithm, changing Goods Receipt list to keyset without separate evidence/approval, full IIS, production deploy, durable local drafts, operation journal/idempotency, security policy overhaul. Record these as deferred; do not silently solve by unsafe mutation replay or broad database grants.

## 1. Decision and ownership matrix

| Milestone | Web task and authoritative state | Backend task and authoritative state | Required gate |
|---|---|---|---|
| WEB3-01 Contract/architecture | **F01 DONE (merged)** — source/ownership matrix, module decisions and canonical B01 corpus consumption; verification/acceptance recorded below | B01 — source-verified HTTP/DTO/SQL/permission baseline | Canonical backend wire contract reviewed before code |
| WEB3-02 Multi-module Workspace | **F02 IN_PROGRESS** — implementation/verification complete, awaiting merge/acceptance; [verification/evidence](../evidence/web3/20261101-web3-02-multi-module-workspace.md) | none | Sales still passes close/restore/actor/focus/regression |
| WEB3-03 Backend API | F03 depends on it, not an independent server task | B02 routes/auth/capabilities; B03 strict wire, real SQL tests | No business SQL/controller rewrite; HTTP negative tests |
| WEB3-04 Goods Receipt Web | **F03 PLANNED** ports/codec + **F04 PLANNED** feature UI and mutations | B02 complete | Real Create→Update→Post and unknown/403/409 |
| WEB3-05 Inventory read UI | **F05 PLANNED** Stock Balances / Stock Card | B03 complete | Read-only, independent permissions and paging |
| WEB3-06 Cross-module acceptance | **F06 PLANNED** browser/E2E + CI + handoff | B04 Q/V/COGS SQL oracle; B05 host/pilot handoff | Independent fresh SQL / real HTTPS browser evidence |

Backend task statuses live **only** in its companion plan; the table above is a dependency map, not a second backend checklist. WEB2 and desktop CEX have independent completed/active histories; WEB3 does not reopen or waive them.

## 2. Work package WEB3-F01 — feature boundary and contract checkpoint

**Prerequisites:** B01 owner source review; current `main` in both repos, existing tests, pinned package APIs inspected. **Touch:** this plan, both WEB3 design docs, contract fixtures/tests as needed; no runtime code before contract decisions.

1. Inventory Sales-specific seams at `src/app/runtime/runtimeDependencies.ts`, `src/app/workspace/{panelRegistry,workspaceController,commandRouter,workspaceLayouts,layoutPersistence,WorkspaceHost}.ts(x)`, `src/features/sales/*`, `src/ports/*` and HTTP auth client. Mark generic versus Sales-owned behavior with call-site evidence. Do not extract on filename similarity alone.
2. With B01, freeze mappings for `GoodsReceiptDto`, `GoodsReceiptLineDto`, `PagedResult<T>`, `StockBalanceRow`, `StockCardRow` and `PostGoodsReceiptResponse`. Assert receipt's Save lines contain **productId, quantity, unitCost without line IDs**; unlike Sales, duplicate Product is invalid. Confirm actual create/update response pre-commit materialization and server line ordering.
3. Freeze feature-scoped capabilities and permission keys; frontend auth shape must not assume `sales` feature globally. Existing `sales` JSON and routes must remain wire-compatible.
4. Define module identity (`sales`, `goods-receipt`, `inventory-balances`, `inventory-stock-card`), records panel vs read-only panel, actor-scoped identity, tab caption, close/restore rules and the versioned layout migration.
5. Identify risk-based test ownership and required test data: 1/200 receipt lines, 2 same-Product lines rejected, int64 > JS safe integer, boundary decimal, rowversion conflict, UTC stock-card timestamps, inactive references. Backend owns canonical corpus; Web tests consume pinned fixtures, not fork them.
6. Document any unresolved source discrepancy as a blocking item owned by F01/B01 **before** implementation. Close F01 only when both specs agree on status/request field names.

**Exit:** reviewed source→contract matrix, module descriptors and fixture manifest, explicit cross-repo PR sequence; no runtime pass claimed.

### WEB3-01 checkpoint — 2026-11-01

Web source `8163dc99500ffffc94a3aa6a9c87e25e3db49726` and backend source `8b599c782816d9cd64f04a45d809a2b8eb1235c8` matched remote `main` at inspection. [Evidence and verification](../evidence/web3/20261101-web3-01-contract-checkpoint.md) record the exact scope. Owner subsequently authorized backend B01 in the same task. Deliverables are in the owning [workspace design](../design/WEB3_MULTI_MODULE_WORKSPACE.md) and [source/wire checkpoint and canonical fixture manifest](../design/WEB3_GOODS_RECEIPT_INVENTORY_UI.md#9-f01-sourcewire-checkpoint--2026-11-01); no second JSON specification was created.

- Source inventory, module/record/read-only identity, captions, feature capability mapping and v1→v2 decisions are documented for F02. Feature stores, validation and mutation recovery remain separate.
- **Initial blocker resolved by the authorized B01 extension:** backend publishes the canonical `docs/contracts/web3-v1/` corpus; frontend consumes its exact separate commit and hashes through [provenance](../../tests/fixtures/web3-v1/provenance.json). B01 resolves long `totalCount`, explicit nulls, per-field decimal/UTC and executable error fixtures. Save line IDs/order and existing error-field mapping are source-verified; the consuming design records C01–C05 resolutions and F03 reuse limits.
- **Cross-repo sequence:** review/accept backend B01 canonical contract commit, then the frontend F01 checkpoint consuming that pin; mark DONE only at merge/acceptance. F02 workspace and B02/B03 backend runtime follow in separate PRs; F03 consumes the corpus before live ports, then F04/F05 and integrated F06/B04/B05. The current checkpoint does not start those tasks.
- Scope includes documentation, immutable test inputs and SQL-free corpus/compatibility tests. No `src/`, dependency, runtime HTTP/UI or SQL grant change. At that checkpoint F02–F06 remained PLANNED; subsequent F02 status is recorded below. Full IIS and production remain unapproved. Required verification and exact counts are in evidence, distinct from future runtime/browser/SQL acceptance.

## 3. WEB3-F02 — extract a *small* multi-module workspace

**Prerequisite:** F01. **Allowed seams:** workspace/runtime/auth/provider/layout files, shared session identity/close interfaces, source-verified relevant tests. Do not move all Sales business state into `shared`.

1. Introduce an app-owned **feature panel registry** (proposed shape in `WEB3_MULTI_MODULE_WORKSPACE.md`) mapping module key → panel factory/open policy/close policy/restore descriptor and stable panel identity. A panel is a layout object; the document session is a separate owner. Keep `onDidRemovePanel` from deleting documents.
2. Extract small **document close admission** and **command dispatch** contracts that Sales and Goods Receipt adapters can satisfy. Session store remains feature-owned. `closeAll` must iterate **all owned documents**, not just Sales; block pending/outcome-unknown; preserve Cancel/Discard/Save outcomes and modified-during-save barrier.
3. Remove `SalesSessionStore` hard imports from generic workspace/layout/command machinery, without rewriting mature Sales edit commands. Preserve sales editor barrier, original actor/session generation and no stale asynchronous writes. Use an adapter during migration and remove adapter only when real second consumer passes.
4. Add a typed capability registry for four features: receipt read/write/post and inventory read scopes. Deny unknown/old scope, isolate Query caches on account/session changes. UI hints only; authority stays on server.
5. Version and migrate **layout-only** storage. Current `schemaVersion:1` encodes Sales panels. Preserve the existing v1 sanitizer, including dropping/pruning unknown v1 components; validate remaining references as strict int64 before migration. Unknown v2 descriptors reject the whole envelope; malformed/cross-actor input fails closed to a safe shell under admission, never resurrecting unsaved drafts or mutating an old actor's session. Invalid present v2 must not fall back to stale v1. Keep no durable draft persistence.
6. Move generic toolbar actions to active-panel policies; `New Goods Receipt` vs `New Sales` explicit per feature. Keep existing Sales shortcuts/close admission and ensure read-only Inventory tabs do not expose Save/Post.
7. Run focused component/unit, Dockview Playwright and current Sales HTTP fake and real regression where affected; test same-ID receipts across different module identities and two users. Record the *exact* before/after behavior matrix.

**Exit:** two distinct feature-specific session adapters can coexist without mounting each other's state; Sales has no user-observable regression. Do not close from typecheck alone.

### WEB3-02 execution checkpoint — 2026-11-01

Owner selected WEB3-02 in the current task after F01 merged into Web `main` at `1fa3708f2ed04a5193f61c878a5b91991295c2a9`; backend B01 is on `feb3b6cbc3bec3fe505c2b575fd4a8050973524d`, with the canonical fixture pin unchanged. Runtime/test candidate: `dfa407d5c58c97ca76c6c645443a4f93f5ddcedd`, branch `codex/web3-02-workspace`.

- [x] Feature-owned Sales adapter; module/actor-scoped registration and commands; separate Receipt lifetime stub.
- [x] Shared close admission across all feature stores and simple panels, pre-await identity/revision capture, global open lock, native close/restore/remount regression.
- [x] Four-module capability hints, explicit HTTP feature map, fail-closed missing/stale grants; existing production auth/Query cache fencing retained.
- [x] Layout v2 and strict int64 migration; preserve v1 key, no stale-v1 fallback from invalid v2, no draft/session/token persistence.
- [x] Unit/component, Chromium, targeted Edge and production-artifact verification.
- [x] Sales real HTTPS/SQL regression on Chromium and Edge; see [new task evidence](../evidence/web3/20261101-web3-02-multi-module-workspace.md) for exact commands/counts, initial failures and limits.

Production still composes Sales only. F03/F04/F05 own actual Receipt/Inventory ports, session business rules, UI and reads. Capability loading for a newly enabled feature must be requested after authoritative login/refresh; no F02 startup calls to unavailable B02 endpoints. No backend source, dependency pin, auth storage, write retry or SQL grant changes.

**PR #14 review follow-up (2026-11-01):** candidate `fcc9979f17c1f0b27990733b08a31d514ef86af0` fixes persisted simple-panel restore bypassing module Read permission. [Review evidence](../evidence/web3/20261101-web3-02-multi-module-workspace.md#7-pr-14-review-follow-up--2026-11-01) records RED→GREEN reproduction, fresh frontend/browser and Sales HTTPS/SQL regression. F02 remains IN_PROGRESS awaiting merge/acceptance.

## 4. WEB3-F03 — receipt/inventory ports and HTTP codec

**Prerequisites:** F01, backend B02/B03 route/wire contract and relevant scoped API tests; may begin fixture-based frontend contracts in parallel with backend implementation after B01 freeze.

1. Create feature ports (`GoodsReceiptPort` and read-only `InventoryPort`) and strict Zod codecs at trust boundary. Reuse existing HTTP transport, `HttpError`/protocol mapping, JWT refresh coordination, permissions and request-scope cancellation; no fake in production graph.
2. Treat `receiptId`, `line.id`, `ledgerId` and `documentId` as decimal **strings**. Catalog ID/page counters remain checked int32. All C# decimal wire fields are invariant **strings**, not JS Number; `null` average is not zero. Receipt date `yyyy-MM-dd`, UTC stock-card timestamps, opaque rowversion. Reject unrecognized/duplicate/malformed values rather than coercion.
3. POST/PUT Save snapshots send only backend-owned fields and capture ordered `clientLineId` ↔ sent line index. Receipt Update **replaces** lines; server does not accept existing receipt-line IDs. Verify response order/cardinality/product mapping before rebasing the session; no product-based dedup/reconcile. A protocol mismatch must retain private session/recovery state.
4. Create/Update returns authoritative Draft detail; Post returns **receiptId/status/postedAtUtc without version**. Model separate acknowledgement (Posted confirmation, detail pending), never pretend Sales `PostAcknowledgement.version` exists for receipt. A failed post-ack Get is a **read** failure, not failed Post.
5. Keep list paging as backend pageNumber/pageSize with total; reset paging on filter changes. The stock-card supports only backend-provided fields (no fabricated running balances). Inactive labels come from authorized detail/source, not an active-only lookup page.

**Exit:** fixture-driven codecs in both directions; protocol/precision/permissions negative coverage, no mutation auto retry or provider-to-UI leak.

## 5. WEB3-F04 — Goods Receipt workspace, inline editing, mutation safety

**Prerequisites:** F02, F03. **UI composition:** feature components, shared AG Grid Community editors, Floating UI lookup, Nova/Base UI. No WinForms UI code.

1. List panel: search, Warehouse, status, pageNumber/pageSize; current page count/total, server-directed order, safe navigation to document, error/loading/empty states. Do not invent date/product filters absent in current backend List contract.
2. Draft header: ReceiptDate, Warehouse, Employee, Note, status, server ReceiptNo (read-only assigned after Create), version. Product lookup uses active-only selections but existing inactive historical names remain visible on Get.
3. AG Grid lines: STT, Product, Quantity, Unit Cost, Line Amount (derived preview). Add/remove; **reject duplicate Product**; stable `clientLineId` distinct from ProductId/index/server line ID. Reuse generic editor mechanics, implement receipt-specific validation. Keep typed raw decimal/IME candidate until commit/cancel.
4. Keyboard contract: type search character-by-character; arrows highlight; Enter/Tab commit; advance to Quantity cell without unintended editing; preserve caret; Escape cancels only pending choice. Center/align according to Nova defaults; don't add custom Business Compact style work.
5. Editor barrier: finish current edit before Save/Post/close/switch, detect invalid raw state, latest-revision guard, server errors map `lines[index].field` via captured sent snapshot to stable client ID, focus failing editable field. Dirty includes invalid/uncommitted raw and lookup changes.
6. Save/Create/Update: known failures retain edits; duplicate sends coalesced per in-flight intent; stale version 409 offers review/reload without overwriting unsaved draft. Post only from clean saved Draft and posted/read-only is enforced in UI *and* commands.
7. On timeout after dispatch freeze outcome-unknown; preserve original actor/session context, no automatic Create/Update/Post replay after refresh/401/timeout/abort. On Post ack, mark Posted immediately even if Get returns 403/5xx and show details unavailable without resending Post. Do not fake server receipt number or rowversion.
8. Navigation admission between Sales and Receipt, close-all, layout reset and actor switch must never drop dirty/unknown sessions or leak private state.

**Exit:** genuine-browser keyboard/edit/close tests; backend-backed Create→Update→Post and unknown/permissions cases. Goods Receipt can be open beside Sales.

## 6. WEB3-F05 — read-only Inventory panels

**Prerequisites:** F02, F03, backend B03.

1. Balances: Warehouse/Product/search filters, pageNumber/pageSize, quantity, inventory value, nullable average cost, inactive reference indicators. All derived formatters are display-only (exact wire source retained).
2. Stock Card: **required** Warehouse/Product, optional UTC from/to, document number/type, posting timestamp, signed quantity and value deltas, stable ledgerId. No running balance or editable rows unless new backend contract is explicitly authorized.
3. Link to Sales/Receipt source detail through feature registry, gated by that module's Read capability; no inferred authorization from StockCard.Read and no generic direct ledger writes. Keep read panel safe if document read fails.
4. Post notification: targeted TanStack Query invalidation for affected warehouse/product/stock card; do not overwrite another document session. Query keys include actor/session scope, filters and paging.
5. Error/empty/permission states at panel scope; correct keyboard navigation/focus, viewport 1280×720 and 1440×900, theme default.

**Exit:** read-only UI cannot issue mutations; independent Inventory.Balances.Read and Inventory.StockCard.Read tested with server denies.

## 7. WEB3-F06 — integrated acceptance, CI and handoff

**Prerequisites:** F02–F05 and backend B02–B05, with exact source SHAs and runnable test environments.

1. Preserve existing Sales WEB1/WEB2 regression; add scenarios listed in [WEB3 acceptance matrix](../development/WEB3_ACCEPTANCE_MATRIX.md), focusing on multi-module close/restore, real keyboard input, permission changes, Post ack/Get deny, unknown mutation and no replay.
2. Extend existing owned IIS Express HTTPS/SQL/browser fixture **only** under backend owner B05; verify web production build with no fake imports, no credentials in artifacts, active CSP, strict Origin and cookie semantics. Chromium and Edge run separately against fresh isolated SQL as existing policy requires.
3. Backend B04 runs independent SQL quantity/value/COGS/ledger oracle for posted receipts and sales, with cross-warehouse/concurrency and historical cost immutability. Frontend browser result alone is not SQL acceptance.
4. Add minimal CI for secret-free Web `npm ci`, typecheck, build, unit and fake-browser tests; broaden to backend CI only where an approved runner supports `net48`. No fake SQL pass, no unprovisioned Windows DB access, no stored secrets.
5. Evidence: exact web/server commit SHA, Node/package/browser/Windows/SQL/runtime versions, nonempty test selectors and cases, failure-before-fix, pass/fail/skip, cleanup, SQL fixture ownership, principal and scope. New `docs/evidence/web3/` files only; never edit historical WEB2 results to claim new PASS.
6. Handoff flags: full IIS/production, operational audit/retention and distributed rate limiting, durable drafts/idempotency, attended IME/Narrator on current candidate, JWT localStorage XSS risk, bundle optimization where unmeasured. Do not silently close these gaps.

**Complete only if:** all required WEB3 tasks have actual evidence; Sales and Receipt run concurrently in one workspace; real HTTP/SQL/browser multi-feature scenario passes, independent SQL Q/V oracle holds, unknown outcomes are not replayed; unauthorized reads/writes fail server-side. Deployment approval remains separately NOT APPROVED.

## 8. PR order, review and status policy

- Docs-only activation: **this PR** (Web) + a distinct backend companion docs PR. No source/test/runtime PASS implied.
- Implementation proposed PRs: W3-F01/B01 contract freeze → F02 workspace (Sales regression) in parallel with B02/B03 server → F03 codec → F04 Receipt UI → F05 read panels → B04/B05 + F06 integration/CI/handoff. Separate source-bearing PRs by owner and avoid mixed large cross-repo diffs.
- Each PR cites task IDs, changed invariants, exact selectors/case counts and evidence; update task state **only in owning plan** at merge/acceptance. Use `PLANNED` → `IN_PROGRESS` → `DONE (bounded)` or `BLOCKED` with precise reason. Do not mark DONE from a merged PR without required tests.
- Never reactivate archived WEB2 plans, make WEB3 dependent on full IIS exception or delete server's ongoing CEX workstream. New scope requires explicit Owner authorization.
