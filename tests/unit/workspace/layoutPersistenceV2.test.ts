import { describe, expect, test } from "vitest";
import { Orientation, type SerializedDockview } from "dockview";
import { decodeLayout, encodeLayout } from "../../../src/app/workspace/layoutPersistence";
import {
  decodeLayoutV2,
  encodeLayoutV2,
  migrateLayoutV1,
  type LayoutPanelDescriptor,
  type LiveLayoutPanel,
} from "../../../src/app/workspace/layoutPersistenceV2";

const scope = { actorKey: "owner", actorGeneration: 2 };
const descriptors: LayoutPanelDescriptor[] = [
  { kind: "records", module: "sales" },
  { kind: "document", module: "sales", serverId: "9007199254740993" },
  { kind: "records", module: "goods-receipt" },
  { kind: "document", module: "goods-receipt", serverId: "9007199254740993" },
  { kind: "read-only", module: "inventory-balances" },
  { kind: "read-only", module: "inventory-stock-card" },
];
const components = ["catalog", "sales", "goods-receipt-records", "goods-receipt", "inventory-balances", "inventory-stock-card"];
function fixture() {
  const live: Record<string, LiveLayoutPanel> = {};
  const panels: SerializedDockview["panels"] = {};
  descriptors.forEach((descriptor, index) => {
    const id = `session-${index}`;
    live[id] = { ...scope, descriptor };
    panels[id] = { id, contentComponent: components[index], title: "secret draft title", params: { token: "secret", sessionId: id, draft: "secret" } };
  });
  return {
    live,
    layout: {
      grid: { width: 1200, height: 700, orientation: Orientation.HORIZONTAL, root: { type: "branch", data: [{ type: "leaf", size: 800, data: { id: "native-group", views: Object.keys(panels), activeView: "session-3" } }] } },
      panels,
      activeGroup: "native-group",
    } satisfies SerializedDockview,
  };
}
function envelope() {
  const { layout, live } = fixture();
  return JSON.parse(encodeLayoutV2(layout, live, scope));
}
function legacy(serverId = "9007199254740993") {
  const layout = fixture().layout;
  layout.panels = { "session-0": layout.panels["session-0"], "session-1": layout.panels["session-1"] };
  layout.grid.root.data = [{ type: "leaf", size: 800, data: { id: "native-group", views: Object.keys(layout.panels), activeView: "session-1" } }];
  return encodeLayout(layout, { "session-1": { sessionId: "session-1", saleId: serverId, ...scope } } as Parameters<typeof encodeLayout>[1], scope);
}

describe("v2 layout references", () => {
  test("production Receipt components persist as canonical v2 aliases", () => {
    const { layout, live } = fixture();
    layout.panels["session-2"].contentComponent = "goods-receipt-list";
    layout.panels["session-3"].contentComponent = "goods-receipt-document";
    const parsed = decodeLayoutV2(encodeLayoutV2(layout, live, scope), scope);
    expect(parsed.kind).toBe("ready");
    if (parsed.kind === "ready") expect(Object.values(parsed.layout.panels).map(p => p.contentComponent)).toEqual(components);
  });
  test("round trips module-separated documents, records and read-only singleton descriptors without transient/private state", () => {
    const { layout, live } = fixture();
    const raw = encodeLayoutV2(layout, live, scope);
    expect(raw).not.toMatch(/secret|session-|actorGeneration|draft|token/);
    const parsed = decodeLayoutV2(raw, { ...scope, actorGeneration: 99 });
    expect(parsed.kind).toBe("ready");
    if (parsed.kind !== "ready") return;
    expect(Object.values(parsed.layout.panels).map(p => p.params)).toEqual(descriptors);
    expect(new Set(Object.keys(parsed.layout.panels)).size).toBe(6);
    expect(parsed.layout.grid.width).toBe(1200);
    expect((parsed.layout.grid.root.data as SerializedDockview["grid"]["root"][])[0].size).toBe(800);
    expect(JSON.parse(raw).scope).toEqual({ actorKey: "owner" });
    expect(JSON.parse(raw).schemaVersion).toBe(2);
  });
  test("live application descriptors override forged native params and omit unsaved or foreign-generation panels", () => {
    const { layout, live } = fixture();
    live["session-1"].descriptor = null;
    live["session-3"].actorGeneration = 1;
    const result = decodeLayoutV2(encodeLayoutV2(layout, live, scope), scope);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.dropped).toBe(2);
    expect(Object.values(result.layout.panels).map(p => p.params?.kind)).not.toContain("document");
  });
  test("drops every unsaved panel into the safe Sales records shell", () => {
    const { layout, live } = fixture();
    for (const panel of Object.values(live)) panel.descriptor = null;
    const result = decodeLayoutV2(encodeLayoutV2(layout, live, scope), scope);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(Object.values(result.layout.panels).map(p => p.params)).toEqual([{ kind: "records", module: "sales" }]);
  });
  test.each(["module", "kind", "component", "extra-descriptor", "generation", "foreign-actor", "numeric-id", "zero", "leading-zero", "overflow", "huge-id", "duplicate-record", "duplicate-reference", "unreferenced-panel", "dimensions", "hidden", "depth", "node-count", "panel-count", "too-long", "unsupported-version"])("rejects the whole v2 envelope for %s", mode => {
    const data = envelope();
    const document = Object.values(data.layout.panels).find((p: any) => p.params.kind === "document") as any;
    const group = data.layout.grid.root.data[0];
    if (mode === "module") document.params.module = "unknown";
    if (mode === "kind") document.params.kind = "read-only";
    if (mode === "component") document.contentComponent = "execute";
    if (mode === "extra-descriptor") document.params.actorKey = "other";
    if (mode === "generation") data.scope.actorGeneration = 3;
    if (mode === "foreign-actor") data.scope.actorKey = "other";
    if (mode === "numeric-id") document.params.serverId = 1;
    if (mode === "zero") document.params.serverId = "0";
    if (mode === "leading-zero") document.params.serverId = "01";
    if (mode === "overflow") document.params.serverId = "9223372036854775808";
    if (mode === "huge-id") document.params.serverId = "9".repeat(64);
    if (mode === "duplicate-record") {
      data.layout.panels.duplicate = { ...document, id: "duplicate" };
      group.data.views.push("duplicate");
    }
    if (mode === "duplicate-reference") group.data.views.push(group.data.views[0]);
    if (mode === "unreferenced-panel") group.data.views = group.data.views.slice(1);
    if (mode === "dimensions") data.layout.grid.width = 100001;
    if (mode === "hidden") group.visible = false;
    if (mode === "depth") for (let i = 0; i < 14; i++) data.layout.grid.root = { type: "branch", data: [data.layout.grid.root] };
    if (mode === "node-count") data.layout.grid.root.data = Array.from({ length: 128 }, () => ({ type: "branch", data: [{ type: "branch", data: [] }] }));
    if (mode === "panel-count") for (let i = 0; i < 129; i++) data.layout.panels[`extra-${i}`] = { ...document, id: `extra-${i}` };
    if (mode === "unsupported-version") data.schemaVersion = 3;
    const raw = mode === "too-long" ? " ".repeat(200001) : JSON.stringify(data);
    expect(decodeLayoutV2(raw, scope).kind).toBe("invalid");
  });
  test("supports the positive int64 maximum without coercion", () => {
    const { layout, live } = fixture();
    live["session-1"].descriptor = { kind: "document", module: "sales", serverId: "9223372036854775807" };
    const result = decodeLayoutV2(encodeLayoutV2(layout, live, scope), scope);
    expect(result.kind).toBe("ready");
    expect(JSON.stringify(result)).toContain("9223372036854775807");
  });
  test("strips title, renderer, arbitrary native params and non-grid metadata while encoding", () => {
    const { layout, live } = fixture();
    Object.assign(layout, { floatingGroups: [{ token: "secret" }], popoutGroups: [{ draft: "secret" }] });
    expect(encodeLayoutV2(layout, live, scope)).not.toMatch(/secret|floatingGroups|popoutGroups/);
  });
  test("rejects unregistered native panels without trusting their apparently valid params", () => {
    const { layout, live } = fixture();
    delete live["session-1"];
    layout.panels["session-1"].params = descriptors[1];
    expect(() => encodeLayoutV2(layout, live, scope)).toThrow();
  });
  test("rejects unknown components even on an owned unsaved panel", () => {
    const { layout, live } = fixture();
    live["session-1"].descriptor = null;
    layout.panels["session-1"].contentComponent = "execute";
    expect(() => encodeLayoutV2(layout, live, scope)).toThrow();
  });
  test("rejects inherited live registry entries", () => {
    const { layout, live } = fixture();
    delete live["session-1"];
    const inherited = Object.create({ "session-1": { ...scope, descriptor: descriptors[1] } });
    Object.assign(inherited, live);
    expect(() => encodeLayoutV2(layout, inherited, scope)).toThrow();
  });
});

describe("v1 migration", () => {
  test("accepts an explicitly absent epoch in an injected legacy runtime scope", () => {
    expect(migrateLayoutV1(legacy(), { ...scope, deploymentEpoch: undefined }).kind).toBe("ready");
    expect(migrateLayoutV1(legacy(), { ...scope, deploymentEpoch: "11111111-2222-4333-8444-555555555555" }).kind).toBe("invalid");
  });
  test("preserves v1 sanitizer unknown-component pruning, ordering and geometry before strict migration", () => {
    const data = JSON.parse(legacy());
    data.layout.panels.evil = { id: "evil", contentComponent: "execute" };
    data.layout.grid.root.data.push({ type: "leaf", data: { id: "evil-group", views: ["evil"] } });
    const raw = JSON.stringify(data);
    expect(decodeLayout(raw, scope).kind).toBe("ready");
    const result = migrateLayoutV1(raw, scope);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.dropped).toBe(1);
    expect(result.layout.grid.root.data).toHaveLength(1);
    expect((result.layout.grid.root.data as SerializedDockview["grid"]["root"][])[0].size).toBe(800);
    expect(Object.values(result.layout.panels).map(p => p.params)).toEqual(descriptors.slice(0, 2));
  });
  test.each(["9223372036854775808", "9".repeat(64)])("rejects legacy ID outside strict int64 %s", serverId => {
    const raw = legacy(serverId);
    expect(decodeLayout(raw, scope).kind).toBe("ready");
    expect(migrateLayoutV1(raw, scope).kind).toBe("invalid");
  });
  test("does not accept a foreign actor legacy layout", () => {
    expect(migrateLayoutV1(legacy(), { ...scope, actorKey: "other" }).kind).toBe("invalid");
  });
});
