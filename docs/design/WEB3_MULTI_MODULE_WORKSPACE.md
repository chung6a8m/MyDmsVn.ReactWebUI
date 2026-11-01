# WEB3 — Multi-module workspace and document session boundary

**Owner:** ReactWebUI WEB3-F01/F02; adopted design direction 2026-11-01. **State:** F02 minimum seam IMPLEMENTED; bounded verification in [F02 evidence](../evidence/web3/20261101-web3-02-multi-module-workspace.md). Real Receipt/Inventory integration remains F03–F05. The existing [Workspace contract](WORKSPACE_BEHAVIOR.md), [Foundation](WEB_UI_FOUNDATION.md), [WEB2 integration](WEB2_FRONTEND_INTEGRATION.md) and [Test Policy](../TEST_POLICY.md) remain normative for existing Sales behavior. This doc owns *new* multi-module behavior only.

**F01 checkpoint:** the Web source audit below is pinned to `8163dc99500ffffc94a3aa6a9c87e25e3db49726`. The selected F02 decisions are design, not implemented interfaces or runtime evidence. Backend B01 supplies the canonical contract/corpus under the Owner-authorized WEB3-01 extension; the [immutable mirror](../../tests/fixtures/web3-v1/README.md) records the separate backend commit. Review/acceptance state remains in each owning plan. See [checkpoint evidence and remaining gates](../evidence/web3/20261101-web3-01-contract-checkpoint.md).

**Baseline provenance:** source observations and line references below describe pre-F02 `1fa3708`, not the refactored HEAD. Current ownership and measured behavior are recorded in the linked F02 evidence; normative invariants remain unchanged.

## 1. Evidence motivating change

Source links and line references in this section refer to the pinned Web revision above.

| Current call site | Observed ownership | Small F02 boundary |
|---|---|---|
| [runtimeDependencies.ts:5–29](../../src/app/runtime/runtimeDependencies.ts#L5-L29) | Runtime injects `SalesPort` and one `SalesCapabilities` triple | App composition owns actor scope and feature capability map; typed ports remain feature dependencies |
| [panelRegistry.ts:26–38](../../src/app/workspace/panelRegistry.ts#L26-L38), [95–121](../../src/app/workspace/panelRegistry.ts#L95-L121), [242–299](../../src/app/workspace/panelRegistry.ts#L242-L299) | Creates Sales store/draft; deduplicates `[actorKey,actorGeneration,"sales",saleId]`; opens Sales panels | Registry owns module/panel identity; Sales adapter retains draft construction, reads, record binding and line reconciliation |
| [panelRegistry.ts:200–240](../../src/app/workspace/panelRegistry.ts#L200-L240), [351–389](../../src/app/workspace/panelRegistry.ts#L351-L389) | Attach/remount preserves live sessions; remove/add never dispose; admitted finalization removes panel and session | Generic layout attachment plus feature-owned finalization after admission |
| [workspaceController.ts:19–28](../../src/app/workspace/workspaceController.ts#L19-L28), [90–147](../../src/app/workspace/workspaceController.ts#L90-L147), [155–231](../../src/app/workspace/workspaceController.ts#L155-L231) | Close coordinator reads/writes Sales state, titles and issues; snapshots only Sales membership | Coordinator owns intent sequencing; feature adapter owns dirty/busy, Save/barrier, feedback, uncertainty and finalization checks |
| [commandRouter.ts:7–34](../../src/app/workspace/commandRouter.ts#L7-L34), [WorkspaceHost.tsx:37–43](../../src/app/workspace/WorkspaceHost.tsx#L37-L43), [90–129](../../src/app/workspace/WorkspaceHost.tsx#L90-L129) | Ready Sales session capture, hardcoded components/creation; `mark` is an edit-harness command, not Save/Post | Capture active registered panel/module; dispatch only its permitted actions |
| [DocumentTab.tsx:9–25](../../src/app/workspace/DocumentTab.tsx#L9-L25), [WorkspaceHost.tsx:158–181](../../src/app/workspace/WorkspaceHost.tsx#L158-L181) | `sessionId` implies document; other tabs hide close. X/middle-click and native Delete/Backspace enter admission; group/context menus are empty | Explicit records/document/read-only close policies; do not claim group close is already exposed |
| [workspaceLayouts.ts:13–19](../../src/app/workspace/workspaceLayouts.ts#L13-L19), [91–123](../../src/app/workspace/workspaceLayouts.ts#L91-L123), [layoutPersistence.ts:72–125](../../src/app/workspace/layoutPersistence.ts#L72-L125) | Layout code consumes Sales store and `saleId` directly | Consume safe feature descriptors/restore callbacks, never mutable drafts |
| [salesSessionStore.ts:21–58](../../src/features/sales/salesSessionStore.ts#L21-L58), [salesCommands.ts:206–359](../../src/features/sales/salesCommands.ts#L206-L359), [editorBarrier.ts:1–84](../../src/shared/grid/editorBarrier.ts#L1-L84) | Sales owns raw/lookup/recovery state and mutation rules; `shared/grid/editorBarrier.ts` is also Sales-specific | Retain feature stores, normalizers and recovery. Reuse the flush protocol only where both consumers need it |

This was appropriate for WEB2 Sales pilot; **do not label it a WEB2 bug**. WEB3 must prove that a second editable feature and two read-only panels can coexist with no behavior drift.

## 2. Clear ownership and dependencies

```text
App providers: auth + transport + QueryClient + theme (existing)
   |
   +-- MultiModuleWorkspaceHost / Dockview (layout only)
   |      +-- FeaturePanelRegistry (module descriptors + safe opener)
   |      +-- DocumentCloseCoordinator (per-document admission and close-all)
   |      +-- ActivePanelCommandDispatcher (feature-scoped action)
   |      +-- LayoutPersistenceV2 (layout identities only, no draft)
   |
   +-- Sales feature adapter       -> SalesSessionStore -> SalesPort
   +-- GoodsReceipt feature adapter-> ReceiptSessionStore -> GoodsReceiptPort
   +-- Inventory Balances panel    -> InventoryPort read + TanStack Query
   +-- Inventory StockCard panel   -> InventoryPort read + TanStack Query
                           All HTTP ports use existing bearer transport/auth.
```

**Shared layer may own:** feature/panel registration, document-scoped identity, close admission, layout serialization/validation, actor generation fencing, bounded command dispatch, focus policy, UI feedback route. **Shared layer must not own:** business DTOs, Sale/Receipt validation, pricing, duplicate Product semantics, server Post/recovery proofs, Product lookup state, SQL ledger, token/session issuance.

Do not create a global `DocumentStore<any>` or generic ERP Form Engine. A small interface plus two adapters is enough; keep Sales store shape intact until tests prove extraction is safe.

## 3. Selected minimum seam (design, not current code)

These are **F02 design shapes**; implemented names and ownership are linked from F02 evidence. Runtime `DocumentIdentity` flattens `actorKey`/`actorGeneration` while preserving the same scope fence. Registration is keyed by `(module, kind)`, so the same editable module has separate records and document registrations. Internal `goods-receipt` stays singular; its HTTP capability feature/resource mapping is explicitly `goods-receipts` (plural), as frozen by B01. Never derive HTTP names by copying `ModuleKey`.

```ts
type ModuleKey =
  | "sales" | "goods-receipt"
  | "inventory-balances" | "inventory-stock-card";
type DocumentModule = "sales" | "goods-receipt";

type ActorScope = {
  actorKey: string;
  actorGeneration: number;  // auth generation, never user-controlled
};
type PanelRef = { actorScope: ActorScope } & (
  | { kind: "records"; module: DocumentModule }
  | { kind: "document"; module: DocumentModule;
      documentSessionId: string; serverId: string | null }
  | { kind: "read-only";
      module: "inventory-balances" | "inventory-stock-card" }
);
type DocumentIdentity = {
  sessionId: string;
  module: DocumentModule;
  actorScope: ActorScope;
  generation: number;
  editRevision: number;
};
interface DocumentCloseAdapter {
  captureIdentity(): DocumentIdentity;
  title(): string;
  isCloseBlocked(): boolean; // preparing, pending or outcome-unknown
  isDirtyIncludingRaw(): boolean;
  prepareAndSave(identity: DocumentIdentity):
    Promise<"saved-clean" | "blocked" | "failed" | "unknown">;
  mayFinalise(identity: DocumentIdentity): boolean;
  finaliseAfterAdmission(identity: DocumentIdentity): boolean;
}
interface FeaturePanelRegistration {
  module: ModuleKey;
  componentId: string;
  kind: PanelRef["kind"];
  createTitle(ref: PanelRef): string;
  open(ref: PanelRef): Promise<string>;
  // Records/read-only panels have no DocumentCloseAdapter.
  getDocumentCloseAdapter?(sessionId: string): DocumentCloseAdapter | undefined;
  restore?(ref: PanelRef): Promise<string>;
}
// Registry enumeration delegates to every feature store, including detached documents.
interface DocumentRegistry {
  documents(scope: ActorScope): readonly DocumentCloseAdapter[];
}
```

F02 may adjust names without widening ownership. These seams **must not** expose business-specific mutable fields, tokens or raw drafts to layout persistence. `clientLineId` stays within each feature. Feature adapters own command results, validation focus/feedback and recovery; the coordinator does not write a feature's mutation state or assume the Sales Post acknowledgement shape.

**Identity, instances and captions:**

- **Document session identity:** unique ephemeral UUID, actor scope + module + server ID (where present). Same server ID opened twice in the same feature/actor should activate the same document, **not** duplicate. Different module/actor scopes never collide. Unsaved new documents receive distinct client session UUIDs.
- **Records panel identity:** one Sales list and one Receipt list per module + actor scope; opening an existing list activates it. Captions are `Danh sách Sales` and `Danh sách nhập kho`.
- **Read-only panel identity:** one `inventory-balances` and one `inventory-stock-card` panel per actor scope, with captions `Tồn kho` and `Thẻ kho`. Filters/page belong to the panel, not its identity; a filter change resets pagination. Opening a stock key retargets the singleton only after checking the captured actor generation. StockLedger ID never becomes panel identity. Filter fields and query paging remain owned by the [Inventory UI contract](WEB3_GOODS_RECEIPT_INVENTORY_UI.md).
- **Document captions:** `Sales mới` / `Nhập kho mới` for unsaved documents; `Sales {serverNumber}` / `Nhập kho {serverNumber}` once the server number is available, with the validated server ID as fallback during load or when the number is absent. Never fabricate a receipt number. Current Sales captions use ID ([panelRegistry.ts:118](../../src/app/workspace/panelRegistry.ts#L118)); server-number captions are the F02 design choice. New documents retain distinct session UUIDs even when captions match.
- **Dockview panel identity:** stable presentation reference; a move/remove event is **never** an admitted close. Panel recreation attaches to same live document adapter when actor scope is still current.

## 4. Close, save, navigation and layout invariants

1. Central close intent from tab X, Delete/Backspace, command, group, close-all, logout, layout restore/reset, navigation and app shutdown enters the same admission protocol. Browser unload may only warn; it cannot guarantee durable recovery.
2. Capture session UUID, module, actorKey, actorGeneration, generation and editRevision **before** showing confirmation or starting async. Re-check after awaits. If session swapped/replaced/mutated during Save, never close based on an obsolete revision.
3. Pending or outcome-unknown mutations block Discard and close; only explicit reviewed same-actor recovery can unlock. A successful Save closes **only if** all editor/lookup/raw buffers were flushed and the submitted revision is still current. Cancel leaves document unchanged.
4. Editor ownership: AG Grid may unmount when Dockview moves or changes layout; raw draft, pending lookup, validation and unknown outcomes survive outside the component. Reuse `editorBarrier` pattern per module, never consider `grid.stopEditing()` alone proof that data is committed.
5. Read-only Inventory panels need simple close without draft Save/Post confirmation; nevertheless they capture actor generation and stop showing private data on auth change. They can be re-read after authorized restore.
6. Active toolbar/shortcut is dispatched by *captured active panel/feature*, not the last Sales active document. Sales commands never act on GoodsReceipt or a StockCard. All tab close paths (including Dockview native keyboard) route through admission.
7. Auth forced expiry fences **every** protected feature/panel; voluntary logout must run close-all admission before server revoke. Old actor's dirty/unknown data may remain privately in RAM under recorded ownership but cannot be rendered/mutated by a new login.
8. Global admission blocks new opens, captures owned document membership across all modules and rechecks each captured identity before finalization. Preserve sequential close-all semantics: earlier admitted documents stay closed when a later document cancels or blocks; this is not an atomic transaction or rollback. Before reporting success, recheck the captured actor scope and confirm no owned current-scope documents remain. Records/read-only panels close through their simple policy only within the admitted operation.

**Baseline versus F02 strengthening:** current close-all snapshots Sales membership once; only layout operations additionally lock entry and check for remaining sessions ([workspaceController.ts:129–147](../../src/app/workspace/workspaceController.ts#L129-L147), [workspaceLayouts.ts:141–151](../../src/app/workspace/workspaceLayouts.ts#L141-L151), [panelRegistry.ts:246](../../src/app/workspace/panelRegistry.ts#L246)). Current close Save captures edit revision when Save is chosen ([workspaceController.ts:172](../../src/app/workspace/workspaceController.ts#L172)); the typed pre-await identity and global membership rules above are intended F02 strengthening, not claims about existing implementation or reproduced bugs.

## 5. Capabilities and Query cache architecture

Current auth snapshot exposes Sales `{read,write,post}` and `authApi.read("capabilities?feature=sales")` ([authSession.ts:33–50](../../src/infrastructure/http/authSession.ts#L33-L50)). Production already retains separate runtime contexts by auth generation and clears each runtime's QueryClient on scope change/unmount ([ApplicationEntry.tsx:10–47](../../src/app/runtime/ApplicationEntry.tsx#L10-L47), [createProductionRuntime.tsx:16–32](../../src/app/runtime/createProductionRuntime.tsx#L16-L32)). `layouts.switchActor` is a Lab control, not production authentication ([SalesScenarioControls.tsx:43](../../src/lab/SalesScenarioControls.tsx#L43)). WEB3 extends the **composition layer**, not JWT claims:

```ts
type ModuleCapabilities = {
  sales: { read: boolean; write: boolean; post: boolean };
  "goods-receipt": { read: boolean; write: boolean; post: boolean };
  "inventory-balances": { read: boolean };
  "inventory-stock-card": { read: boolean };
};
interface FeatureAuthSnapshot extends ActorScope {
  features: ModuleCapabilities;
}
```

The server owns exact feature names/status mapping under [WEB3 server contract](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB3_INVENTORY_HTTP_WIRE.md); use the explicit `goods-receipt` → `goods-receipts` mapping above, as frozen by B01; endpoint implementation remains B02. Deny unknown/missing capabilities; don't automatically inherit Sales grants. Preserve current `feature=sales` response and Sales adapter behavior while upgrading runtime. A 403 may arrive after a previously true hint; server denial wins and UI keeps safe session state.

Query keys include actorKey and authenticated session/generation plus feature and filters/page. On actor switch, invalidate protected caches and unmount/fence protected panels. After Receipt Post, invalidate **affected** Inventory stock balance/card and receipt list/detail, not Sales editing state or unrelated actor data. Do not put access JWT/cookie into Query keys or logs. No permissions data in localStorage.

## 6. Layout v1 → v2 compatibility

**Observed v1 baseline:** [workspaceLayouts.ts:10–11](../../src/app/workspace/workspaceLayouts.ts#L10-L11) keys storage by stable actorKey only. [layoutPersistence.ts:39–61](../../src/app/workspace/layoutPersistence.ts#L39-L61) validates an optional legacy actorGeneration, but [230–277](../../src/app/workspace/layoutPersistence.ts#L230-L277) persists only actorKey and compares only that key on restore. Envelopes have `schemaVersion:1` and `registryVersion:1`. The sanitizer drops unknown components, unsaved documents and non-grid state, prunes their groups and supplies a catalog fallback; malformed/duplicate/cross-actor structures reject ([72–225](../../src/app/workspace/layoutPersistence.ts#L72-L225)). Existing dirty/unknown documents can contribute their persisted record reference only; drafts and mutation evidence never persist.

V1 limits are 128 panels, depth 12, 256 nodes, identifier length 200, dimensions 0–100000 and raw JSON length 200000. Its record regex accepts positive strings up to **64 digits**, not strict int64 ([layoutPersistence.ts:13–35](../../src/app/workspace/layoutPersistence.ts#L13-L35), [133–134](../../src/app/workspace/layoutPersistence.ts#L133-L134), [246](../../src/app/workspace/layoutPersistence.ts#L246)). Persistent restore creates fresh session UUIDs and performs public reads; in-memory remount instead reattaches existing live sessions ([workspaceLayouts.ts:91–123](../../src/app/workspace/workspaceLayouts.ts#L91-L123), [195–218](../../src/app/workspace/workspaceLayouts.ts#L195-L218), [245–285](../../src/app/workspace/workspaceLayouts.ts#L245-L285)).

**Selected v2 design:** `mydmsvn.workspace.layout.v2:${encodeURIComponent(actorKey)}` stores a `schemaVersion:2` envelope with stable actorKey scope, bounded Dockview geometry, registered panel kind/module and safe restore descriptors. Persist no actorGeneration or session UUID. Document references contain only module and validated server ID for previously persisted documents; records/read-only descriptors contain only allowlisted nonsecret filters. Keep the existing geometry/count/length bounds. No draft, raw/lookup buffers, unknown snapshot, access JWT, refresh token or credentials. Restore obtains the current authenticated generation and re-fetches authorized data; no unsaved-draft or unknown-outcome recovery is implied.

Migration steps:
1. Prefer valid v2 when its key is present. An invalid present v2 fails to the safe shell after admission; **do not fall back to stale v1**. Only when v2 is absent, parse v1 with its existing sanitizer, including its unknown-component dropping behavior; map validated `catalog` to Sales records and `sales` references to Sales documents, preserving ordering/geometry where supported.
2. Before accepting migrated references, require every v1 record ID to pass the strict positive int64 string validator. A 64-digit legacy value outside int64 fails the migration safely; never truncate, coerce through JavaScript Number or silently invent identity. V2 rejects unknown module/kind/component, malformed/cross-actor descriptors, duplicates, oversize values and invalid IDs as a whole. Never apply partially parsed state or clear live dirty/unknown documents outside admission.
3. Write v2 only from the validated current-generation layout path after required close admission. **Retain the v1 key throughout WEB3, including after successful migration; no v1 deletion/cleanup is authorized in this roadmap.**
4. On restore/reset, run close-all admission for all document stores first. Await result and re-check identity generation; read-only panel data reloads only after auth. Test remount and deferred/failed load, not just JSON snapshots.
5. Separate scope for different authenticated users; a same-user new auth session may reuse geometry and safe saved-record/filter references, then read them under the new scope. It never inherits old document ownership, drafts or mutation evidence. Never serialize unknown Post state into v2 to claim recovery.

## 7. Migration sequence and safety checkpoints

**F02-A:** Add registry and adapter types around existing Sales without changing behavior. Tests exercise Sales opening, moving tab, native close paths, close-all and actor scope.  
**F02-B:** Move `workspaceController` and `commandRouter` behind small `DocumentCloseAdapter`/command dispatcher. Sales remains reference consumer; no generic mutation authority.  
**F02-C:** Implement authenticated feature capabilities and active-panel toolbar dispatch; preserve production Lab isolation and startup.  
**F02-D:** Implement v2 codec/migration and tests, then add a **minimal second receipt stub adapter with fake port** to prove both module lifetimes (not production fake fallback).  
**F02-E:** Integrate real Receipt/Inventory adapters in F03–F05, remove temporary seams only when two real consumers are verified.

Do not combine F02 with the full F04 feature in a single refactor PR. If a generic abstraction exceeds the amount of code needed by two consumers or imports receipt/sale commands into shared, stop and simplify.

## 8. Regression/acceptance checklist

| Scenario | Required proof |
|---|---|
| Open same Sale and Receipt with overlapping numeric ID | Different module keys, independent drafts, correct active toolbar |
| Two new unsaved docs of each type | Different session UUIDs, no collapse, distinct client line identities |
| Dockview move/remove/add and split | No document disposal/dirty loss; active command remains correct |
| Close individual/all, reset and restore | Cancel/Discard/Save barrier per owned doc, pending/unknown blocked across both modules |
| Sales dirty + Receipt clean/unknown | close-all cannot bypass Sales or Receipt; no unintentional mutation |
| Open during global admission; later Cancel/block | New opens blocked; all feature membership captured; earlier admitted closes stay closed; success requires no owned current-scope documents |
| Records and Inventory singleton policies | Reopen activates one panel; filter changes reset pagination; stale-actor stock-key retarget rejected |
| v1 Sales layout restore under v2 | V1 sanitizer preserved, strict int64 migration enforced, v1 retained; valid Sales geometry/references survive |
| Invalid present v2 or unknown v2 panel | Whole v2 fails safe without stale-v1 fallback or bypassing live-document admission |
| Logout, re-login same user, login different user | Old private drafts fenced; read-only caches invalidated; no privilege bleed |
| Sales no feature permission, Receipt has permission (and reverse) | Each capability independent, server denial respected |
| Missing backend/fake Lab exclusion | Production artifact contains only HTTP runtime; no fallback mock actor |
| Keyboard and popup/editor during tab switch | No lost raw input, caret/focus protocol preserved for Sales and Receipt |

Run focused unit/component, existing Sales AG Grid/Dockview Playwright and production artifact guard as appropriate. WEB3 backend SQL/browser pilot is distinct; fake tests never prove posted stock. **Evidence must state exact candidate and test counts; this document grants no automated PASS.**

**Source-inspected regression owners (not new execution results):** [sessionIdentity.test.ts:9](../../tests/unit/workspace/sessionIdentity.test.ts#L9), [closeAdmission.test.ts:27](../../tests/unit/workspace/closeAdmission.test.ts#L27), [runtimeDependencies.test.ts:73](../../tests/unit/workspace/runtimeDependencies.test.ts#L73), [runtimeInjection.test.tsx:38](../../tests/components/sales/runtimeInjection.test.tsx#L38), [layoutPersistence.test.ts:68](../../tests/unit/workspace/layoutPersistence.test.ts#L68), [workspaceLayouts.test.ts:102](../../tests/unit/workspace/workspaceLayouts.test.ts#L102) and [layoutRuntime.test.ts:4](../../tests/unit/workspace/layoutRuntime.test.ts#L4) cover the existing identity/admission/auth/layout boundaries. Preserve Sales mutation ownership in [salesCommands.test.ts:9](../../tests/unit/sales/salesCommands.test.ts#L9) and [portCommands.test.ts:45](../../tests/unit/sales/portCommands.test.ts#L45). Browser boundary owners are [workspace.spec.ts:40](../../tests/e2e/workspace.spec.ts#L40), [layout-restore.spec.ts:223](../../tests/e2e/layout-restore.spec.ts#L223), [sales-editing.spec.ts:247](../../tests/e2e/sales-editing.spec.ts#L247) and [web2-http.spec.ts:92](../../tests/e2e/web2-http.spec.ts#L92); their fake/HTTP/real-pilot evidence remains separate under Test Policy.
