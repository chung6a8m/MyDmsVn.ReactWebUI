import type { SerializedDockview } from "dockview";
import { deploymentEpochSchema } from "../../infrastructure/http/operationsContext";
import type { LayoutResult, LayoutScope } from "./layoutPersistence";
import { sanitizeLayoutPresentation, validateLayoutScope, type LiveLayoutPanel } from "./layoutPersistenceV2";

export interface LayoutScopeV3 extends LayoutScope { deploymentEpoch: string }
function validateScope(scope: LayoutScope): asserts scope is LayoutScopeV3 {
  validateLayoutScope(scope);
  deploymentEpochSchema.parse(scope.deploymentEpoch);
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("object");
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw Error("fields");
}

/** v3 changes ownership; the module descriptor registry remains version 2. */
export function encodeLayoutV3(layout: SerializedDockview, live: Record<string, LiveLayoutPanel>, scope: LayoutScope): string {
  validateScope(scope);
  const safe = sanitizeLayoutPresentation(layout, scope, live);
  const raw = JSON.stringify({ schemaVersion: 3, registryVersion: 2,
    scope: { deploymentEpoch: scope.deploymentEpoch, actorKey: scope.actorKey }, ...safe });
  if (raw.length > 200000) throw Error("length");
  return raw;
}

/** Actor-only v1/v2 bytes cannot establish which database owns their IDs. */
export function decodeLayoutV3(raw: string, scope: LayoutScope): LayoutResult {
  try {
    validateScope(scope);
    if (typeof raw !== "string" || raw.length > 200000) throw Error("length");
    const envelope = object(JSON.parse(raw)), stored = object(envelope.scope);
    exactKeys(envelope, ["schemaVersion", "registryVersion", "scope", "layout", "dropped"]);
    exactKeys(stored, ["deploymentEpoch", "actorKey"]);
    if (envelope.schemaVersion !== 3 || envelope.registryVersion !== 2 ||
      stored.deploymentEpoch !== scope.deploymentEpoch || stored.actorKey !== scope.actorKey) throw Error("scope");
    if (!Number.isSafeInteger(envelope.dropped) || (envelope.dropped as number) < 0 || (envelope.dropped as number) > 128) throw Error("dropped");
    const safe = sanitizeLayoutPresentation(envelope.layout, scope);
    return { kind: "ready", layout: safe.layout, dropped: (envelope.dropped as number) + safe.dropped };
  } catch {
    return { kind: "invalid", message: "Bố cục đã lưu không hợp lệ hoặc không thuộc cơ sở dữ liệu và tài khoản hiện tại. Dùng bố cục mặc định." };
  }
}
