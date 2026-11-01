import type { SerializedDockview } from "dockview";
import { decodeLayout, type LayoutScope, type LayoutResult } from "./layoutPersistence";
import { sanitizeLayoutGeometry } from "./layoutGeometry";
export type LayoutPanelDescriptor =
  | { kind: "records"; module: "sales" | "goods-receipt" }
  | { kind: "document"; module: "sales" | "goods-receipt"; serverId: string }
  | { kind: "read-only"; module: "inventory-balances" | "inventory-stock-card" };
export interface LiveLayoutPanel extends LayoutScope {
  // Null means an owned unsaved document: its draft never becomes layout state.
  descriptor: LayoutPanelDescriptor | null;
}
const maxPanels = 128;
const invalid = (): LayoutResult => ({
  kind: "invalid",
  message: "Bố cục đã lưu không hợp lệ hoặc không thuộc phạm vi hiện tại. Dùng bố cục mặc định.",
});
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("object");
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) throw Error("unknown-field");
}
function actorKey(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 200) throw Error("actor");
  return value;
}
function validateScope(scope: LayoutScope) {
  actorKey(scope.actorKey);
  if (!Number.isSafeInteger(scope.actorGeneration) || scope.actorGeneration < 0) throw Error("generation");
}
function descriptor(value: unknown): LayoutPanelDescriptor {
  const input = object(value);
  exactKeys(input, input.kind === "document" ? ["kind", "module", "serverId"] : ["kind", "module"]);
  if (input.kind === "read-only" && (input.module === "inventory-balances" || input.module === "inventory-stock-card"))
    return { kind: "read-only", module: input.module };
  if (input.module !== "sales" && input.module !== "goods-receipt") throw Error("module");
  if (input.kind === "records") return { kind: "records", module: input.module };
  if (input.kind !== "document") throw Error("kind");
  const id = input.serverId;
  // Validate as text before BigInt; no Number conversion can round record identity.
  if (typeof id !== "string" || !/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n)
    throw Error("server-id");
  return { kind: "document", module: input.module, serverId: id };
}

/** Canonical presentation IDs contain no live session UUID or authenticated generation. */
export function createLayoutPanel(value: LayoutPanelDescriptor): SerializedDockview["panels"][string] {
  const ref = descriptor(value);
  const id = ref.kind === "document" ? `${ref.module}-${ref.serverId}`
    : ref.kind === "records" ? ref.module === "sales" ? "foundation-catalog" : "goods-receipt-records"
    : ref.module;
  const contentComponent = ref.kind === "records" ? ref.module === "sales" ? "catalog" : "goods-receipt-records" : ref.module;
  const title = ref.kind === "document" ? `${ref.module === "sales" ? "Sales" : "Nhập kho"} ${ref.serverId}`
    : ref.kind === "records" ? ref.module === "sales" ? "Danh sách Sales" : "Danh sách nhập kho"
    : ref.module === "inventory-balances" ? "Tồn kho" : "Thẻ kho";
  return { id, contentComponent, title, renderer: "always", params: ref };
}

function sanitize(layout: unknown, scope: LayoutScope, live?: Record<string, LiveLayoutPanel>) {
  const input = object(layout), panels = object(input.panels);
  if (Object.keys(panels).length > maxPanels) throw Error("panel-limit");
  const remap = new Map<string, string>();
  const candidates: SerializedDockview["panels"] = {};
  let dropped = 0;
  for (const [id, raw] of Object.entries(panels)) {
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(id) || ["__proto__", "prototype", "constructor"].includes(id)) throw Error("panel-id");
    const panel = object(raw);
    if (panel.id !== id) throw Error("panel-id");
    if (!["catalog", "sales", "goods-receipt-records", "goods-receipt", "goods-receipt-list", "goods-receipt-document", "inventory-balances", "inventory-stock-card"].includes(panel.contentComponent as string))
      throw Error("component");
    if (live && !Object.hasOwn(live, id)) throw Error("unregistered-panel");
    const owner = live?.[id];
    if (live && !owner) throw Error("unregistered-panel");
    if (owner && (owner.actorKey !== scope.actorKey || owner.actorGeneration !== scope.actorGeneration || owner.descriptor === null)) {
      dropped++;
      continue;
    }
    const ref = descriptor(owner ? owner.descriptor : panel.params);
    const safe = createLayoutPanel(ref);
    // Production names map to the frozen v2 presentation IDs on encode only.
    // Stored envelopes still require canonical components and strict descriptors.
    const component = live && panel.contentComponent === "goods-receipt-list" ? "goods-receipt-records"
      : live && panel.contentComponent === "goods-receipt-document" ? "goods-receipt" : panel.contentComponent;
    if (component !== safe.contentComponent) throw Error("component");
    if (!live && id !== safe.id) throw Error("stable-id");
    if (Object.hasOwn(candidates, safe.id)) throw Error("duplicate-panel");
    remap.set(id, safe.id);
    candidates[safe.id] = safe;
  }
  return sanitizeLayoutGeometry(input, remap, candidates, createLayoutPanel({ kind: "records", module: "sales" }), dropped, !live);
}

/** Encode solely from the app-owned registry, never native panel params/drafts. */
export function encodeLayoutV2(layout: SerializedDockview, live: Record<string, LiveLayoutPanel>, scope: LayoutScope): string {
  validateScope(scope);
  const safe = sanitize(layout, scope, live);
  const raw = JSON.stringify({ schemaVersion: 2, registryVersion: 2, scope: { actorKey: scope.actorKey }, ...safe });
  if (raw.length > 200000) throw Error("length");
  return raw;
}

export function decodeLayoutV2(raw: string, scope: LayoutScope): LayoutResult {
  try {
    validateScope(scope);
    if (typeof raw !== "string" || raw.length > 200000) throw Error("length");
    const envelope = object(JSON.parse(raw)), stored = object(envelope.scope);
    exactKeys(envelope, ["schemaVersion", "registryVersion", "scope", "layout", "dropped"]);
    exactKeys(stored, ["actorKey"]);
    if (envelope.schemaVersion !== 2 || envelope.registryVersion !== 2 || actorKey(stored.actorKey) !== scope.actorKey)
      throw Error("envelope");
    const dropped = envelope.dropped ?? 0;
    if (!Number.isSafeInteger(dropped) || (dropped as number) < 0 || (dropped as number) > maxPanels) throw Error("dropped");
    const safe = sanitize(envelope.layout, scope);
    return { kind: "ready", layout: safe.layout, dropped: (dropped as number) + safe.dropped };
  } catch { return invalid(); }
}

/** Migration preserves the legacy sanitizer, then applies v2's strict record-ID boundary. */
export function migrateLayoutV1(raw: string, scope: LayoutScope): LayoutResult {
  const legacy = decodeLayout(raw, scope);
  if (legacy.kind === "invalid") return legacy;
  try {
    const live: Record<string, LiveLayoutPanel> = {};
    for (const [id, panel] of Object.entries(legacy.layout.panels)) {
      live[id] = { ...scope, descriptor: panel.contentComponent === "catalog"
        ? { kind: "records", module: "sales" }
        : { kind: "document", module: "sales", serverId: panel.params!.saleId as string } };
    }
    const safe = sanitize(legacy.layout, scope, live);
    return { kind: "ready", layout: safe.layout, dropped: legacy.dropped + safe.dropped };
  } catch { return invalid(); }
}
