import { createStore } from "zustand/vanilla";
import type { DockviewApi, SerializedDockview } from "dockview";
import type { SalesSessionStore } from "../../features/sales/salesSessionStore";
import type { CloseResult } from "./workspaceController";
import {
  decodeLayout,
  encodeLayout,
  type LayoutScope,
} from "./layoutPersistence";
export const layoutStorageKey = (scope: LayoutScope) =>
  `mydmsvn.workspace.layout.v1:${encodeURIComponent(scope.actorKey)}`;
export type LayoutStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function createWorkspaceLayouts(deps: {
  store: SalesSessionStore;
  closeAll: () => Promise<CloseResult>;
  scope: () => LayoutScope;
  setScope: (scope: LayoutScope) => void;
  openRestored: (saleId: string, sessionId: string) => Promise<string>;
  storage?: LayoutStorage | null;
}) {
  const state = createStore<{
    busy: boolean;
    message: string;
    scope: LayoutScope;
  }>(() => ({ busy: false, message: "", scope: { ...deps.scope() } }));
  let api: DockviewApi | undefined;
  let title = "Danh sách Sales";
  let attachedOnce = false;
  let memory: SerializedDockview | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let intent: { kind: string; task: Promise<CloseResult> } | undefined;
  let initial: Promise<CloseResult> = Promise.resolve("closed");
  function storage() {
    return deps.storage === undefined
      ? typeof window !== "undefined"
        ? window.localStorage
        : null
      : deps.storage;
  }
  function cancelTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
  function remember() {
    if (api) {
      try {
        memory = api.toJSON();
      } catch {
        /* A disposed host cannot replace the last valid memory layout. */
      }
    }
  }
  function saveNow() {
    cancelTimer();
    if (state.getState().busy) return false;
    remember();
    if (!memory) return false;
    try {
      const target = storage();
      if (!target) return false;
      target.setItem(
        layoutStorageKey(deps.scope()),
        encodeLayout(memory, deps.store.getState().sessions, deps.scope()),
      );
      return true;
    } catch {
      state.setState({
        message:
          "Không thể lưu bố cục trên trình duyệt này. Phiên hiện tại vẫn được giữ.",
      });
      return false;
    }
  }
  function schedule() {
    if (state.getState().busy) return;
    remember();
    cancelTimer();
    timer = setTimeout(saveNow, 250);
  }
  function defaultLayout() {
    if (!api) return;
    api.clear();
    api.addPanel({
      id: "foundation-catalog",
      component: "catalog",
      title,
      renderer: "always",
    });
    memory = api.toJSON();
  }
  function remap(layout: SerializedDockview) {
    const result = structuredClone(layout);
    const ids = new Map<string, string>();
    const records: { saleId: string; sessionId: string }[] = [];
    result.panels = {};
    for (const [id, panel] of Object.entries(layout.panels)) {
      if (panel.contentComponent === "sales") {
        const sessionId = crypto.randomUUID();
        const saleId = panel.params!.saleId as string;
        ids.set(id, sessionId);
        records.push({ saleId, sessionId });
        result.panels[sessionId] = {
          id: sessionId,
          contentComponent: "sales",
          title: `Sales ${saleId}`,
          renderer: "always",
          params: { sessionId },
        };
      } else {
        ids.set(id, id);
        result.panels[id] = { ...panel, title };
      }
    }
    const visit = (node: SerializedDockview["grid"]["root"]) => {
      if (Array.isArray(node.data)) node.data.forEach(visit);
      else {
        node.data.views = node.data.views.map((id) => ids.get(id)!);
        if (node.data.activeView)
          node.data.activeView = ids.get(node.data.activeView);
      }
    };
    visit(result.grid.root);
    return { layout: result, records };
  }
  function run(
    kind: "restore" | "reset" | "actor",
    actorKey?: string,
    startup = false,
  ): Promise<CloseResult> {
    if (intent)
      return intent.kind === kind && kind !== "actor"
        ? intent.task
        : Promise.resolve("blocked");
    if (!api) return Promise.resolve("blocked");
    if (kind === "actor" && (!actorKey || actorKey === deps.scope().actorKey))
      return Promise.resolve("closed");
    cancelTimer();
    state.setState({ busy: true, message: "" });
    const task = (async (): Promise<CloseResult> => {
      try {
        const admitted = await deps.closeAll();
        if (admitted !== "closed") {
          state.setState({
            message:
              "Giữ bố cục hiện tại: việc đóng phiên chưa được chấp thuận.",
          });
          return admitted;
        }
        // Entry points are locked while admission runs; never replace a newly opened session.
        if (Object.keys(deps.store.getState().sessions).length || !api)
          return "blocked";
        if (kind === "actor") {
          const next = {
            actorKey: actorKey!,
            actorGeneration: deps.scope().actorGeneration + 1,
          };
          deps.setScope(next);
          state.setState({ scope: next });
          memory = undefined;
        }
        if (kind === "reset") {
          defaultLayout();
          try {
            storage()?.removeItem(layoutStorageKey(deps.scope()));
          } catch {
            state.setState({
              message:
                "Đã đặt bố cục mặc định; không thể xóa bố cục lưu trên trình duyệt.",
            });
          }
          return "closed";
        }
        let raw: string | null = null;
        try {
          raw = storage()?.getItem(layoutStorageKey(deps.scope())) ?? null;
        } catch {
          defaultLayout();
          state.setState({
            message: "Không đọc được bố cục đã lưu; đang dùng bố cục mặc định.",
          });
          return "closed";
        }
        if (!raw) {
          if (!startup) defaultLayout();
          return "closed";
        }
        const parsed = decodeLayout(raw, deps.scope());
        if (parsed.kind === "invalid") {
          defaultLayout();
          state.setState({
            message: `${parsed.message} Đang dùng bố cục mặc định.`,
          });
          return "closed";
        }
        const restored = remap(parsed.layout);
        // Create empty loading sessions before React renders the restored panels;
        // their independent public reads populate them after the layout is applied.
        const reads = restored.records.map((r) =>
          deps.openRestored(r.saleId, r.sessionId),
        );
        try {
          api.fromJSON(restored.layout);
          remember();
        } catch {
          await deps.closeAll();
          defaultLayout();
          state.setState({
            message: "Không khôi phục được bố cục; đang dùng bố cục mặc định.",
          });
          await Promise.all(reads);
          return "closed";
        }
        state.setState({
          message: parsed.dropped
            ? `Đã khôi phục bố cục; bỏ ${parsed.dropped} tab không thể khôi phục (bao gồm chứng từ mới chưa lưu).`
            : "Đã khôi phục bố cục; chứng từ được đọc lại, không khôi phục bản nháp.",
        });
        await Promise.all(reads);
        return "closed";
      } finally {
        state.setState({ busy: false });
      }
    })();
    intent = { kind, task };
    void task.then(
      () => {
        if (intent?.task === task) intent = undefined;
      },
      () => {
        if (intent?.task === task) intent = undefined;
      },
    );
    return task;
  }
  return {
    state,
    saveNow,
    ready: () => initial,
    reset: () => run("reset"),
    restore: () => run("restore"),
    switchActor: (key: string) => run("actor", key),
    attach(host: DockviewApi, catalogTitle: string) {
      api = host;
      title = catalogTitle;
      if (memory && !state.getState().busy) {
        const transient = structuredClone(memory);
        for (const p of Object.values(transient.panels))
          if (p.contentComponent === "catalog") p.title = title;
        try {
          host.fromJSON(transient);
        } catch {
          state.setState({
            message:
              "Không khôi phục được bố cục trong bộ nhớ; các phiên đang mở được giữ lại.",
          });
        }
      }
      if (!attachedOnce) {
        attachedOnce = true;
        if (!Object.keys(deps.store.getState().sessions).length)
          initial = run("restore", undefined, true);
      }
      const sub = host.onDidLayoutChange(schedule);
      const unload = (event: BeforeUnloadEvent) => {
        if (
          Object.values(deps.store.getState().sessions).some(
            (s) => s.dirty || s.preparing || s.mutation !== "idle",
          )
        ) {
          event.preventDefault();
          event.returnValue = "";
        }
      };
      if (typeof window !== "undefined") {
        window.addEventListener("pagehide", saveNow);
        window.addEventListener("beforeunload", unload);
      }
      return () => {
        sub.dispose();
        cancelTimer();
        if (api === host) {
          if (!state.getState().busy) saveNow();
          api = undefined;
        }
        if (typeof window !== "undefined") {
          window.removeEventListener("pagehide", saveNow);
          window.removeEventListener("beforeunload", unload);
        }
      };
    },
  };
}
