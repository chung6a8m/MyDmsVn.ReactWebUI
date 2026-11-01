import { createStore } from "zustand/vanilla";
import type { DockviewApi, SerializedDockview } from "dockview";
import type { CloseResult } from "./workspaceController";
import { sameActorScope, type DocumentCloseAdapter } from "./documentContracts";
import type { LayoutScope } from "./layoutPersistence";
import { createLayoutPanel, decodeLayoutV2, encodeLayoutV2, migrateLayoutV1, type LayoutPanelDescriptor, type LiveLayoutPanel } from "./layoutPersistenceV2";
export const layoutStorageKey = (scope: LayoutScope) =>
  `mydmsvn.workspace.layout.v2:${encodeURIComponent(scope.actorKey)}`;
export const legacyLayoutStorageKey = (scope: LayoutScope) =>
  `mydmsvn.workspace.layout.v1:${encodeURIComponent(scope.actorKey)}`;
export type LayoutStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function createWorkspaceLayouts(deps: {
  documents: () => readonly DocumentCloseAdapter[];
  panels: () => Record<string, LiveLayoutPanel>;
  hasPanel: (id: string) => boolean;
  isCurrentScope: (scope: LayoutScope) => boolean;
  isAdmissionBusy: () => boolean;
  closeAll: () => Promise<CloseResult>;
  scope: () => LayoutScope;
  setScope: (scope: LayoutScope) => void;
  openRestored: (descriptor: LayoutPanelDescriptor, sessionId: string) => Promise<string>;
  registerSimple: (descriptor: LayoutPanelDescriptor) => string;
  isRegistered: (descriptor: LayoutPanelDescriptor) => boolean;
  storage?: LayoutStorage | null;
}) {
  const state = createStore<{ busy: boolean; message: string; scope: LayoutScope }>(() => ({ busy: false, message: "", scope: { ...deps.scope() } }));
  let api: DockviewApi | undefined;
  let title = "Danh sách Sales";
  let attachedOnce = false;
  let memory: SerializedDockview | undefined;
  let memoryScope: LayoutScope | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let intent: { kind: string; task: Promise<CloseResult> } | undefined;
  let initial: Promise<CloseResult> = Promise.resolve("closed");
  const current = (scope: LayoutScope) => sameActorScope(scope, deps.scope()) &&
    sameActorScope(scope, state.getState().scope) && deps.isCurrentScope(scope);
  function storage() {
    return deps.storage === undefined
      ? typeof window !== "undefined" ? window.localStorage : null
      : deps.storage;
  }
  function cancelTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
  function remember() {
    const scope = { ...state.getState().scope };
    if (api && current(scope)) {
      try { memory = api.toJSON(); memoryScope = scope; }
      catch { /* A disposed host cannot replace the last valid memory layout. */ }
    }
  }
  function persist(scope: LayoutScope) {
    if (!memory || !memoryScope || !sameActorScope(memoryScope, scope) || !current(scope)) return false;
    try {
      const target = storage();
      if (!target) return false;
      target.setItem(layoutStorageKey(scope), encodeLayoutV2(memory, deps.panels(), scope));
      return true;
    } catch {
      state.setState({ message: "Không thể lưu bố cục trên trình duyệt này. Phiên hiện tại vẫn được giữ." });
      return false;
    }
  }
  function saveNow() {
    cancelTimer();
    if (state.getState().busy || deps.isAdmissionBusy() || !current(state.getState().scope)) return false;
    remember();
    return persist(state.getState().scope);
  }
  function schedule() {
    remember();
    if (state.getState().busy || deps.isAdmissionBusy()) return;
    cancelTimer(); timer = setTimeout(saveNow, 250);
  }
  function defaultLayout() {
    if (!api) return;
    const descriptor: LayoutPanelDescriptor = { kind: "records", module: "sales" };
    const panel = createLayoutPanel(descriptor);
    const id = deps.registerSimple(descriptor);
    api.clear();
    api.addPanel({ id, component: panel.contentComponent!, title, params: descriptor, renderer: "always" });
    remember();
  }
  function remap(layout: SerializedDockview) {
    const result = structuredClone(layout), ids = new Map<string, string>();
    const records: { descriptor: LayoutPanelDescriptor; sessionId: string }[] = [];
    result.panels = {};
    for (const [id, panel] of Object.entries(layout.panels)) {
      const descriptor = panel.params as LayoutPanelDescriptor;
      const nextId = descriptor.kind === "document" ? crypto.randomUUID() : deps.registerSimple(descriptor);
      ids.set(id, nextId);
      if (descriptor.kind === "document") records.push({ descriptor, sessionId: nextId });
      result.panels[nextId] = {
        ...panel, id: nextId,
        title: descriptor.kind === "records" && descriptor.module === "sales" ? title : panel.title,
        params: descriptor.kind === "document" ? { kind: "document", module: descriptor.module, sessionId: nextId } : descriptor,
      };
    }
    const visit = (node: SerializedDockview["grid"]["root"]) => {
      if (Array.isArray(node.data)) node.data.forEach(visit);
      else {
        node.data.views = node.data.views.map(id => ids.get(id)!);
        if (node.data.activeView) node.data.activeView = ids.get(node.data.activeView);
      }
    };
    visit(result.grid.root);
    return { layout: result, records };
  }
  function run(kind: "restore" | "reset" | "actor", actorKey?: string): Promise<CloseResult> {
    if (intent) return intent.kind === kind && kind !== "actor" ? intent.task : Promise.resolve("blocked");
    let scope = { ...deps.scope() };
    if (!api || !current(scope) || deps.isAdmissionBusy()) return Promise.resolve("blocked");
    if (kind === "actor" && (!actorKey || actorKey === scope.actorKey)) return Promise.resolve("closed");
    cancelTimer(); state.setState({ busy: true, message: "" });
    const task = (async (): Promise<CloseResult> => {
      try {
        const admitted = await deps.closeAll();
        if (!current(scope)) return "blocked";
        if (admitted !== "closed") {
          state.setState({ message: "Giữ bố cục hiện tại: việc đóng phiên chưa được chấp thuận." });
          return admitted;
        }
        // Includes detached documents from every registered feature store.
        if (deps.documents().length || !api) return "blocked";
        if (kind === "actor") {
          scope = { actorKey: actorKey!, actorGeneration: scope.actorGeneration + 1 };
          deps.setScope(scope); state.setState({ scope }); memory = undefined; memoryScope = undefined;
          if (!current(scope)) return "blocked";
        }
        if (kind === "reset") {
          defaultLayout();
          // A v2 shell prevents a retained legacy layout from resurrecting on reload.
          persist(scope);
          return "closed";
        }
        let raw: string | null = null, migrated = false;
        try {
          const target = storage();
          raw = target?.getItem(layoutStorageKey(scope)) ?? null;
          if (raw === null) {
            raw = target?.getItem(legacyLayoutStorageKey(scope)) ?? null;
            migrated = raw !== null;
          }
        } catch {
          defaultLayout(); state.setState({ message: "Không đọc được bố cục đã lưu; đang dùng bố cục mặc định." });
          return "closed";
        }
        if (raw === null) {
          defaultLayout();
          return "closed";
        }
        const parsed = migrated ? migrateLayoutV1(raw, scope) : decodeLayoutV2(raw, scope);
        if (parsed.kind === "invalid" || Object.values(parsed.layout.panels).some(panel => !deps.isRegistered(panel.params as LayoutPanelDescriptor))) {
          defaultLayout();
          state.setState({ message: parsed.kind === "invalid" ? parsed.message : "Bố cục chứa module chưa khả dụng; đang dùng bố cục mặc định." });
          return "closed";
        }
        const restored = remap(parsed.layout);
        // Every feature creates a current-scope loading session synchronously, before Dockview renders it.
        const reads = restored.records.map(record => {
          try { return deps.openRestored(record.descriptor, record.sessionId); }
          catch (error) { return Promise.reject(error); }
        });
        const completion = Promise.allSettled(reads);
        async function fallbackAfterOpen(): Promise<CloseResult> {
          if (!current(scope)) { await completion; return "blocked"; }
          const cleanup = await deps.closeAll();
          if (!current(scope)) { await completion; return "blocked"; }
          if (cleanup !== "closed" || deps.documents().length || !api) { await completion; return "blocked"; }
          defaultLayout(); state.setState({ message: "Không khôi phục được bố cục; đang dùng bố cục mặc định." });
          await completion;
          return current(scope) ? "closed" : "blocked";
        }
        if (!current(scope) || restored.records.some(record => !deps.hasPanel(record.sessionId))) return fallbackAfterOpen();
        try { api.fromJSON(restored.layout); remember(); }
        catch { return fallbackAfterOpen(); }
        const outcomes = await completion;
        if (!current(scope)) return "blocked";
        state.setState({ message: outcomes.some(outcome => outcome.status === "rejected")
          ? "Đã khôi phục bố cục; một số chứng từ chưa đọc được. Giữ phiên để thử đọc lại."
          : parsed.dropped
            ? `Đã khôi phục bố cục; bỏ ${parsed.dropped} tab không thể khôi phục (bao gồm chứng từ mới chưa lưu).`
            : "Đã khôi phục bố cục; chứng từ được đọc lại, không khôi phục bản nháp." });
        if (migrated) { remember(); persist(scope); }
        return "closed";
      } finally { state.setState({ busy: false }); }
    })();
    intent = { kind, task };
    void task.then(() => { if (intent?.task === task) intent = undefined; }, () => { if (intent?.task === task) intent = undefined; });
    return task;
  }
  return {
    state, saveNow, ready: () => initial,
    reset: () => run("reset"), restore: () => run("restore"), switchActor: (key: string) => run("actor", key),
    attach(host: DockviewApi, catalogTitle: string) {
      api = host; title = catalogTitle;
      if (memory && memoryScope && current(memoryScope)) {
        const transient = structuredClone(memory);
        // Move/remount retains live sessions; an admitted close must not leave ghost tabs.
        for (const [id, panel] of Object.entries(transient.panels)) {
          if (!deps.hasPanel(id)) delete transient.panels[id];
          else if (panel.contentComponent === "catalog") panel.title = title;
        }
        const groups = new Set<string>();
        type Node = SerializedDockview["grid"]["root"];
        const prune = (node: Node): Node | null => {
          if (Array.isArray(node.data)) {
            node.data = node.data.map(prune).filter((n): n is Node => n !== null);
            return node.data.length ? node : null;
          }
          node.data.views = node.data.views.filter(id => !!transient.panels[id]);
          if (!node.data.views.length) return null;
          if (!node.data.activeView || !transient.panels[node.data.activeView]) node.data.activeView = node.data.views[0];
          groups.add(node.data.id); return node;
        };
        transient.grid.root = prune(transient.grid.root) ?? { type: "branch", data: [] };
        if (!transient.activeGroup || !groups.has(transient.activeGroup)) transient.activeGroup = groups.values().next().value;
        try { host.fromJSON(transient); }
        catch { state.setState({ message: "Không khôi phục được bố cục trong bộ nhớ; các phiên đang mở được giữ lại." }); }
      }
      if (!attachedOnce) {
        attachedOnce = true;
        if (!deps.documents().length) initial = run("restore");
      }
      const sub = host.onDidLayoutChange(schedule);
      const unload = (event: BeforeUnloadEvent) => {
        if (deps.documents().some(document => document.isDirtyIncludingRaw() || document.isCloseBlocked())) {
          event.preventDefault(); event.returnValue = "";
        }
      };
      if (typeof window !== "undefined") { window.addEventListener("pagehide", saveNow); window.addEventListener("beforeunload", unload); }
      return () => {
        sub.dispose(); cancelTimer();
        if (api === host) { remember(); if (!state.getState().busy) saveNow(); api = undefined; }
        if (typeof window !== "undefined") { window.removeEventListener("pagehide", saveNow); window.removeEventListener("beforeunload", unload); }
      };
    },
  };
}
