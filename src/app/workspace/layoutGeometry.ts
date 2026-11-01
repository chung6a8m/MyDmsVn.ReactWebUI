import { Orientation, type SerializedDockview } from "dockview";
type ObjectValue = Record<string, unknown>;
type GridNode = SerializedDockview["grid"]["root"];
const maxPanels = 128;
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

/** Preserve only bounded, visible in-window geometry and registered panel references. */
export function sanitizeLayoutGeometry(
  value: unknown,
  remap: ReadonlyMap<string, string>,
  candidates: SerializedDockview["panels"],
  fallback: SerializedDockview["panels"][string],
  dropped = 0,
  strictMembership = false,
) {
  const input = object(value), grid = object(input.grid), inputPanels = object(input.panels);
  if (![Orientation.HORIZONTAL, Orientation.VERTICAL].includes(grid.orientation as Orientation)) throw Error("orientation");
  const width = dimension(grid.width), height = dimension(grid.height);
  if (Object.keys(inputPanels).length > maxPanels) throw Error("panel-limit");
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
  for (const [id] of remap) if (!seenPanels.has(id)) {
    if (strictMembership) throw Error("unreferenced-panel");
    dropped++;
  }
  if (!root) {
    panels[fallback.id] = fallback;
    root = {
      type: "branch",
      data: [
        {
          type: "leaf",
          data: {
            id: "group-1",
            views: [fallback.id],
            activeView: fallback.id,
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
      grid: { root, width, height, orientation: grid.orientation as Orientation },
      panels,
      activeGroup,
    } satisfies SerializedDockview,
    dropped,
  };
}
