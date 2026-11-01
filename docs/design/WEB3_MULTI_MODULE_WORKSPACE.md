# WEB3 — Multi-module workspace and document session boundary

**Owner:** ReactWebUI WEB3-F01/F02; adopted design direction 2026-11-01. **State:** DESIGN / NOT IMPLEMENTED. The existing [Workspace contract](WORKSPACE_BEHAVIOR.md), [Foundation](WEB_UI_FOUNDATION.md), [WEB2 integration](WEB2_FRONTEND_INTEGRATION.md) and [Test Policy](../TEST_POLICY.md) remain normative for existing Sales behavior. This doc owns *new* multi-module behavior only.

## 1. Evidence motivating change

Actual current `main` source shows concrete Sales dependencies:

- `src/app/runtime/runtimeDependencies.ts` binds `SalesPort` and `SalesCapabilities` directly to app runtime/auth snapshot.
- `src/app/workspace/panelRegistry.ts` creates `SalesSessionStore` and `createSalesPortCommands`, records keys as [actor, generation, "sales", saleId], opens only `sales` panels and dispatches `openSalesDocument`.
- `src/app/workspace/workspaceController.ts` accepts `SalesSessionStore` and `SaveOutcome`; `closeAll` iterates only Sales sessions.
- `src/app/workspace/workspaceLayouts.ts` and `layoutPersistence.ts` encode/restore Sales component and schemaVersion:1.
- `src/app/workspace/WorkspaceHost.tsx` hardcodes Sales component, toolbar `New Sales`, Sales active session; `commandRouter.ts` binds Sales session store.

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

## 3. Proposed TypeScript seam (not current code)

These are **target contracts to validate**, not declarations already present.

```ts
type ModuleKey =
  | "sales" | "goods-receipt"
  | "inventory-balances" | "inventory-stock-card";

type ActorScope = {
  actorKey: string;
  actorGeneration: number;  // auth generation, never user-controlled
};
type DocumentRef = {
  module: "sales" | "goods-receipt";
  serverId: string | null;   // int64 string, null means new draft
};
type PanelRef = {
  module: ModuleKey;
  kind: "document" | "read-only";
  documentSessionId?: string;
  serverId?: string | null;
  actorScope: ActorScope;
};
interface DocumentCloseAdapter {
  sessionId: string;
  module: "sales" | "goods-receipt";
  captureIdentity(): { actorScope: ActorScope; generation: number; revision: number };
  isPendingOrUnknown(): boolean;
  isDirtyIncludingRaw(): boolean;
  prepareAndSave(): Promise<"saved-clean" | "blocked" | "failed" | "unknown">;
  mayFinalise(identity: unknown): boolean;
  finaliseAfterAdmission(identity: unknown): void;
}
interface FeaturePanelRegistration {
  module: ModuleKey;
  componentId: string;
  kind: "document" | "read-only";
  createTitle(ref: PanelRef): string;
  open(ref: PanelRef): Promise<string>;
  // read-only panels have no DocumentCloseAdapter.
  getDocumentCloseAdapter?(sessionId: string): DocumentCloseAdapter | undefined;
  restore?(ref: PanelRef): Promise<string>;
}
```

The interface names/signatures may be adjusted during F01 source review. They **must not** force client documents to disclose business-specific mutable fields, tokens or raw drafts to layout persistence. `clientLineId` stays within each feature, not panel registry.

**Keys:** distinguish two types of identifiers:

- **Document session identity:** unique ephemeral UUID, actor scope + module + server ID (where present). Same server ID opened twice in the same feature/actor should activate the same document, **not** duplicate. Different module/actor scopes never collide. Unsaved new documents receive distinct client session UUIDs.
- **Read-only panel identity:** module + actor scope + stable filter/instance policy. May allow one StockCard per stock key or explicit multiple instances; F01 must choose and test; do not derive from StockLedger ID alone.
- **Dockview panel identity:** stable presentation reference; a move/remove event is **never** an admitted close. Panel recreation attaches to same live document adapter when actor scope is still current.

## 4. Close, save, navigation and layout invariants

1. Central close intent from tab X, Delete/Backspace, command, group, close-all, logout, layout restore/reset, navigation and app shutdown enters the same admission protocol. Browser unload may only warn; it cannot guarantee durable recovery.
2. Capture session UUID, module, actorKey, actorGeneration, generation and editRevision **before** showing confirmation or starting async. Re-check after awaits. If session swapped/replaced/mutated during Save, never close based on an obsolete revision.
3. Pending or outcome-unknown mutations block Discard and close; only explicit reviewed same-actor recovery can unlock. A successful Save closes **only if** all editor/lookup/raw buffers were flushed and the submitted revision is still current. Cancel leaves document unchanged.
4. Editor ownership: AG Grid may unmount when Dockview moves or changes layout; raw draft, pending lookup, validation and unknown outcomes survive outside the component. Reuse `editorBarrier` pattern per module, never consider `grid.stopEditing()` alone proof that data is committed.
5. Read-only Inventory panels need simple close without draft Save/Post confirmation; nevertheless they capture actor generation and stop showing private data on auth change. They can be re-read after authorized restore.
6. Active toolbar/shortcut is dispatched by *captured active panel/feature*, not the last Sales active document. Sales commands never act on GoodsReceipt or a StockCard. All tab close paths (including Dockview native keyboard) route through admission.
7. Auth forced expiry fences **every** protected feature/panel; voluntary logout must run close-all admission before server revoke. Old actor's dirty/unknown data may remain privately in RAM under recorded ownership but cannot be rendered/mutated by a new login.

## 5. Capabilities and Query cache architecture

Current auth snapshot exposes Sales `{read,write,post}` and `authApi.read("capabilities?feature=sales")`. WEB3 extends the **composition layer**, not JWT claims:

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

The server owns exact feature names/status mapping under [WEB3 server contract](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB3_INVENTORY_HTTP_WIRE.md). Deny unknown/missing capabilities; don't automatically inherit Sales grants. Preserve current `feature=sales` response and Sales adapter behavior while upgrading runtime. A 403 may arrive after a previously true hint; server denial wins and UI keeps safe session state.

Query keys include actorKey and authenticated session/generation plus feature and filters/page. On actor switch, invalidate protected caches and unmount/fence protected panels. After Receipt Post, invalidate **affected** Inventory stock balance/card and receipt list/detail, not Sales editing state or unrelated actor data. Do not put access JWT/cookie into Query keys or logs. No permissions data in localStorage.

## 6. Layout v1 → v2 compatibility

**Observed baseline:** `layoutPersistence.ts` persists `schemaVersion:1`, sanitizes allowed Dockview components and Sales record descriptors. Storage key uses an actor-scoped `mydmsvn.workspace.layout.v1:...` prefix. It does **not** persist draft content. WEB3 migration is explicitly required; blind replacement of serializer would orphan users' saved layouts.

Suggested v2 envelope includes `schemaVersion:2`, validated actorKey/scope, bounded Dockview layout tree, allowed component enum and stable **document references** (`module,serverId`) only for previously Saved persisted documents. Read-only filter descriptors contain only nonsecret filter values; cap tree depth/count/length using current sanitization policy. No `draft`, `rawBuffers`, `unknownSnapshot`, access JWT, refresh token or server credentials. Restore re-fetches authorized data; does **not** resurrect unsaved drafts.

Migration steps:
1. Read v2 when present and validate; otherwise read the old v1 key, parse with the **existing** v1 validator, explicitly map `sales` records to `module=sales` without identity guessing; preserve existing Sales tab ordering/layout to the extent allowed by Dockview.
2. Reject malformed/unknown/cross-actor components, duplicate conflicting panel IDs, oversize values and invalid server IDs. Fail closed to safe default shell; **do not** apply a partially parsed layout or clear in-RAM dirty/unknown documents.
3. Write v2 only after an admitted current-generation layout save, preserving v1 until migration success. Once the migration is proven with tests, choose explicit cleanup policy; do not delete all v1 storage on first startup.
4. On restore/reset, run close-all admission for all document stores first. Await result and re-check identity generation; read-only panel data reloads only after auth. Test remount and deferred/failed load, not just JSON snapshots.
5. Separate scope for different authenticated users; same-user new auth session may reuse **layout geometry only**, not pending document ownership/drafts. Never serialize an unknown Post state into v2 to claim recovery.

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
| v1 Sales layout restore under v2 | Valid Sales panels survive migration; invalid/unknown/cross-actor sanitizes without changing live drafts |
| Logout, re-login same user, login different user | Old private drafts fenced; read-only caches invalidated; no privilege bleed |
| Sales no feature permission, Receipt has permission (and reverse) | Each capability independent, server denial respected |
| Missing backend/fake Lab exclusion | Production artifact contains only HTTP runtime; no fallback mock actor |
| Keyboard and popup/editor during tab switch | No lost raw input, caret/focus protocol preserved for Sales and Receipt |

Run focused unit/component, existing Sales AG Grid/Dockview Playwright and production artifact guard as appropriate. WEB3 backend SQL/browser pilot is distinct; fake tests never prove posted stock. **Evidence must state exact candidate and test counts; this document grants no automated PASS.**
