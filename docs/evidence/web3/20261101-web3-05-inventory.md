# WEB3-05 — read-only Inventory panels

**Date:** 2026-11-01 (Asia/Bangkok). **Owner selection:** implement WEB3-05 from the active plan; subagents allowed. **Result:** F05 **DONE (bounded)** — Owner accepted the verified scope and recorded limits, and [PR #16](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/16) merged on 2026-11-01. [Acceptance record](#owner-acceptance-and-merge--2026-11-01). No F06, backend B04/B05, CI or production acceptance is claimed.

Latest PR #16 review/fix candidate: **`99657038e67b70ede9629e6e1871cf48ccbfdfd7`**. The initial implementation results below remain historical; [the review follow-up](#pr-16-review-follow-up--2026-11-01) records the new findings, fixes and fresh verification.

## Source and environment

- Web baseline: `8fb4efa1aef4ed4c4471291c94b0cf7acc9348db` on clean main. Initial runtime/test candidate: **`b2282bea35e4b3b5f0205978ed02d81b27b68f24`**, branch `codex/web3-05-inventory`, isolated managed worktree. Documentation commit `afb842495102986837fc4d8a4d877e7b54f95556` records that initial checkpoint.
- Backend checkout inspected read-only at `e86335add61cc2d1e936cadad019b96053e4b9ca`. B03 prerequisite is supported by its existing [B02/B03 evidence](https://github.com/chung6a8m/MyDmsVn/blob/e86335add61cc2d1e936cadad019b96053e4b9ca/docs/evidence/web3/20261101-b02-b03-http-inventory.md); those historical results were **not rerun or relabeled** as F05 results.
- Canonical fixture pin unchanged: `d2d4b5e799916d058a90149331ac15345248d025`, [provenance](../../../tests/fixtures/web3-v1/provenance.json). Tests parse fresh fixtures and modify clones only.
- Windows build 26300; Node 22.14.0, npm 11.6.0, TypeScript 5.9.3, Vite 8.3.5, Playwright 1.64.1. Chromium **156.0.8078.4**; installed Edge **156.0.4314.58**.
- Dependency pins unchanged: React 19.3.1, TanStack Query 5.105.0, AG Grid Community 36.2.0, Dockview 8.8.2, Floating UI 0.27.20, Base UI 1.9.0. Installed declarations/source checked for query cancellation/invalidation and grid identity/keyboard callbacks. Nova/Quartz/default theme retained.
- Browser plugin not available; repository Playwright used. Dev app `http://127.0.0.1:5173/`; production artifact preview `http://127.0.0.1:5174/`. Browser HTTP is **route-stubbed**, with real React/Dockview/AG Grid rendering, not a real HTTP host or SQL server.

## Implemented behavior and boundaries

- **Balances:** optional Warehouse/Product/search, explicit page 1/25 and page-size controls, exact quantity/value/average strings, null average as em dash, inactive reference labels, composite warehouse/product row identity and authoritative total count. No client stock computation.
- **Stock Card:** requires committed Warehouse/Product; optional UTC range validates 0–7 fractional digits and inclusive order without Date rounding. Ledger ID/document ID stay strings, signed quantity/value and server order retained; no running balance or editable rows.
- **Navigation:** actor-scoped singleton panels; toolbar reopen activates without clearing current filters, explicit balance stock-key navigation retargets and resets pagination. Source types GoodsReceipt/SalesReceipt route through the registry with separate current module Read capability. Unknown type has no invented route; source Get403 appears in its document panel while Card remains readable.
- **Authorization/cache:** all three enabled feature grants settle before initial restore; later authoritative refresh retains document sessions. Inventory keys contain actor/generation/filter/page. Runtime auth subscription cancels/removes denied module queries even with no mounted panel; old actor/deferred results cannot repopulate a new scope. 403/refetch errors hide prior rows.
- **Post:** current-scope confirmed Receipt/Sales acknowledgement or recovered authoritative Posted transition invalidates intersecting warehouse/product queries (including unfiltered/search balances). Ack before failed detail Get is sufficient; failed/unknown writes do not optimistically change stock. Other dirty sessions are untouched; no automatic mutation replay.
- Shared ProductLookup gains only an optional `required` prop defaulting true. Balances opts out; Card and existing document consumers retain required validation. No dependency, HTTP codec, backend source, SQL grant, generated component styling or canonical fixture change.

## Initial implementation verification

Final counts below are distinct runs, not cumulative totals. All final runs had **0 failed / 0 skipped**.

| Command | Observed result |
|---|---|
| `npm.cmd ci` | PASS; lockfile unchanged. Existing audit output: 2 low / 4 moderate advisories; no dependency upgrade in F05. |
| Baseline `npm.cmd run test:unit` | 42 files / 731 PASS |
| `npm.cmd run typecheck` | PASS on final runtime/test source |
| `npm.cmd run build` | PASS; 2553 modules; existing large-chunk warning remains (main JS about 2.28 MB, gzip about 646 kB). No bundle optimization claim. |
| Final `npm.cmd run test:unit` | **46 files / 751 PASS** |
| `node --test tests/fixtures/web3-v1/validate-corpus.test.mjs` | **8 PASS**, including byte-hash guard |
| `npm.cmd run test:e2e -- --project=chromium --workers=2` | **132 PASS**, 2.6 min; full frontend suite |
| `npm.cmd run test:e2e -- --config playwright.edge.config.ts --workers=2 tests/e2e/web3-inventory.spec.ts tests/e2e/web3-receipt.spec.ts tests/e2e/web3-workspace.spec.ts tests/e2e/web2-http.spec.ts` | **39 PASS**, 58.2 s; separate targeted Edge run |
| `npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1` | **1 PASS**; production entry and rejected Lab routes, no fake workspace |
| `git diff --check` and local documentation check | PASS; 106 local document links resolve; changed files UTF-8 without BOM / LF |

The 13 new Inventory browser cases run in both Chromium and Edge. Coverage maps to W3-INV-01–04 and W3-AUTH-01/02: precision/null/inactive references; filters/paging; required keys/fractional UTC; separate grants and HTTP-stub 403; permitted/denied/unknown source navigation; singleton activate/retarget; keyboard/paste cannot mutate either grid; permission refresh and late old-actor result; Receipt Post/Get403 refresh with dirty Sales preserved. Unit tests additionally exercise real Sales/Receipt command paths with failed detail Get, failed/unknown/no-replay outcomes, once-only recovered Posted invalidation, closed-panel cache revocation/regrant and pending-query cancellation.

The full Chromium suite retains Sales editing, lookup, close/restore/move, auth and mutation recovery regression. Its existing native zoom test exercises the foundation; this is **not** Inventory-specific zoom acceptance. The Edge selector includes 13 Inventory, 14 Receipt, 3 multi-module Workspace and 9 Sales HTTP cases; it is not a full Edge suite.

## Browser and visual QA

Flow: login → Tồn kho/Thẻ kho → filter/page/select → permitted source detail or panel-scoped denial → Post/auth refresh with scoped projections. Both 1280×720 and 1440×900, Light/Dark and split groups were exercised. Small split panels scroll to their footer; page-size selection and reload remain clickable within the viewport and preserve the other dirty Sales draft.

| Check | Result |
|---|---|
| URL/title and meaningful app content | PASS |
| No framework overlay / no relevant page or console errors | PASS; expected injected HTTP failures excluded from console-resource noise |
| Exact values and interaction proof | PASS via query/request and rendered-row assertions |
| Screenshots | Inspected settled Light 1280, Dark split 1280 and scrolled footer; 1440 variants also captured |
| Read-only behavior | Enter/F2/paste cannot create editors or issue mutations |

Screenshots remain local, outside tracked source. Tests default to Playwright output and accept `WEB3_SCREENSHOT_DIR` for an external directory. Captures include `inventory-light-1280.png`, `inventory-light-1440.png`, `inventory-dark-split-1280.png`, `inventory-dark-split-1440.png`, and `inventory-dark-split-footer-1280.png`. Early screenshots taken before layout/theme settled showed transient overlapping paint; settled controls plus two animation frames removed it without a layout/style change. Footer hit testing and later scrolling confirmed the actual Inventory control receives input.

## Failed-before-fixed and review record

1. Initial unit setup failed on absent feature modules; initial component harness needed a stable snapshot and grid/lookup mocks. Temporary fixture typing errors were corrected; final typecheck is green.
2. First Inventory browser run: **7 PASS / 6 FAIL** (13 executed), caused by ambiguous region locators because Dockview and the child section share names. Tests now scope to the owning section.
3. Next run: **12 PASS / 1 FAIL**, exposing toolbar reopen clearing Card keys. A later two-case diagnostic was **0 PASS / 2 FAIL**: optional lookup required errors, plus a test expecting source Get403 in Card instead of the centrally opened failed source document. The source-failure assertion was corrected without weakening retained Card checks. A one-case visual probe again reproduced the optional required error.
4. Independent review identified three P2 issues: closed-panel cache survives same-actor revoke/regrant; toolbar activation resets singleton filters; optional Balances fields show required errors. Focused unit regression first produced **4 FAIL / 11 PASS**, then **18/18 PASS** after fixes. Source was re-reviewed; **all three addressed, no new actionable finding**.
5. Inventory-focused Chromium then passed **13/13**; subsequent full Chromium and targeted Edge runs above include the final footer-scroll regression. Independent reviewer did not claim to rerun tests; root inspected diffs, ran final suites and reviewed screenshots.

## Scope decisions, cleanup and remaining gates

Reused the Owner-approved design and owning plan instead of creating another specification/approval loop. Used an isolated managed worktree and narrow feature-owned UI plus existing registry/auth/ports; no backend extension. These choices keep this change reviewable and reversible on its branch. Browser stubs intentionally bound the frontend proof; treating them as server authorization or SQL valuation would be incorrect.

No real credentials, JWTs, cookie headers, SQL connections or real network account were used in this task's browser fixtures. Test Vite/preview/browser processes exited; reports/traces/screenshots are ignored or external and not committed. Backend checkout was inspected read-only. At the initial implementation checkpoint, main was not merged and nothing had been pushed. Owner subsequently authorized publishing the branch and [PR #16](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/16), then requested the review below.

**NOT RUN in F05:** fresh real HTTPS/SQL/physical Q/V/COGS oracle, B04/B05/F06 integration/CI, Inventory-specific native zoom, current-candidate attended Telex/VNI/Narrator, full IIS and production. Existing backend B03 and accepted F03/F04 evidence remain their own bounded historical prerequisites. Full IIS/production NOT APPROVED; retained localStorage JWT XSS risk, audit/retention, distributed limiter, durable drafts/idempotency and unmeasured bundle optimization remain unchanged.

Owning status and acceptance: [active WEB3 plan §6](../../plans/20261101-001-web3-goods-receipt-inventory-web.md#6-web3-f05--read-only-inventory-panels). Implementation/review checkpoints below preceded the explicit Owner acceptance recorded at the end.

## PR #16 review follow-up — 2026-11-01

**Owner request:** review PR #16 against F05 scope and important boundaries, fix findings, run appropriate checks and update PR/evidence. Reviewed PR head `afb842495102986837fc4d8a4d877e7b54f95556` against base `8fb4efa1aef4ed4c4471291c94b0cf7acc9348db`. Final runtime/test fix commit: **`99657038e67b70ede9629e6e1871cf48ccbfdfd7`**. Later evidence-only changes do not alter the tested source. Environment/dependency/browser versions are unchanged from the source/environment section above.

### Findings and corrections

1. **P2 — initial read can publish pre-Post stock after confirmation.** With an active first read and no cached data, TanStack Query invalidation deduplicated the in-flight request. The request could then publish its pre-Post result and clear invalidation without a fresh read. The observer now cancels only intersecting current-actor Inventory queries, marks them stale without immediate refetch, then refetches active matches after cancellation. The deferred continuation rechecks actor scope and subscription disposal. Inactive matching caches remain stale; unrelated keys/read requests and document stores remain untouched. This retries no mutation.
2. **P2 — same-runtime renderer remount loses filters/page.** Inventory filters lived only in React state, so navigating through Components Lab and back rebuilt them from the original open-panel filters. A feature-owned, memory-only view registry now retains committed/raw lookup values, search/UTC filters and paging per live panel. It follows admitted panel membership, so Dockview detach/move retains state; admitted close, actor/status change and runtime disposal discard it. Explicit retarget creates fresh view state and clears source selection/navigation error, including same-stock retarget against a cached page. Nothing is added to durable layout storage.

Independent read-only re-review found **no remaining actionable finding** in these corrections. Root inspected the final diff and ran the final broad checks. Review covered actor/cache permission fences, stale async results, source Read gates, exact int64/decimal/UTC handling, read-only grid behavior, Post ack/recovered Posted versus failed/unknown outcomes, feature-owned state and Sales/Receipt boundaries. No backend, wire schema, dependency, costing, write replay, shared document-store extraction or F06/CI change was introduced.

### Failure reproduction and fresh verification

- Initial-flight regression with actual `QueryObserver` and deferred requests: **2 FAIL / 7 PASS** before the fix (expected a second read, observed one). Expanded focused suite after the fix: **14/14 PASS** for balances/card, ack/recovered confirmation, unrelated requests, actor/disposal fencing and existing command scenarios.
- Same-runtime route remount browser regression: **1 FAIL** before the fix (expected retained UTC value, received empty); **1/1 Chromium PASS** after the fix. The final test retains both keys, UTC range, page size and page 2 through the real Dockview route remount.
- View/panel/runtime focused units: **11/11 PASS across 3 files**, including raw/composing lookup state, same-stock retarget selection reset, move versus admitted close and actor cleanup.

Final checks on the source committed as `9965703` were separate fresh runs, with **0 failed / 0 skipped**:

| Command | Observed result |
|---|---|
| `npm.cmd run test:unit -- tests/unit/inventory/inventoryInvalidation.test.ts` | 14 PASS; focused race/confirmation coverage |
| `npm.cmd run test:unit -- tests/unit/inventory/inventoryViews.test.ts tests/unit/inventory/panels.test.ts tests/unit/workspace/inventoryProduction.test.ts` | 11 PASS / 3 files |
| `npm.cmd run typecheck` | PASS; final build also runs `tsc --noEmit` |
| `npm.cmd run test:unit` | **763 PASS / 47 files**, 4.57 s |
| `npm.cmd run build` | PASS; 2554 modules; existing large-chunk warning remains (JS 2,282.11 kB / gzip 646.00 kB) |
| `npm.cmd run test:e2e -- --project=chromium --workers=2` | **133 PASS**, 2.6 min; full frontend regression |
| `npm.cmd run test:e2e -- --config playwright.edge.config.ts --workers=2 tests/e2e/web3-inventory.spec.ts tests/e2e/web3-receipt.spec.ts tests/e2e/web3-workspace.spec.ts tests/e2e/web2-http.spec.ts` | **40 PASS**, 1.0 min; 14 Inventory + 14 Receipt + 3 Workspace + 9 Sales HTTP |
| `npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1` | **1 PASS**, 4.3 s; production artifact isolation |
| `git diff --check`, changed-file encoding and documentation links | PASS; UTF-8 without BOM / LF; local links resolve |

The 8 corpus tests in the initial checkpoint were not rerun in this review; corpus/codec/dependency files are unchanged. Browser HTTP remains route-stubbed. Fresh screenshots were captured outside tracked source under the task visualization directory's `web3-05/review/{chromium,edge}`; Light 1280 and Dark split/scrolled-footer 1280 Chromium images were inspected without a new visual issue. Repo files were frozen during browser runs; owned Vite/preview runs completed. No screenshots, traces, reports or credentials are committed.

**Acceptance limits at the review checkpoint:** no fresh real HTTPS/SQL/Q/V/COGS oracle, no B04/B05/F06 or CI PASS, no attended Telex/VNI/Narrator, Inventory-specific native zoom, full IIS or production acceptance. At that checkpoint, only PR update/push was authorized and F05 was IN_PROGRESS pending Owner acceptance/merge. The subsequent decision below changes completion status, not these limits.

## Owner acceptance and merge — 2026-11-01

Owner explicitly accepted WEB3-05 within the verified scope and all evidence limits, instructed merge of PR #16 and update to **DONE (bounded)**, and explicitly deferred F06. PR #16 merged into `main` at **`248d10cc7610f301c6fafc45b22cc7605f19fdce`**, using expected-head guard `e65d3e888878ff9b40eae83045375ae3cbe941ed` against unchanged base `8fb4efa1aef4ed4c4471291c94b0cf7acc9348db`.

The accepted runtime/test source is `99657038e67b70ede9629e6e1871cf48ccbfdfd7`; the reviewed head adds evidence only. `git diff --exit-code e65d3e8 248d10c` confirms the merged tree is identical to the reviewed head. The recorded 763 unit/component, 133 Chromium, 40 targeted Edge and 1 production-artifact checks, plus typecheck/build, remain the acceptance evidence; no new runtime test run is claimed for this documentation closeout. GitHub returned no commit statuses or PR workflow runs, and the tree has no `.github` workflows: this is **not CI PASS**.

Closeout validation PASS: 7 Markdown-only files, 112 local links and new acceptance anchors, UTF-8 without BOM / LF, `git diff --check` and consistent status pointers. All limits above remain accepted as bounds, not converted to PASS. **F06 stays PLANNED / NOT STARTED**; backend B04/B05, real HTTPS/SQL integrated acceptance, attended input, full IIS and production remain outside this decision.
