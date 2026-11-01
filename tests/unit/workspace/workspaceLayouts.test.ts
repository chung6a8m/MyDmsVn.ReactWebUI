import { expect, it, vi } from "vitest";
import { Orientation, type DockviewApi, type SerializedDockview } from "dockview";
import { createWorkspaceLayouts, layoutStorageKey, legacyLayoutStorageKey } from "../../../src/app/workspace/workspaceLayouts";
import { encodeLayout } from "../../../src/app/workspace/layoutPersistence";
import { createLayoutPanel, encodeLayoutV2, type LayoutPanelDescriptor, type LiveLayoutPanel } from "../../../src/app/workspace/layoutPersistenceV2";
import { sameActorScope, type ActorScope, type DocumentCloseAdapter } from "../../../src/app/workspace/documentContracts";
const scope = { actorKey: "test", actorGeneration: 1 };
function setup() {
  let actor = { ...scope };
  const owned = new Map<string, DocumentCloseAdapter>();
  const live: Record<string, LiveLayoutPanel> = { "foundation-catalog": { ...actor, descriptor: { kind: "records", module: "sales" } } };
  const entries = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { entries.set(key, value); }),
    removeItem: vi.fn((key: string) => { entries.delete(key); }),
  };
  const closeAll = vi.fn(async (): Promise<"closed" | "cancelled" | "blocked"> => {
    for (const id of owned.keys()) delete live[id];
    owned.clear();
    return "closed";
  });
  const base: SerializedDockview = {
    grid: { root: { type: "branch", data: [{ type: "leaf", data: { id: "g", views: ["foundation-catalog"], activeView: "foundation-catalog" }, size: 800 }], size: 800 }, width: 800, height: 600, orientation: Orientation.HORIZONTAL },
    panels: { "foundation-catalog": createLayoutPanel({ kind: "records", module: "sales" }) },
  };
  let snapshot = structuredClone(base);
  let listener = () => {};
  const api = {
    toJSON: vi.fn(() => snapshot),
    fromJSON: vi.fn((layout: SerializedDockview) => { snapshot = layout; }),
    clear: vi.fn(() => { snapshot = { ...structuredClone(base), panels: {}, grid: { ...base.grid, root: { type: "branch", data: [] } } }; }),
    addPanel: vi.fn((options: { id: string; component: string; title: string; params: Record<string, unknown> }) => {
      snapshot.panels[options.id] = { id: options.id, contentComponent: options.component, title: options.title, params: options.params };
      snapshot.grid.root.data = [{ type: "leaf", data: { id: "g", views: Object.keys(snapshot.panels), activeView: options.id } }];
    }),
    onDidLayoutChange: vi.fn((cb: () => void) => { listener = cb; return { dispose: vi.fn() }; }),
  } as unknown as DockviewApi;
  function addDocument(id: string, module: "sales" | "goods-receipt" = "sales", flags = { dirty: false, blocked: false }) {
    const identity = { ...actor, sessionId: id, module, generation: 1, editRevision: 0 };
    const adapter: DocumentCloseAdapter = {
      captureIdentity: () => identity, title: () => id,
      isCloseBlocked: () => flags.blocked, isDirtyIncludingRaw: () => flags.dirty,
      prepareAndSave: async () => "saved-clean", mayFinalise: () => true,
      finaliseAfterAdmission: () => { owned.delete(id); delete live[id]; return true; },
    };
    owned.set(id, adapter);
    live[id] = { ...actor, descriptor: { kind: "document", module, serverId: "1001" } };
    return adapter;
  }
  const openRestored = vi.fn(async (descriptor: LayoutPanelDescriptor, id: string) => {
    if (descriptor.kind === "document") addDocument(id, descriptor.module);
    return id;
  });
  const isRegistered = vi.fn(() => true);
  const admissionBusy = vi.fn(() => false);
  const layout = createWorkspaceLayouts({
    documents: () => [...owned.values()], panels: () => live,
    hasPanel: (id: string) => !!live[id] && sameActorScope(live[id], actor),
    isCurrentScope: (value: ActorScope) => sameActorScope(value, actor),
    isAdmissionBusy: admissionBusy,
    closeAll, scope: () => actor, setScope: value => { actor = value; }, openRestored,
    registerSimple: (descriptor: LayoutPanelDescriptor) => {
      const id = createLayoutPanel(descriptor).id;
      live[id] = { ...actor, descriptor };
      return id;
    }, isRegistered, storage,
  });
  return { layout, owned, live, storage, entries, closeAll, api, openRestored, isRegistered, admissionBusy,
    addDocument, change: () => listener(), base, forceActor: (value: ActorScope) => { actor = value; } };
}
function savedDocument(w: ReturnType<typeof setup>, module: "sales" | "goods-receipt" = "sales") {
  const data = structuredClone(w.base);
  data.panels.saved = { id: "saved", contentComponent: module, params: { sessionId: "saved" } };
  data.grid.root.data = [{ type: "leaf", data: { id: "g", views: ["foundation-catalog", "saved"], activeView: "saved" } }];
  return encodeLayoutV2(data, { ...w.live, saved: { ...scope, descriptor: { kind: "document", module, serverId: "1001" } } }, scope);
}
it("startup recreates the default shell after admission closes simple panels and no saved layout exists", async () => {
  const w = setup();
  w.closeAll.mockImplementation(async () => {
    delete w.live["foundation-catalog"];
    w.api.clear();
    return "closed";
  });
  w.layout.attach(w.api, "Sales");
  expect(await w.layout.ready()).toBe("closed");
  expect(w.api.toJSON().panels["foundation-catalog"]).toBeDefined();
  expect(w.live["foundation-catalog"]).toBeDefined();
});
it.each(["cancelled", "blocked"] as const)("%s admission never changes layout storage or actor", async result => {
  const w = setup(); w.layout.attach(w.api, "Sales"); await w.layout.ready();
  w.closeAll.mockResolvedValue(result); vi.clearAllMocks();
  expect(await w.layout.reset()).toBe(result);
  expect(w.api.clear).not.toHaveBeenCalled(); expect(w.storage.setItem).not.toHaveBeenCalled(); expect(w.storage.removeItem).not.toHaveBeenCalled();
  expect(await w.layout.switchActor("other")).toBe(result);
  expect(w.layout.state.getState().scope).toEqual(scope);
});
it("serializes layout operations and freezes entry while admission awaits", async () => {
  const w = setup(); w.layout.attach(w.api, "Sales"); await w.layout.ready();
  vi.clearAllMocks();
  let resolve!: (r: "closed") => void;
  w.closeAll.mockImplementation(() => new Promise(r => { resolve = r; }));
  const reset = w.layout.reset();
  expect(w.layout.state.getState().busy).toBe(true); expect(w.layout.reset()).toBe(reset);
  expect(await w.layout.restore()).toBe("blocked"); expect(w.api.clear).not.toHaveBeenCalled();
  resolve("closed"); expect(await reset).toBe("closed"); expect(w.layout.state.getState().busy).toBe(false);
});
it("storage failures preserve a usable workspace and report the limitation", async () => {
  const w = setup(); w.storage.getItem.mockImplementation(() => { throw Error("denied"); });
  w.layout.attach(w.api, "Sales"); await w.layout.ready();
  expect(w.layout.state.getState().message).toContain("bố cục");
  w.storage.setItem.mockImplementation(() => { throw Error("quota"); });
  expect(w.layout.saveNow()).toBe(false); expect(w.layout.state.getState().message).toContain("lưu");
});
it("invalid v2 and fromJSON errors fall back without leaving busy state", async () => {
  const w = setup(); w.entries.set(layoutStorageKey(scope), "broken");
  w.layout.attach(w.api, "Sales"); await w.layout.ready();
  expect(w.layout.state.getState().busy).toBe(false); expect(w.api.addPanel).toHaveBeenCalled();
  w.entries.set(layoutStorageKey(scope), savedDocument(w));
  vi.mocked(w.api.fromJSON).mockImplementation(() => { throw Error("bad-layout"); });
  expect(await w.layout.restore()).toBe("closed"); expect(w.layout.state.getState().busy).toBe(false);
  expect(w.layout.state.getState().message).toContain("mặc định"); expect(w.owned.size).toBe(0);
});
it("migrates absent v2 from v1 and keeps the original v1 key after restore and reset", async () => {
  const w = setup(), raw = encodeLayout(w.base, {}, scope);
  w.entries.set(legacyLayoutStorageKey(scope), raw);
  w.layout.attach(w.api, "Sales"); await w.layout.ready();
  expect(w.entries.get(legacyLayoutStorageKey(scope))).toBe(raw);
  expect(JSON.parse(w.entries.get(layoutStorageKey(scope))!).schemaVersion).toBe(2);
  expect(await w.layout.reset()).toBe("closed");
  expect(w.entries.get(legacyLayoutStorageKey(scope))).toBe(raw);
  expect(w.storage.removeItem).not.toHaveBeenCalled();
  expect(JSON.parse(w.entries.get(layoutStorageKey(scope))!).layout.panels).toHaveProperty("foundation-catalog");
});
it.each(["broken", ""])("present invalid v2 %j never resurrects stale v1", async raw => {
  const w = setup(); w.entries.set(layoutStorageKey(scope), raw); w.entries.set(legacyLayoutStorageKey(scope), encodeLayout(w.base, {}, scope));
  w.layout.attach(w.api, "Sales"); await w.layout.ready();
  expect(w.storage.getItem).not.toHaveBeenCalledWith(legacyLayoutStorageKey(scope));
  expect(w.api.fromJSON).not.toHaveBeenCalled(); expect(w.api.addPanel).toHaveBeenCalled();
});
it("restores receipt references with fresh session identity and module-specific reads", async () => {
  const w = setup(); w.entries.set(layoutStorageKey(scope), savedDocument(w, "goods-receipt"));
  w.layout.attach(w.api, "Sales"); await w.layout.ready();
  const [ref, id] = w.openRestored.mock.calls[0];
  expect(ref).toEqual({ kind: "document", module: "goods-receipt", serverId: "1001" });
  expect(id).not.toBe("goods-receipt-1001");
  const restored = vi.mocked(w.api.fromJSON).mock.calls[0][0];
  expect(restored.panels[id].params).toEqual({ kind: "document", module: "goods-receipt", sessionId: id });
});
it("rejects unavailable registered components before starting any restored document reads", async () => {
  const w = setup(); w.entries.set(layoutStorageKey(scope), savedDocument(w, "goods-receipt")); w.isRegistered.mockReturnValue(false);
  w.layout.attach(w.api, "Sales"); await w.layout.ready();
  expect(w.openRestored).not.toHaveBeenCalled(); expect(w.api.fromJSON).not.toHaveBeenCalled(); expect(w.api.addPanel).toHaveBeenCalled();
});
it("does not render orphan document panels when an opener refuses the current capability", async () => {
  const w = setup(); w.entries.set(layoutStorageKey(scope), savedDocument(w));
  w.openRestored.mockResolvedValue("");
  w.layout.attach(w.api, "Sales"); await w.layout.ready();
  expect(w.api.fromJSON).not.toHaveBeenCalled(); expect(w.api.addPanel).toHaveBeenCalled();
  expect(w.layout.state.getState().message).toContain("mặc định"); expect(w.owned.size).toBe(0);
});
it("rechecks all module membership after admission and does not clear a detached receipt", async () => {
  const w = setup(); w.layout.attach(w.api, "Sales"); await w.layout.ready(); w.addDocument("receipt", "goods-receipt");
  w.closeAll.mockResolvedValue("closed"); vi.clearAllMocks();
  expect(await w.layout.reset()).toBe("blocked"); expect(w.api.clear).not.toHaveBeenCalled(); expect(w.owned.has("receipt")).toBe(true);
});
it("does not replace layout or write storage after actor changes during close admission", async () => {
  const w = setup(); w.layout.attach(w.api, "Sales"); await w.layout.ready();
  let release!: (value: "closed") => void;
  w.closeAll.mockImplementation(() => new Promise(resolve => { release = resolve; })); vi.clearAllMocks();
  const reset = w.layout.reset(); w.forceActor({ actorKey: "other", actorGeneration: 2 }); release("closed");
  expect(await reset).toBe("blocked"); expect(w.api.clear).not.toHaveBeenCalled(); expect(w.storage.setItem).not.toHaveBeenCalled();
});
it("does not report success or persist a stale actor after restored reads settle late", async () => {
  const w = setup(); w.entries.set(layoutStorageKey(scope), savedDocument(w));
  let release!: (value: string) => void;
  w.openRestored.mockImplementation((_ref, id) => { w.addDocument(id); return new Promise(resolve => { release = resolve; }); });
  w.layout.attach(w.api, "Sales"); await vi.waitFor(() => expect(w.openRestored).toHaveBeenCalled());
  w.forceActor({ ...scope, actorGeneration: 2 }); release("late");
  expect(await w.layout.ready()).toBe("blocked"); expect(w.layout.saveNow()).toBe(false); expect(w.storage.setItem).not.toHaveBeenCalled();
});
it("never writes layout while global document admission is active", async () => {
  const w = setup(); w.layout.attach(w.api, "Sales"); await w.layout.ready(); w.admissionBusy.mockReturnValue(true);
  expect(w.layout.saveNow()).toBe(false); expect(w.storage.setItem).not.toHaveBeenCalled();
});
it("reattaches pending admission geometry and prunes already admitted sessions from either feature", async () => {
  const w = setup(); const detach = w.layout.attach(w.api, "Sales"); await w.layout.ready();
  vi.clearAllMocks();
  const split = structuredClone(w.base);
  for (const [id, module] of [["a", "sales"], ["b", "goods-receipt"]] as const) {
    split.panels[id] = { id, contentComponent: module, params: { sessionId: id } }; w.addDocument(id, module);
  }
  split.grid.root.data = [
    { type: "leaf", size: 350, data: { id: "left", views: ["a", "b"], activeView: "b" } },
    { type: "leaf", size: 450, data: { id: "right", views: ["foundation-catalog"], activeView: "foundation-catalog" } },
  ]; split.activeGroup = "left"; vi.mocked(w.api.toJSON).mockReturnValue(split);
  let finish!: (value: "blocked") => void;
  w.closeAll.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const reset = w.layout.reset(); detach(); w.owned.delete("a"); delete w.live.a; vi.mocked(w.api.fromJSON).mockClear();
  const cleanup = w.layout.attach(w.api, "Components"); const restored = vi.mocked(w.api.fromJSON).mock.calls[0][0];
  expect(restored.panels.a).toBeUndefined(); expect(restored.panels.b).toBeDefined();
  expect(restored.grid.root.data).toEqual([
    { type: "leaf", size: 350, data: { id: "left", views: ["b"], activeView: "b" } },
    { type: "leaf", size: 450, data: { id: "right", views: ["foundation-catalog"], activeView: "foundation-catalog" } },
  ]);
  finish("blocked"); expect(await reset).toBe("blocked"); expect(w.api.clear).not.toHaveBeenCalled(); cleanup();
});
