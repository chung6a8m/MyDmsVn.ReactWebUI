# WEB3 — Goods Receipt editing and read-only Inventory Web UX

**Owner:** frontend `WEB3-F03–F05`. **Status:** selected feature contract / NOT IMPLEMENTED. Use [WEB3 workspace](WEB3_MULTI_MODULE_WORKSPACE.md), [existing keyboard/lookup](LOOKUP_AND_GRID_EDITING.md), [existing Sales pilot](SALES_PILOT.md), [WEB2 HTTP](WEB2_FRONTEND_INTEGRATION.md) and [canonical backend WEB3 wire](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB3_INVENTORY_HTTP_WIRE.md). Reuse shadcn **Nova/Base UI**, Tailwind v4 default tokens, AG Grid **Community**, Dockview, Floating UI, TanStack Query/Zustand. Do not adopt WinFormsKit or visual Business Compact.

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
- List: show server-owned total and 1-based page navigation; pageSize within backend allowed 1–200 (UI default to be explicitly selected in F01), reset page on Warehouse/Status/Search change; no fake cursor. Switching from list to detail must perform central dirty-close admission if replacing an existing session; opening another tab need not close current.
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
