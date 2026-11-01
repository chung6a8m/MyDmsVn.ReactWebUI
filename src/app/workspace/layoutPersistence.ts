import type { SerializedDockview } from "dockview";
import { sanitizeLayoutGeometry } from "./layoutGeometry";

interface LegacyLayoutSession extends LayoutScope {
  saleId: string | null;
}

export interface LayoutScope {
  deploymentEpoch?: string;
  actorKey: string;
  actorGeneration: number;
}
export type LayoutResult =
  | { kind: "ready"; layout: SerializedDockview; dropped: number }
  | { kind: "invalid"; message: string };
type ObjectValue = Record<string, unknown>;
const maxPanels = 128;
const recordId = /^[1-9]\d{0,63}$/;
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("object");
  return value as ObjectValue;
}
function identifier(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]{1,200}$/.test(value) ||
    ["__proto__", "prototype", "constructor"].includes(value)
  )
    throw Error("identifier");
  return value;
}
function validScope(value: unknown, persisted = false): LayoutScope {
  const scope = object(value);
  // Legacy v1 envelopes included a transient generation. Validate it if present,
  // but only stable actor identity belongs to persisted layout scope.
  const generation =
    persisted && scope.actorGeneration === undefined
      ? 0
      : scope.actorGeneration;
  if (
    Object.keys(scope).some(
      (key) => !["actorKey", "actorGeneration"].includes(key),
    ) ||
    typeof scope.actorKey !== "string" ||
    !scope.actorKey ||
    scope.actorKey.length > 200 ||
    !Number.isSafeInteger(generation) ||
    (generation as number) < 0
  )
    throw Error("scope");
  return {
    actorKey: scope.actorKey,
    actorGeneration: generation as number,
  };
}
const catalogPanel = () => ({
  id: "foundation-catalog",
  contentComponent: "catalog",
  title: "Danh sách Sales",
  renderer: "always" as const,
});

/** Rebuild from a whitelist. Extras (including injected draft params) are stripped,
 * never spread into the persisted object or passed to Dockview.fromJSON. */
function sanitize(
  value: unknown,
  scope: LayoutScope,
  sessions?: Record<string, LegacyLayoutSession>,
) {
  const input = object(value),
    inputPanels = object(input.panels);
  if (Object.keys(inputPanels).length > maxPanels) throw Error("panel-limit");
  const remap = new Map<string, string>();
  const candidates: SerializedDockview["panels"] = {};
  let dropped = 0;
  for (const [key, raw] of Object.entries(inputPanels)) {
    identifier(key);
    const panel = object(raw);
    if (panel.id !== key) throw Error("panel-id");
    if (panel.contentComponent === "catalog") {
      if (candidates["foundation-catalog"]) throw Error("duplicate-catalog");
      remap.set(key, "foundation-catalog");
      candidates["foundation-catalog"] = catalogPanel();
    } else if (panel.contentComponent === "sales") {
      // Native params are not an authority: only the live application registry is.
      const session = sessions?.[key];
      if (
        sessions &&
        (!session ||
          session.actorKey !== scope.actorKey ||
          session.actorGeneration !== scope.actorGeneration ||
          session.saleId === null)
      ) {
        dropped++;
        continue;
      }
      const id = sessions ? session!.saleId : object(panel.params).saleId;
      if (typeof id !== "string" || !recordId.test(id)) throw Error("sale-id");
      const stableId = `sales-${id}`;
      if (!sessions && key !== stableId) throw Error("stable-id");
      if (candidates[stableId]) throw Error("duplicate-record");
      remap.set(key, stableId);
      candidates[stableId] = {
        id: stableId,
        contentComponent: "sales",
        title: `Sales ${id}`,
        renderer: "always",
        params: { saleId: id },
      };
    } else dropped++;
  }
  return sanitizeLayoutGeometry(input, remap, candidates, catalogPanel(), dropped);
}

/** Invalid native structures throw; callers keep the prior saved layout. */
export function encodeLayout(
  layout: SerializedDockview,
  sessions: Record<string, LegacyLayoutSession>,
  scope: LayoutScope,
): string {
  const safeScope = validScope(scope);
  const safe = sanitize(layout, safeScope, sessions);
  return JSON.stringify({
    schemaVersion: 1,
    registryVersion: 1,
    scope: { actorKey: safeScope.actorKey },
    ...safe,
  });
}
export function decodeLayout(raw: string, scope: LayoutScope): LayoutResult {
  try {
    if (typeof raw !== "string" || raw.length > 200000) throw Error("length");
    const envelope = object(JSON.parse(raw)),
      expected = validScope(scope),
      stored = validScope(envelope.scope, true);
    if (
      Object.keys(envelope).some(
        (key) =>
          ![
            "schemaVersion",
            "registryVersion",
            "scope",
            "layout",
            "dropped",
          ].includes(key),
      ) ||
      envelope.schemaVersion !== 1 ||
      envelope.registryVersion !== 1 ||
      stored.actorKey !== expected.actorKey
    )
      throw Error("envelope");
    const priorDropped = envelope.dropped ?? 0;
    if (
      !Number.isSafeInteger(priorDropped) ||
      (priorDropped as number) < 0 ||
      (priorDropped as number) > maxPanels
    )
      throw Error("dropped");
    const safe = sanitize(envelope.layout, expected);
    return {
      kind: "ready",
      layout: safe.layout,
      dropped: (priorDropped as number) + safe.dropped,
    };
  } catch {
    return {
      kind: "invalid",
      message:
        "Bố cục đã lưu không hợp lệ hoặc không thuộc phạm vi hiện tại. Dùng bố cục mặc định.",
    };
  }
}
