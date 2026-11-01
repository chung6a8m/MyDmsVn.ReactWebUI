# WEB3 frontend Codex handoff — actionable implementation guide

**WEB3-04 Owner acceptance (2026-11-01):** F03/F04 **DONE (bounded)**; Owner authorized frontend PR #15 and backend PR #77 merge using recorded evidence. CI is not configured in either repository; no CI PASS is claimed. Existing acceptance limits and F05/F06 scope remain unchanged. The owning plan/evidence record this decision; earlier candidate wording describes the implementation checkpoint.

**Selected:** 2026-11-01. **State:** active plan / F01 DONE (merged), F02 **DONE (bounded)** per Owner acceptance and merge authorization for [PR #14](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/14); WEB3-04 F03/F04 selected and implemented on the candidate branch, with verification/acceptance in the owning plan and [new evidence](../evidence/web3/20261101-web3-04-goods-receipt.md). F05 Inventory UI / F06 integrated acceptance remain PLANNED / NOT STARTED. Codex must read [AGENTS](../../AGENTS.md) → [Roadmap selector](../plans/README.md) → [WEB3 frontend plan](../plans/20261101-001-web3-goods-receipt-inventory-web.md) → [multi-module workspace](../design/WEB3_MULTI_MODULE_WORKSPACE.md) → [Receipt/Inventory UX](../design/WEB3_GOODS_RECEIPT_INVENTORY_UI.md) → [acceptance](WEB3_ACCEPTANCE_MATRIX.md) → [TEST_POLICY](../TEST_POLICY.md). Backend companion owns HTTP canonical wire and B tasks: [plan](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/plans/20261101-002-web3-goods-receipt-inventory-http.md) and [wire contract](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB3_INVENTORY_HTTP_WIRE.md).

**WEB3-04 candidate handoff:** strict Receipt and read-only Inventory HTTP ports consume the unchanged B01 corpus; Receipt owns its store/editing/barrier/commands/recovery and UI. App-owned `ProductionWorkspace` composes Sales + Receipt through F02 registry/admission. Feature capability loading waits before initial restore and reloads after every authoritative adoption without dropping dirty sessions. Post ack has no version, Posted is terminal, unknown writes require positive evidence and explicit recovery; never replay. Read the [candidate evidence](../evidence/web3/20261101-web3-04-goods-receipt.md) before claiming any browser/live gate. The Owner-authorized backend fixture uses a separate Receipt stock key; it does not establish B04 same-key Receipt→Sales valuation or complete B05/F06. Do not repeat F03/F04 extraction or promote the Lab probe into business state.

**WEB3-02 completed handoff:** accepted runtime/test candidate `fcc9979f17c1f0b27990733b08a31d514ef86af0` includes the restore Read-permission fix; exact frontend and Sales HTTPS/SQL verification plus Owner acceptance are in [F02 evidence](../evidence/web3/20261101-web3-02-multi-module-workspace.md#8-owner-acceptance--2026-11-01). Shared interfaces live in `documentContracts.ts`/`featurePanels.ts`; Sales lifetime and close adaptation live in `features/sales/salesWorkspaceAdapter.ts`/`salesCloseAdapter.ts`. Do not repeat F02 extraction. The selected F03/F04 candidate now provides the real Receipt consumer; when Owner selects F05, add Inventory panels under that scope. Do not promote the Lab probe into business validation. Feature capability reads are opt-in; authoritative auth refresh clears extra feature grants, so enabled modules must reload them and remain denied while waiting. Restore must preserve module Read gates and the safe Sales shell for Write/Post without Read. Layout v1 keys remain retained throughout WEB3. Full IIS/production, actual Receipt/Inventory and cross-module acceptance, and current-candidate attended Telex/VNI/Narrator remain outside F02 completion.

## 0. First-day source inspection

**WEB3-01 checkpoint completed:** [source/evidence](../evidence/web3/20261101-web3-01-contract-checkpoint.md), [workspace ownership decisions](../design/WEB3_MULTI_MODULE_WORKSPACE.md), and [source/wire resolutions + canonical fixture manifest](../design/WEB3_GOODS_RECEIPT_INVENTORY_UI.md#9-f01-sourcewire-checkpoint--2026-11-01). Consume the accepted checkpoint and pinned B01 revision in the [owning plan](../plans/20261101-001-web3-goods-receipt-inventory-web.md#web3-01-checkpoint--2026-11-01); verify the immutable corpus pin before subsequent runtime work. Do not repeat this checkpoint as a new spec. Re-inspect changes since the recorded SHAs; existing Sales primitives are not complete Receipt/Inventory codecs.

1. Start at fresh `main`, record Web and backend SHAs, check `package.json`/lockfile and actual npm/TypeScript/AG Grid/Dockview/Floating UI APIs. Do not reuse archived WEB2 execution branch or old source assumptions.
2. Read `src/app/runtime/runtimeDependencies.ts`, `src/app/workspace/{documentContracts,featurePanels,panelRegistry,workspaceController,commandRouter,workspaceLayouts,layoutPersistenceV2,WorkspaceHost}.ts(x)`, `src/features/sales/{salesWorkspaceAdapter,salesCloseAdapter,contracts,salesSessionStore,salesCommands,SalesLinesGrid,SalesDocumentPanel}.ts(x)` and `src/ports/{salesPort,catalogPort}.ts`. Preserve the completed feature-owned Sales boundary when adding new consumers.
3. Read `src/infrastructure/http/{httpTransport,authApi,salesHttpPort,salesWireSchemas,salesWireMapper}.ts`, current runtime composition and `tests/pilot/web2-live.spec.ts`. Verify existing `feature=sales` and localStorage JWT/HttpOnly refresh behavior; don't infer generic feature contracts from Sales alone.
4. Confirm canonical B01 fixtures/types against backend source `InventoryContracts.cs`: Receipt Update replaces lines and doesn't accept receiptLineId; unique Product, 1–200 lines; decimal scale 4; Post ack **does not include version**; Balance/Card read-only, pages not Sales keyset.
5. Compare source/method/test names with plan. Proposals are not implemented facts. Record exact affected surface and tests before opening runtime PR.

## 1. Task-by-task implementation and PR boundaries

### F01 — checkpoint/contracts before code

- With B01, freeze feature names, Wire fields/errors, list/balance/card paging and nullable/UTC fields. Reconcile status/error mapping and existing Catalog lookup permission behavior.
- Produce a dependency/ownership inventory for `SalesSessionStore`, `workspaceController`, `layoutPersistence`. Decide minimum generic interfaces with **both** Sales and a receipt adapter as intended consumers; no broad abstraction without evidence.
- Consume backend golden fixtures via tests/pinned checkout/copy generated in test process; **do not** fork a second independently edited JSON spec. B01 must be finished before F03 live HTTP implementation.

### F02 — multi-module Workspace — DONE (bounded)

- Delivered the small registry/identity/close/command seams and feature-owned Sales adapters through PR #14. Receipt and Inventory remain separate Lab lifetime probes; production still registers Sales only.
- Verified common admission across all owned documents, dirty/raw Save barrier, pending/unknown locks, detached sessions and actor/revision fencing. Dockview move/remove/add never disposes a document.
- Delivered layout v2, strict int64 v1 migration, retained v1 keys and no draft/session/token persistence; persisted simple panels now obey the current module Read gate.
- Preserved auth/HTTP/Sales behavior with independent capability hints and no automatic write replay. Exact passing suites and accepted limits live in the owning evidence, not a new acceptance queue here.

### F03 — strict Receipt/Inventory HTTP adapter

- Create `src/ports/goodsReceiptPort.ts`, `src/ports/inventoryPort.ts`, feature contracts and separate trust-boundary Zod schemas/mappers (exact paths can vary). Reuse existing HTTP bearer transport, refresh single-flight, no write retry and protocol errors.
- Preserve int64/decimal as strings, checked int32 catalog IDs, calendar `yyyy-MM-dd` and UTC timestamps. Receipt Save body sends `productId,quantity,unitCost` and header only; Update includes opaque expectedVersion. No clientLineId/receiptLineId/lineAmount/status.
- Capture outgoing ordered row map and verify response order/cardinality before rebasing. Receipt Post ack is `receiptId/status/postedAtUtc` without version; independent Get may fail without invalidating acknowledged Post. Keep lost-response Create/Update/Post unknown lock.
- Tests: golden fixtures + status/error/body shape, no automatic 401 write retry, null average/negative StockCard value and malformed protocol. Production source graph must exclude Lab/fake modules.

### F04 — Goods Receipt feature UI

- Add Receipt list/editor, header lookup, AG Grid Community lines `STT/Product/Quantity/UnitCost/LineAmount` and external Zustand document store. Product is **unique** within Receipt (unlike Sales) and must never be silently deduped.
- Reuse existing Floating UI lookup and editor mechanics; prove key-by-key typing, ArrowUp/Down highlight, Enter/Tab commit then focus Quantity cell **without opening its editor**, Escape cancels candidate; preserve caret, IME raw and async race guards.
- Create/Update/Post with an editor Save barrier, latest revision, request snapshot index → stable clientLineId error mapping, 400/409/403 handling and 1–200 lines. Display server ReceiptNo/Status/Version; don't generate receipt numbers.
- UI states: dirty, busy, submitted, unknown, ack Posted/read-only, Get unauthorized after ack. Close, close-all, logout, layout restore and actor switching follow F02 admission. Test side-by-side Sale+Receipt with separate write permissions and delayed responses.

### F05 — Inventory read-only UI

- Use Stock Balances and Stock Card as *read-only* feature panels. Respect source filters/pageNumber/pageSize (no Sales cursor), nullable average, signed quantity/value and UTC card date filter. Don't invent running balance or ledger mutation.
- Source document links require separate Receipt.Read/Sales.Read capability and server success. On Post, targeted invalidate inventory query keys; do not alter another dirty document store. Fence old actor cached reads.
- Browser checks: long names, pagination, filtered card rows, display null/negative values, panel state at small Dockview sizes, theme/zoom/read-only keyboard, server permission denial.

### F06 — integrated acceptance and CI

- Add focused unit/component/Playwright tests per [matrix](WEB3_ACCEPTANCE_MATRIX.md) and extend **backend-owned** IIS Express fixture on actual production Web `dist`. Real Chromium and Edge separately, restricted nonproduction SQL and independent backend oracle; no fake Post success accepted as SQL proof.
- Preserve WEB2 Sales regression and production artifact isolation; add minimal secret-free CI (`npm ci`, typecheck, build, unit/fake browser), not broad SQL CI without an approved Windows/SQL runner.
- Record Web and backend exact SHAs, test counts and real failures/cleanups, limitations, attended IME status and release not approved under `docs/evidence/web3/`. Close F06 only with actual evidence and Owner review of bounded scope.

## 2. Cautions at likely coding mistakes

| Mistake | Correct boundary |
|---|---|
| Rename SalesSessionStore into generic DocumentStore | Keep each feature store, share only close/identity/registry policy |
| Use Product ID as AG Grid row ID or response line matching | Use clientLineId, ordered sent snapshot and verified source lineNo |
| Copy Sales duplicate Product and gift logic | Receipt duplicate Product invalid, no Gift, cost is entered UnitCost |
| Use numerical JSON for long/decimal | String on HTTP wire; exact arithmetic in UI; never JS Number for precision |
| Assume Receipt Post returns `version` | No version in source ack; Posted state and later Get independent |
| Preemptively retry a 401/timeout POST | No automatic write retry; dispatched request may have committed |
| Read inventory as a mutable document | Read panels use Query cache, no save/edit/stock write |
| Restore draft from Dockview layout | Layout only; memory-only draft and unknown recovery remain separate |
| Treat Sales capability as all-module capability | Feature-scoped hints; server independent authority |
| Make Word/WinForms visual identical | Keep Tailwind Nova/Base UI defaults and Web behavior tests |

## 3. Execution commands and review cadence

Source `package.json` currently has `typecheck`, `build`, `test:unit` and `test:e2e`. Use Node >=22.14 <23/npm 11.6.0 and checked-in lockfile; prefer `npm.cmd` on Windows. Example, broaden only when changed boundary requires:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:unit
npm.cmd run test:e2e -- --project=chromium
npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1
```

Use focused `test:unit -- <existing path>` / `test:e2e -- <existing spec>` on every PR with real test count; full frontend suites at final milestone. Chromium fake/browser success does not prove SQL/JWT. Use the backend [WEB2 pilot runbook](WEB2_PILOT_RUNBOOK.md) as a fixture pattern and new WEB3 acceptance, not as historical gate replay. Do not commit test reports carrying user credentials, JWT, cookie or raw browser traces; don't write Markdown during watched Vite browser tests.

**PR message template:** task ID; source before/after; invariant; changed files; exact tests + count + PASS/FAIL/SKIP; negative cases; legacy Sales regression; runtime/browser caveats; follow-up dependency B task. Stop for Owner decision only if plan scope must change (new runtime, costing, full IIS/prod, operation idempotency, auth storage, broad SQL grants or UI framework replacement). Task-level technical choices already constrained here need no repeated approval.
