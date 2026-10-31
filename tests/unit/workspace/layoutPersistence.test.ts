import { describe, expect, test } from "vitest";
import { Orientation, type SerializedDockview } from "dockview";
import type { SalesSession } from "../../../src/features/sales/salesSessionStore";
import {
  encodeLayout,
  decodeLayout,
} from "../../../src/app/workspace/layoutPersistence";
const scope = { actorKey: "demo", actorGeneration: 1 };
function layout(): SerializedDockview {
  return {
    grid: {
      width: 1200,
      height: 700,
      orientation: Orientation.HORIZONTAL,
      root: {
        type: "branch",
        data: [
          {
            type: "leaf",
            size: 600,
            data: {
              id: "native-group",
              views: ["foundation-catalog", "session-a", "session-new"],
              activeView: "session-a",
            },
          },
        ],
      },
    },
    panels: {
      "foundation-catalog": {
        id: "foundation-catalog",
        contentComponent: "catalog",
        title: "Secret title",
      },
      "session-a": {
        id: "session-a",
        contentComponent: "sales",
        title: "secret",
        params: { sessionId: "session-a", draft: { note: "secret raw" } },
      },
      "session-new": { id: "session-new", contentComponent: "sales" },
    },
    activeGroup: "native-group",
  };
}
const sessions = {
  "session-a": {
    sessionId: "session-a",
    saleId: "9007199254740993",
    actorKey: "demo",
    actorGeneration: 1,
    dirty: true,
    rawBuffers: { note: { raw: "secret raw", composing: false } },
    draft: { note: "secret draft" },
  },
  "session-new": {
    sessionId: "session-new",
    saleId: null,
    actorKey: "demo",
    actorGeneration: 1,
  },
} as unknown as Record<string, SalesSession>;
function envelope() {
  return JSON.parse(encodeLayout(layout(), sessions, scope));
}
describe("layout reference boundary", () => {
  test("persists only registry record references and safe geometry, never dirty contents or native params", () => {
    const raw = encodeLayout(layout(), sessions, scope);
    expect(raw).not.toMatch(/secret|session-a|session-new|rawBuffers|draft/);
    const result = decodeLayout(raw, scope);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.dropped).toBe(1);
    expect(result.layout.panels["sales-9007199254740993"]).toEqual({
      id: "sales-9007199254740993",
      contentComponent: "sales",
      title: "Sales 9007199254740993",
      renderer: "always",
      params: { saleId: "9007199254740993" },
    });
    expect(result.layout.grid.width).toBe(1200);
  });
  test.each(["{", "null", "[]"])("rejects malformed JSON/root %s", (raw) =>
    expect(decodeLayout(raw, scope).kind).toBe("invalid"),
  );
  test.each(["schemaVersion", "registryVersion"])(
    "rejects unsupported %s",
    (key) => {
      const data = envelope();
      data[key] = 2;
      expect(decodeLayout(JSON.stringify(data), scope).kind).toBe("invalid");
    },
  );
  test("rejects foreign actor but restores same actor across runtime generations", () => {
    const raw = encodeLayout(layout(), sessions, scope);
    expect(decodeLayout(raw, { ...scope, actorKey: "other" }).kind).toBe(
      "invalid",
    );
    expect(decodeLayout(raw, { ...scope, actorGeneration: 2 }).kind).toBe(
      "ready",
    );
    expect(JSON.parse(raw).scope).toEqual({ actorKey: scope.actorKey });
    const legacy = JSON.parse(raw);
    legacy.scope.actorGeneration = 99;
    expect(decodeLayout(JSON.stringify(legacy), scope).kind).toBe("ready");
  });
  test("strips injected draft params and arbitrary panel renderer/title fields on decode", () => {
    const data = envelope();
    Object.assign(data.layout.panels["sales-9007199254740993"], {
      tabComponent: "evil",
      title: "secret",
      params: { saleId: "9007199254740993", draft: "secret", sessionId: "old" },
    });
    const result = decodeLayout(JSON.stringify(data), scope);
    expect(result.kind).toBe("ready");
    expect(JSON.stringify(result)).not.toMatch(/secret|evil|sessionId/);
  });
  test("drops unknown components and prunes their groups", () => {
    const data = envelope();
    data.layout.panels.evil = { id: "evil", contentComponent: "execute" };
    data.layout.grid.root.data.push({
      type: "leaf",
      size: 200,
      data: { id: "evil-group", views: ["evil"] },
    });
    const result = decodeLayout(JSON.stringify(data), scope);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.dropped).toBe(2);
    expect(result.layout.grid.root.data).toHaveLength(1);
  });
  test.each([
    "duplicate-panel",
    "duplicate-group",
    "missing-reference",
    "numeric-id",
    "leaf-root",
    "negative-size",
    "hidden-group",
    "bad-orientation",
  ])("rejects malformed graph %s", (mode) => {
    const d = envelope();
    const group = d.layout.grid.root.data[0];
    if (mode === "duplicate-panel") group.data.views.push(group.data.views[0]);
    if (mode === "duplicate-group")
      d.layout.grid.root.data.push(structuredClone(group));
    if (mode === "missing-reference") group.data.views.push("missing");
    if (mode === "numeric-id")
      d.layout.panels["sales-9007199254740993"].params.saleId = 1001;
    if (mode === "leaf-root") d.layout.grid.root = group;
    if (mode === "negative-size") group.size = -1;
    if (mode === "hidden-group") group.visible = false;
    if (mode === "bad-orientation") d.layout.grid.orientation = "DIAGONAL";
    expect(decodeLayout(JSON.stringify(d), scope).kind).toBe("invalid");
  });
  test("omits floating popout and edge state", () => {
    const d = layout();
    Object.assign(d, {
      floatingGroups: [{ secret: "floating" }],
      popoutGroups: [{ secret: "popout" }],
      edgeGroups: { secret: "edge" },
    });
    const raw = encodeLayout(d, sessions, scope);
    expect(raw).not.toMatch(/floating|popout|edge|secret/);
  });
  test("all unsaved tabs become safe catalog fallback without resurrecting a draft", () => {
    const d = layout();
    d.panels = { "session-new": d.panels["session-new"] };
    d.grid.root.data = [
      { type: "leaf", data: { id: "new-group", views: ["session-new"] } },
    ];
    const result = decodeLayout(encodeLayout(d, sessions, scope), scope);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(Object.keys(result.layout.panels)).toEqual(["foundation-catalog"]);
    expect(result.dropped).toBe(1);
  });
});

test.each([
  "large-width",
  "string-height",
  "depth",
  "many-panels",
  "duplicate-record",
  "bad-active-view",
])("rejects bounded graph violation %s", (mode) => {
  const data = envelope();
  if (mode === "large-width") data.layout.grid.width = 100001;
  if (mode === "string-height") data.layout.grid.height = "700";
  if (mode === "depth") {
    let node = data.layout.grid.root;
    for (let i = 0; i < 14; i++) {
      const branch = { type: "branch", data: node.data };
      node.data = [branch];
      node = branch;
    }
  }
  if (mode === "many-panels")
    for (let i = 0; i < 129; i++)
      data.layout.panels[`extra-${i}`] = {
        id: `extra-${i}`,
        contentComponent: "unknown",
      };
  if (mode === "duplicate-record") {
    data.layout.panels.extra = {
      id: "extra",
      contentComponent: "sales",
      params: { saleId: "9007199254740993" },
    };
    data.layout.grid.root.data[0].data.views.push("extra");
  }
  if (mode === "bad-active-view")
    data.layout.grid.root.data[0].data.activeView = "missing";
  expect(decodeLayout(JSON.stringify(data), scope).kind).toBe("invalid");
});
test("encoding never trusts a forged native saleId over the live session registry", () => {
  const d = layout();
  d.panels["session-a"].params = {
    saleId: "1004",
    sessionId: "session-new",
    password: "secret",
  };
  const result = decodeLayout(encodeLayout(d, sessions, scope), scope);
  expect(result.kind).toBe("ready");
  if (result.kind !== "ready") return;
  expect(result.layout.panels["sales-9007199254740993"].params).toEqual({
    saleId: "9007199254740993",
  });
  expect(result.layout.panels["sales-1004"]).toBeUndefined();
});
