# WEB3 — Goods Receipt editing and read-only Inventory Web UX

**Owner:** frontend `WEB3-F01` contract checkpoint; `WEB3-F03–F05` implementation. **Status:** F01/B01 contract checkpoint; runtime NOT IMPLEMENTED. Canonical fixture pin and verification are recorded in §9/evidence. Use [WEB3 workspace](WEB3_MULTI_MODULE_WORKSPACE.md), [existing keyboard/lookup](LOOKUP_AND_GRID_EDITING.md), [existing Sales pilot](SALES_PILOT.md), [WEB2 HTTP](WEB2_FRONTEND_INTEGRATION.md) and [canonical backend WEB3 wire](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB3_INVENTORY_HTTP_WIRE.md). Reuse shadcn **Nova/Base UI**, Tailwind v4 default tokens, AG Grid **Community**, Dockview, Floating UI, TanStack Query/Zustand. Do not adopt WinFormsKit or visual Business Compact.

## 1. Scope and user journeys

**Receipt List → New/Open → inline edit → Save Draft → Post → read-only**, optionally open Inventory Balances and Stock Card beside the same Receipt and Sales documents.

- Goods Receipt header: **ReceiptDate, Warehouse, Employee, Note, Status, ReceiptNo (server-generated after Create)**. Show persisted version as internal concurrency state; do not expose editable token field.
- Receipt lines: `STT | Product | Quantity | Unit Cost | Line Amount`. Product unique within a single receipt. Amount is *calculated preview*, not a client-supplied SQL valuation. 1–200 lines, at least one.
- Goods Receipt List: optional Warehouse, Draft/Posted, search, 1-based pageNumber/pageSize and total count, not Sales keyset. Avoid new date/product filters unless backend has an explicit reviewed contract.
- Inventory Balances: read-only Warehouse/Product/search; current quantity, inventory value, nullable average unit cost, inactive-reference indicators.
- Inventory Stock Card: read-only required Warehouse+Product, optional UTC from/to; timestamp, document type/number, signed quantity/value change, paging and optional permitted source navigation. Do not display invented running balance, unseen historical product unit or warehouse name.

**Feature ownership:** `src/features/goodsReceipt/*` (proposed), `src/features/inventory/*` (proposed), `src/ports/goodsReceiptPort.ts` and `inventoryPort.ts`, `src/infrastructure/http/*` feature mappers. Exact filenames may vary after F01; all runtime and validation must remain near feature and use shared ports only as a trust boundary.

## 2. Document identity, state machine and allowed commands

One Goods Receipt session is owned by a Zustand external store, not by a Dockview component or TanStack Query result. Its keys: `sessionId`, `actorKey+actorGeneration`, `documentGeneration`, nullable server `receiptId` (int64 string), `version` (opaque saved baseline), `clientLineId` per UI row, raw lookup/numeric editor buffers, `editRevision`, `dirty`, `mutationStatus`, baseline, `postAcknowledgement?`, field errors/feedback. Store no access token or refresh cookie.

```text
NEW / UNSAVED
   | Save Create (barrier + valid)             -> SAVED DRAFT clean, server ID/no/version
SAVED DRAFT + changes                          -> DIRTY DRAFT
DIRTY DRAFT --Save Update (expectedVersion)--> SAVED DRAFT clean
SAVED DRAFT clean --Post (expectedVersion)---> POST ACK CONFIRMED (Posted/read-only)
                                                 | GET success -> full posted detail
                                                 | GET 403/5xx -> POSTED, detail unavailable
any dispatched Create/Update/Post --timeout/lost reply--> OUTCOME UNKNOWN (locked)
stale version 409 / known validation error    -> known failure; retain draft/errors
```

Only a clean saved Draft with current version and Post permission can Post. An editor barrier must complete pending editor candidate, verify no composition/invalid raw input, capture immutable sent snapshot, re-check `editRevision`/owner and then dispatch. Double clicking/Enter while busy must dispatch only once per intent.

**Receipt Post does not include a new version in its acknowledgement.** Do not fabricate it, re-enable editing, automatically retry Post, or use a Get 403/error to reverse confirmation. Unknown Post (no ack) is a distinct state from acknowledged Posted. A later GET may be used only under approved positive-evidence same-owner recovery. Preserve lock on ambiguous/stale reads. Current scope has no durable draft journal or operation idempotency key; warn on browser reload, never auto-resubmit.

Save Create/Update success is authoritative for persisted Draft/number/version/lines even if an optional Get for richer reference labels fails. Backend Create/Update may return null display labels; preserve the current committed lookup selection during editing, show safe fallback and only display historical inactive reference names when received authoritatively. Do not use product lookup page as proof of historical validity.

## 3. Goods Receipt header and list

- Use existing date input built from current Web component library, always send `receiptDate` as a literal `yyyy-MM-dd`. No JS `new Date("yyyy-MM-dd")` to infer local date/convert UTC.
- Warehouse/Employee lookup: reuse `CatalogPort` with active-only search and committed selection separate from raw search, Debounce/Abort generation; pending query cannot override committed identity. Historical inactive reference in Get should be rendered even if it cannot appear in active lookup. Catalog's own permission applies, independent of Receipt.Read.
- ReceiptNo: show server-issued `GR##########` after successful Create, never predict SQL sequence or treat gaps as errors. Status Draft/Posted visible; Posted mode prohibits keyboard/mouse/paste/editor edits.
- List: show server-owned total and 1-based page navigation; pageSize within backend allowed 1–200. F01 selects UI initial `pageNumber=1,pageSize=25` for Receipt, Balances and Stock Card; send both explicitly, without assuming HTTP defaults. Reset page on Warehouse/Status/Search change; no fake cursor. Switching from list to detail must perform central dirty-close admission if replacing an existing session; opening another tab need not close current.
- No Save/Post action should depend on `GoodsReceipts.Read` if authenticated Write/Post is independently granted; UI must present safe limited states when full detail requires Read but write acknowledgement was successful.

## 4. AG Grid Community receipt lines

| Column | Edit | Rules |
|---|---|---|
| STT | no | Visual row order derived from stable local session order, not server ID |
| Product | yes, Floating UI lookup | Required active Product ID; duplicate Product **invalid** across Receipt lines; no auto-select from query text |
| Quantity | yes, lossless decimal | >0, <= `99999999999999.9999`, max four effective fractional digits |
| Unit Cost | yes, lossless decimal | >=0, <= `999999999999999.9999`, max four fractional digits |
| Line Amount | no | Exact preview `round4(quantity * unitCost)` per line, server valuation authoritative after Post |

**Editing lifecycle:**
1. Product editor accepts character-by-character typing with correct caret, highlights by ArrowUp/Down (with or without popup click), commits with Enter or Tab, then sets focus to the **Quantity cell** without auto-opening its editor. Escape discards the highlighted *candidate* but never an already committed Product ID.
2. Use stable `clientLineId` for AG Grid `getRowId`. Receipt line has an optional server `receiptLineId` **only from reads/write result**, not in Save payload. Update replaces receipt lines; do not try to preserve server line IDs by Product ID.
3. Numeric text editor preserves raw candidate including invalid intermediate text and IME composition; blur/tab/Save barrier rejects invalid value without silently coercing/rounding. Keep real typed text and accessible error focus/description.
4. Insert/remove/reorder lines updates local identity and revision; Product duplicates can be displayed as invalid candidates for correction but Save is blocked with field-specific error. No silent de-duplication (and do not borrow Sales' legal-duplicate rule).
5. For server field errors `lines[index].quantity` etc, map index against **captured ordered outgoing snapshot**, then to that row's `clientLineId`. Never map by current visual row index after reorder or by Product ID. An error without field remains visible in the document banner.
6. On Posted, busy, actor change, denied Write or uncertain mutation: no editing route through keyboard, paste, popup or command. Dockview move/restore cannot unmount/destroy raw buffer or committed selection.

**Amount math:** use existing exact decimal/BigInt primitives or a reviewed small shared numeric module. Never use JS `Number`/`parseFloat`/`toFixed` for authoritative arithmetic or serializing stock/valuation. Client amount is explicitly a preview; server commits its own rounded value and is oracle authority.

## 5. Save/update/post/resolution rules (security critical)

| Case | UI result |
|---|---|
| Create success with server-assigned ID/no/version | Replace baseline using authoritative response, preserve client row identities via verified sent-order mapping |
| Update success, full replacement of rows | Use new server line IDs from response; reconcile by sent index/lineNo after cardinality/order/product verification |
| 400 field validation | Keep draft/raw edits, map error to current `clientLineId` from sent snapshot, focus invalid cell |
| 401 after business request dispatched | Fence auth and mutation separately; unless proved rejected pre-dispatch, keep outcome unknown; never auto-retry |
| 403 Read with Write/Post allowed | Do not fabricate detail; keep acknowledged writes and show Read unavailable |
| 409 stale rowversion or AlreadyPosted | Keep local draft for explicit conflict resolution; no mutating auto-reload that loses raw edits |
| Post success ack + GET 403/500 | Posted confirmed, read-only, details unavailable; no replay |
| Timeout/abort after Create/Update/Post dispatched | Outcome unknown, retain original owner/snapshot; no blind retry or Discard |
| Deferred response for old session/actor | Drop response for current UI, retain original private recovery state; no cross-owner state contamination |

Close, close-all, logout and layout restore coordinate with feature-owned Store/SaveBarrier under common workspace. Browser reload is **not** durable recovery. Existing WEB2 mutation rules remain unchanged for Sales.

## 6. Inventory read-only pages

**Balances:** query warehouseId?, productId?, search?, pageNumber, pageSize. Display warehouse code/name, Product code/name, active indicator, `quantity`, `inventoryValue`, `averageUnitCost`. A nullable average must show "—" or equivalent, never 0 or NaN; formats are display-only. No edit actions, no SQL write endpoints. Page/count use source 1-based offset paging.

**Stock Card:** requires selected warehouse and Product; optional UTC timestamps `fromUtc` / `toUtc` with from<=to; list ordered by server `PostedAtUtc, LedgerId`. Include document type/number, signed Qty/Value, timestamp and safe source navigation. Only navigate to Receipt/Sales if that **separate module's** Read capability is allowed; a server 403 remains authoritative. No synthetic running balance or stock projection from browser ledger subsets.

When Receipt/Sales Post finishes and changes the same stock key, invalidate scoped balance/card queries for affected warehouse/product, **not** active dirty document stores. If Post result unknown, do not optimistically apply stock deltas; query can refresh but uncertainty cannot be resolved by a simple balance match without source proof. On actor change discard/fence all cached read projections and abort old queries.

## 7. UX and accessibility without bespoke styling

- Use existing shadcn Nova/Base UI controls, default Tailwind v4 typography/spacing/radius/theme. Avoid visual parity with WinForms, forced base14, duplicate component wrappers or an invented Business Compact token layer.
- Dockview side-by-side Sales, Goods Receipt, Balances/Card; toolbar actions are active-module-aware; read-only panels never offer Save/Post. Keep status/validation feedback in correct document tab instead of shared status bar.
- At viewport 1280×720 and 1440×900 plus resized Dockview groups, no hidden primary actions, focus trap or clipped Floating UI popup. Light/Dark and browser zoom checks are behavioral, not CSS snapshot.
- Test real keyboard key sequences (typing one key at a time, caret position, ArrowDown/Up, Enter, Tab, Escape, Delete/paste, edit/close). `fill()` is not keyboard coverage; IME/Telex/VNI/Narrator is a separate **attended** gate for the exact candidate if selected.
- Lookup portal must have one positioning/focus/dismiss owner (Floating UI for custom ProductLookup). Preserve pending vs committed option and arrow-highlight semantics.

## 8. Acceptance and prohibited shortcuts

Required: two simultaneous editable document sessions (Sales and Receipt), independent permissions, 1–200 receipt lines with duplicate rejection, valid decimal/date/version roundtrip, Create/Update/Post real HTTP, Post ack/GET 403, unknown locked, rollback and SQL oracle, StockCard source links and authoritatively read-only views, v1 layout migration and no Sales regression.

Do **not**: import fake Lab ports into production bundle; use Sales line/session DTO as Receipt DTO, send `receiptLineId` on Save; replace authoritative returned labels with active lookup selection; fabricate version on Post ack; auto-retry after refresh; claim readonly UI prevents server writes; silently update all Sales sessions after Receipt Post; treat fake browser assertions as SQL pass.

## 9. F01 source/wire checkpoint — 2026-11-01

Inspected backend `main` at `8b599c782816d9cd64f04a45d809a2b8eb1235c8` and Web `main` at `8163dc99500ffffc94a3aa6a9c87e25e3db49726`. Both matched remote `main` during inspection. This is a consuming source-to-design matrix, **not a second canonical wire specification**. That source baseline predates the B01 contract work authorized later in this task. The backend now owns the WEB3 v1 field/lexical contract and executable corpus; the [immutable Web mirror/provenance](../../tests/fixtures/web3-v1/README.md) pins the separate B01 commit. Existing C# behavior below is source-verified; the frozen HTTP projection is a contract to implement in B02/B03, not an implemented API. [F01 evidence](../evidence/web3/20261101-web3-01-contract-checkpoint.md) records checks, not runtime acceptance.

### Source → consuming model

All backend paths below are relative to that pinned backend revision. The [InventoryContracts.cs source](https://github.com/chung6a8m/MyDmsVn/blob/8b599c782816d9cd64f04a45d809a2b8eb1235c8/src/MyDmsVn.Contracts/InventoryContracts.cs) owns DTO fields; camelCase/renames in the wire column follow the B01 canonical contract, not the Local serializer.

| Source field / type | B01 HTTP projection and frontend consequence |
|---|---|
| `GoodsReceiptDto.Id: long`; `ReceiptNumber: string` (lines 108–109) | `receiptId`: positive int64 string; `receiptNumber`: authoritative display. `ReceiptNo` in UI prose/SQL is not a request/response JSON member. |
| `ReceiptDate: DateTime`; `WarehouseId/EmployeeId: int`; `Status: string` | `receiptDate`: calendar `yyyy-MM-dd`; checked int32 `warehouseId/employeeId`; exact `Draft` or `Posted`. No browser timezone conversion. |
| `Note: string?`; `PostedAtUtc: DateTime?`; `Version: string` | `note`, nullable `postedAtUtc`, opaque `version`. These response members are required and explicitly null when absent in source; see C02 below. Rowversion is Base64 of 8 bytes; no version arithmetic. |
| Header `WarehouseDisplayName/EmployeeDisplayName: string?`, corresponding `IsActive: bool` | Same camelCase names. Save DTO constructor supplies null labels/default true flags; authorized Get/List projects actual reference labels/flags. A missing label does not prove the reference is active. |
| `GoodsReceiptLineDto.Id: long`, `LineNumber/ProductId: int`, `ProductDisplayName: string?`, `ProductIsActive: bool` (lines 15–40) | `receiptLineId` string, `lineNumber`, `productId`, nullable display name and boolean flag. No `clientLineId` on wire. UI row identity remains a separate UUID. |
| Line `Quantity/UnitCost: decimal` | `quantity`: decimal(18,4), >0; `unitCost`: decimal(19,4), >=0, both invariant strings. Bounds in §4 come from `GoodsReceiptContractLimits`, not Sales posted-cost scale. |
| `SaveGoodsReceiptLineRequest` (line 125) | Exactly `productId,quantity,unitCost`. Create header `receiptDate,warehouseId,employeeId,lines` plus optional `note` (omitted/null→null, empty string preserved); Update adds `expectedVersion`, route supplies `receiptId`. No line IDs, line number, status, actor or derived amount. |
| `PostGoodsReceiptResponse` (line 228) | Exactly `receiptId,status,postedAtUtc`; no `version`. Keep acknowledgement separate from an optional authorized Get. |
| [`PagedResult<T>`](https://github.com/chung6a8m/MyDmsVn/blob/8b599c782816d9cd64f04a45d809a2b8eb1235c8/src/MyDmsVn.Contracts/PagedResult.cs#L7) | `items,pageNumber,pageSize,totalCount`; page counters are int32, **TotalCount is nonnegative long**, not an int32 counter. B01 freezes `totalCount` as a nonnegative int64 string, including `"0"`; see C01. |
| `StockBalanceRow` (line 265) | `warehouseId,warehouseCode,warehouseName,warehouseIsActive,productId,productCode,productName,productIsActive,quantity,inventoryValue,averageUnitCost`. IDs int32; names/code strings; flags booleans; numerical projections below. |
| `StockCardRow` (line 326) | Same warehouse/product identity/label/flag fields; `ledgerId` and `documentId` int64 strings; `postedAtUtc` UTC; `documentType,documentNumber` strings; signed `quantityChange,valueChange`. No running balance. Source types `GoodsReceipt`→workspace `goods-receipt`, `SalesReceipt`→`sales`; unknown type gets no invented source route. |

[`InventoryValuationMath.cs:29–53`](https://github.com/chung6a8m/MyDmsVn/blob/8b599c782816d9cd64f04a45d809a2b8eb1235c8/src/MyDmsVn.Server.Domain/Inventory/InventoryValuationMath.cs#L29) distinguishes read fields: balance quantity is nonnegative decimal(18,4), inventory value nonnegative decimal(28,4), and average cost nullable decimal(28,8). Zero quantity with zero value gives null average. Stock Card signed quantity/value magnitudes use decimal(18,4)/(28,4); do not run them through positive receipt-input schemas. Preview rounding is positive half-up to four places, as implemented by `CalculateReceiptValue`/`Round`; overflow and posted valuation remain server-owned.

### Save materialization and paging

[`GoodsReceiptFeatures.cs`](https://github.com/chung6a8m/MyDmsVn/blob/8b599c782816d9cd64f04a45d809a2b8eb1235c8/src/MyDmsVn.Server.Application/Inventory/GoodsReceiptFeatures.cs) creates lines in request order with `LineNumber=index+1`, materializes `ToDto` before Commit, and returns only after Commit. [`SqlGoodsReceiptWriteRepository.cs:104–138,261–308`](https://github.com/chung6a8m/MyDmsVn/blob/8b599c782816d9cd64f04a45d809a2b8eb1235c8/src/MyDmsVn.Server.Infrastructure/Inventory/SqlGoodsReceiptWriteRepository.cs#L104) writes generated IDs back to the line objects and reloads the header version before that DTO is built. Update deletes/reinserts lines; positive returned line IDs are source-supported, **not zero placeholders** and not stable across Update. Validate response cardinality, sequential lineNumber and product against the captured outgoing order before rebasing. Failure to validate a dispatched write response leaves recovery locked.

Create/Update do not query display labels; Get/List join references without an active-only predicate. Retain a committed selection as a local label only until an authoritative label arrives; never overwrite an authoritative inactive label with active lookup data. Note is nullable, max 1000 characters and rejects NUL. Receipt requires 1–200 unique Product lines; duplicate-product validation targets the offending request row.

| Query / source | Source filters and ordering | Frontend rule |
|---|---|---|
| [`SqlGoodsReceiptQueryService.cs:51–122`](https://github.com/chung6a8m/MyDmsVn/blob/8b599c782816d9cd64f04a45d809a2b8eb1235c8/src/MyDmsVn.Server.Infrastructure/Inventory/SqlGoodsReceiptQueryService.cs#L51) + `GoodsReceiptQueries.cs` | Optional Warehouse, Draft/Posted, search ≤128 without NUL; search includes receipt number and reference codes/names, including Products. `ReceiptDate DESC,ReceiptId DESC`; full DTO lines fetched in one bounded page query ordered by receipt/LineNo/line ID; `COUNT_BIG`. | Preserve order/full page payload; no N+1 detail fetch, no Product/date filter or cursor. Page reset on filter changes. |
| [`SqlInventoryQueryService.cs:41–72`](https://github.com/chung6a8m/MyDmsVn/blob/8b599c782816d9cd64f04a45d809a2b8eb1235c8/src/MyDmsVn.Server.Infrastructure/Inventory/SqlInventoryQueryService.cs#L41) + `InventoryQueries.cs` | Optional Warehouse/Product/search ≤256 without NUL; order WarehouseCode, WarehouseId, ProductCode, ProductId. | Read authoritative quantity/value/average; do not calculate average from browser pages. |
| [`SqlInventoryQueryService.cs:75–103`](https://github.com/chung6a8m/MyDmsVn/blob/8b599c782816d9cd64f04a45d809a2b8eb1235c8/src/MyDmsVn.Server.Infrastructure/Inventory/SqlInventoryQueryService.cs#L75) + `InventoryQueries.cs` | Required Warehouse/Product; optional UTC From/To inclusive, From≤To; order PostedAtUtc, LedgerId ascending. Server joins source number, with source-owned fallback. | No query until both keys valid. Preserve UTC fractional precision, signed deltas and server documentNumber; no invented running stock. |

All three query validators require pageNumber>0 and pageSize 1–200; request constructors supply no defaults. UI chooses explicit 1/25, sends absent optional filters by omission, and resets page when any filter or page size changes. B01 freezes both page parameters as required HTTP inputs and nullable response fields as explicit members; the frontend sends omitted optional filters rather than blank status text. Keep long totals exact; avoid converting total/pages to JS Number until a checked bounded operation requires it.

Receipt List/Get use a Serializable read transaction; Balance/Card count and rows have no explicit read transaction, so the UI must not promise a consistent snapshot during concurrent posting. Receipt number uses `D10` formatting and the current [sequence migration](https://github.com/chung6a8m/MyDmsVn/blob/8b599c782816d9cd64f04a45d809a2b8eb1235c8/src/MyDmsVn.Server.DbMigrator/Scripts/006_GoodsReceipt_Number_Sequence.sql) caps it at `9999999999 NO CYCLE`: the current generated form is `GR` plus ten digits. Display the server number; document identity remains receiptId, never a parsed receipt number.

### Feature permissions and error boundary

| Workspace module | HTTP capability `feature` | Independent Application permissions |
|---|---|---|
| `sales` | `sales` (existing) | `Sales.Receipts.Read`, `Sales.Receipts.Write`, `Sales.Receipts.Post` |
| `goods-receipt` | **`goods-receipts`** (B01 whitelist; runtime pending) | `Inventory.GoodsReceipts.Read`, `.Write`, `.Post` |
| `inventory-balances` | `inventory-balances` | `Inventory.Balances.Read` |
| `inventory-stock-card` | `inventory-stock-card` | `Inventory.StockCard.Read` |

Permission sources: [`InventoryPermissionDefinitions.cs`](https://github.com/chung6a8m/MyDmsVn/blob/8b599c782816d9cd64f04a45d809a2b8eb1235c8/src/MyDmsVn.Server.Application/Inventory/InventoryPermissionDefinitions.cs) and [`SalesPermissionDefinitions.cs`](https://github.com/chung6a8m/MyDmsVn/blob/8b599c782816d9cd64f04a45d809a2b8eb1235c8/src/MyDmsVn.Server.Application/Sales/SalesPermissionDefinitions.cs). Catalog Product/Warehouse/Employee lookups separately require `Catalog.Products.Read`, `Catalog.Warehouses.Read`, `Catalog.Employees.Read` ([definitions](https://github.com/chung6a8m/MyDmsVn/blob/8b599c782816d9cd64f04a45d809a2b8eb1235c8/src/MyDmsVn.Server.Application/Catalog/CatalogPermissionDefinitions.cs)); Receipt permission is not a lookup grant. Existing [`authApi.ts`](../../src/infrastructure/http/authApi.ts) and [`authSession.ts`](../../src/infrastructure/http/authSession.ts) only read Sales capabilities today. F02 must use an explicit module→HTTP feature map and deny absent/unknown features, preserving the Sales response.

Reuse [`httpTransport.ts`](../../src/infrastructure/http/httpTransport.ts) bearer/refresh/dispatch fencing. [`readBoundary.ts`](../../src/infrastructure/http/readBoundary.ts) and [`writeBoundary.ts`](../../src/infrastructure/http/writeBoundary.ts) currently import Sales contracts/error schema; extract only truly module-neutral result/context/error types for F03, preserving Sales behavior. `400 ValidationError`, `401`, `403`, `404`, `409 GoodsReceipt.ConcurrencyConflict/GoodsReceipt.AlreadyPosted` and sanitized 5xx follow the canonical backend error envelope; fieldless errors remain visible. Only valid known 400/403/404/409 rejection proves a dispatched write failed; malformed response, dispatched 401 or transport loss remains unknown. No refresh-triggered write replay.

Existing [`ApiResponseMapper.cs:111–183`](https://github.com/chung6a8m/MyDmsVn/blob/8b599c782816d9cd64f04a45d809a2b8eb1235c8/src/MyDmsVn.Server.Application/ApiResponseMapper.cs#L111) maps 401/403 to `Auth.Unauthorized`/`Auth.Forbidden`, preserves `GoodsReceipt.NotFound` and the conflict codes, strips the `Request` prefix when requested by `WireApiController`, and camel-cases each field segment. Thus `Request.Lines[1].ProductId` becomes `lines[1].productId`; reuse this existing behavior, prove Inventory fixtures, and retain fieldless `GoodsReceipt.ValuationOutOfRange` feedback.

### Discrepancy register — B01 resolutions

| ID | Source discrepancy found | B01 resolution / consuming obligation |
|---|---|---|
| C01 | `PagedResult.TotalCount` is long, not an int32 counter. | Canonical nonnegative int64 string including zero, >2^53 and MaxInt64; numeric/overflow vectors reject. F03 must preserve exact counts and bounded page counters. |
| C02 | [`ApiJson.cs:48`](https://github.com/chung6a8m/MyDmsVn/blob/8b599c782816d9cd64f04a45d809a2b8eb1235c8/src/MyDmsVn.Contracts/ApiJson.cs#L48) ignores nulls globally. | B01 requires explicit nulls for response note, postedAtUtc, header/product display names and averageUnitCost. B03 implements WEB3-local projection; Local/Sales global omission behavior stays unchanged. Save input note remains optional/null. |
| C03 | Average is decimal(28,8), signed value is decimal(28,4); Receipt SQL DateTime Kind can be unspecified. | Per-field corpus uses exact bounds and UTC Z with 0–7 fractional digits. B03 labels SQL UTC without local shifting; F03 narrows its codec and preserves precision. No widening receipt input UnitCost or rounding input. |
| C04 | Inventory errors needed executable proof of existing root/nested/fieldless mapping. | Canonical 400/401/403/404/409/500 envelopes retain ApiResponseMapper spellings, duplicate row indices and fieldless valuation errors. F03 maps errors through captured request order; no new error framework. |
| C05 | Canonical directory/manifest absent at initial source inspection. | B01 supplies manifest, golden payloads, vectors and a test-only validator. Web consumes byte-identical files at a full backend commit with SHA-256 provenance; actual validation counts are in evidence. No independently edited Web JSON. |

Separate backend integration dependency: current [`SqlWebRuntimePrincipalValidator.cs`](https://github.com/chung6a8m/MyDmsVn/blob/8b599c782816d9cd64f04a45d809a2b8eb1235c8/src/MyDmsVn.Server.Infrastructure/Operations/SqlWebRuntimePrincipalValidator.cs) does not allow receipt objects/sequence and rejects extra object grants; Stock Card SQL joins GoodsReceipts. B01 records the least-privilege gap matrix; B02 owns provisioning/validator changes and their negative tests. This frontend checkpoint grants no SQL access and does not run SQL.

### Canonical fixture manifest and test ownership

**Authority:** backend `chung6a8m/MyDmsVn`, directory `docs/contracts/web3-v1/`. The [manifest mirror](../../tests/fixtures/web3-v1/manifest.json) enumerates actual files/kinds/statuses/digests; [provenance](../../tests/fixtures/web3-v1/provenance.json) records the immutable B01 commit and copied-byte hashes. The table below maps that corpus to later consumers; runtime scenarios remain unexecuted.

| Canonical corpus family | Required discriminating data | Consuming proof / owner |
|---|---|---|
| Receipt Create/Update/Get/List/Post and capability examples | Exact field names, Draft/Posted, nullable labels/note/time, actual replacement IDs/order, ack without version; independent Read/Write/Post | F03 codecs; F04 W3-REC-01/02/03/07/08/10; B02 host projections |
| Precision and calendar/UTC vectors | Int64 >2^53/max/overflow and numeric token; int32 limits; totalCount C01; decimal(18,4)/(19,4)/(28,4)/(28,8), zero/negative/null; leap day/fractional UTC/non-Z invalid | F03 W3-WIRE-01/02/03; B03 strict parser/projection |
| Receipt cardinality and request-order vectors | 1 and 200 unique rows; 0/201 invalid; duplicate Product on 2 rows; response reorder/cardinality/product mismatch; no request line IDs | F03/F04 W3-WIRE-04/05, W3-EDT-04, W3-REC-09; backend validators |
| Errors and strict malformed bodies/queries | 400 fields/root/fieldless, 401, 403, 404, stale/already-posted 409; unknown members, duplicate keys, malformed UTF8/escapes, inactive references | F03 W3-WIRE-06; F04 W3-REC-05/07/09; B02/B03 input and authorization |
| Balances/Card pages | Authoritative order/total, nullable average, signed receipt/sale movements, exact source types/numbers, inclusive UTC bounds/invalid range | F03/F05 W3-INV-01/02/03; B03 SQL query parity |
| Capability allow/deny combinations | Sales-only, Receipt-only, inventory-only, Write/Post without Read, Catalog lookup denied, unknown feature | F02/F05 W3-AUTH-01/02; B02 server whitelist and actual permission denial |

Response loss, actor switching, rowversion races, page reset, ack→Get denial and no write replay need **scenario controls/tests**, not static JSON proof. Ownership remains in [acceptance matrix](../development/WEB3_ACCEPTANCE_MATRIX.md); B04/B05 own real SQL/HTTPS oracle, F06 integration. Existing regression anchors are `tests/unit/http/{auth,wireReads,wireWrites,wireRuntime}.test.ts`, `tests/unit/sales/{postAcknowledgement,portCommands,recoveryRounds}.test.ts`, `tests/e2e/web2-http.spec.ts` and `tests/pilot/web2-live.spec.ts`; inspected, not executed in F01.

The mirror follows the existing [WEB2 fixture pattern](../../tests/fixtures/web2-v1/README.md): update only from a named backend commit, verify every copied byte hash, and mutate clones in tests. The shared canonical validator is test-only and excluded from production imports. F01 compatibility tests exercise existing Web scalar/envelope/error/arithmetic behavior; they do not implement complete Receipt/Inventory codecs, session commands or HTTP routes. F03 must add strict feature-specific codecs and live adapter checks under its own scope.

**Reuse limits verified during F01:** existing `utcSchema` accepts eight fractional digits, `profitSchema` accepts `-0`, and `priceSchema` accepts a 65-character leading-zero decimal; canonical WEB3 instead limits UTC to seven digits, rejects signed negative zero and caps decimal lexemes at 64 characters. Existing positive-only `longIdSchema` and `quantitySchema` correctly reject zero, so counts/zero balances and signed quantities need their own F03 schemas; canonical rowversion also needs an eight-byte Base64 check. Preserve the existing Sales behavior and narrow the new feature boundary. These are known implementation obligations, not a reason to weaken the corpus or claim full Receipt codec compatibility.
