import { Orientation, type SerializedDockview } from "dockview";
import type { SalesSession } from "../../features/sales/salesSessionStore";

export interface LayoutScope {
  actorKey: string;
  actorGeneration: number;
}
type LayoutResult =
  | { kind: "ready"; layout: SerializedDockview; dropped: number }
  | { kind: "invalid"; message: string };
type ObjectValue = Record<string, unknown>;
type GridNode = SerializedDockview["grid"]["root"];
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
function dimension(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100000
  )
    throw Error("dimension");
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
  sessions?: Record<string, SalesSession>,
) {
  const input = object(value),
    grid = object(input.grid),
    inputPanels = object(input.panels);
  if (
    ![Orientation.HORIZONTAL, Orientation.VERTICAL].includes(
      grid.orientation as Orientation,
    )
  )
    throw Error("orientation");
  const width = dimension(grid.width),
    height = dimension(grid.height);
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
  const seenGroups = new Set<string>(),
    seenPanels = new Set<string>();
  const groups = new Map<string, string>();
  const panels: SerializedDockview["panels"] = {};
  let nodes = 0;
  function visit(raw: unknown, depth: number): GridNode | null {
    if (depth > 12 || ++nodes > 256) throw Error("grid-limit");
    const node = object(raw);
    const geometry: { size?: number; visible?: boolean } = {};
    if (node.size !== undefined) geometry.size = dimension(node.size);
    if (node.visible !== undefined) {
      // Hidden groups are outside this workspace's UI contract: no show-group command exists.
      if (node.visible !== true) throw Error("visibility");
      geometry.visible = node.visible;
    }
    if (node.type === "branch") {
      if (!Array.isArray(node.data) || node.data.length > maxPanels)
        throw Error("branch");
      const data = node.data
        .map((child) => visit(child, depth + 1))
        .filter((child): child is GridNode => child !== null);
      // Keep single-child branches: collapsing one would change alternating split orientation.
      return data.length ? { type: "branch", data, ...geometry } : null;
    }
    if (node.type !== "leaf") throw Error("node");
    const group = object(node.data),
      id = identifier(group.id);
    if (seenGroups.has(id)) throw Error("duplicate-group");
    seenGroups.add(id);
    if (!Array.isArray(group.views) || group.views.length > maxPanels)
      throw Error("views");
    if (
      group.activeView !== undefined &&
      !group.views.includes(group.activeView)
    )
      throw Error("active-view");
    const views: string[] = [];
    for (const reference of group.views) {
      const panelId = identifier(reference);
      if (seenPanels.has(panelId) || !Object.hasOwn(inputPanels, panelId))
        throw Error("panel-reference");
      seenPanels.add(panelId);
      const mapped = remap.get(panelId);
      if (mapped) {
        views.push(mapped);
        panels[mapped] = candidates[mapped];
      }
    }
    if (!views.length) return null;
    const groupId = `group-${groups.size + 1}`;
    groups.set(id, groupId);
    return {
      type: "leaf",
      ...geometry,
      data: {
        id: groupId,
        views,
        activeView: remap.get(group.activeView as string) ?? views[0],
      },
    };
  }
  const sourceRoot = object(grid.root);
  if (sourceRoot.type !== "branch") throw Error("root");
  let root = visit(sourceRoot, 0);
  // Non-grid (floating/popout/edge) panels are intentionally excluded.
  for (const [id] of remap) if (!seenPanels.has(id)) dropped++;
  if (!root) {
    panels["foundation-catalog"] = catalogPanel();
    root = {
      type: "branch",
      data: [
        {
          type: "leaf",
          data: {
            id: "group-1",
            views: ["foundation-catalog"],
            activeView: "foundation-catalog",
          },
        },
      ],
    };
  }
  const activeGroup =
    groups.get(input.activeGroup as string) ??
    (groups.values().next().value as string | undefined) ??
    "group-1";
  return {
    layout: {
      grid: {
        root,
        width,
        height,
        orientation: grid.orientation as Orientation,
      },
      panels,
      activeGroup,
    } satisfies SerializedDockview,
    dropped,
  };
}

/** Invalid native structures throw; callers keep the prior saved layout. */
export function encodeLayout(
  layout: SerializedDockview,
  sessions: Record<string, SalesSession>,
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
