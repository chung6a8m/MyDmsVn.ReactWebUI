import { expect, it } from "vitest";
import { createWorkspaceRuntime } from "../../../src/app/workspace/panelRegistry";
import { createWorkspaceDocument } from "../../../src/infrastructure/fake/workspaceFixtures";
it("missing restored record can retry in same panel without fabricating a document", async () => {
  let exists = false;
  const w = createWorkspaceRuntime(async (id) =>
    exists
      ? { kind: "success", value: createWorkspaceDocument(id) }
      : {
          kind: "failed",
          error: {
            kind: "not-found",
            code: "gone",
            message: "Không còn chứng từ",
          },
        },
  );
  const id = await w.openSalesDocument("999");
  expect(w.store.getState().sessions[id].baseline).toBeNull();
  expect(w.store.getState().sessions[id].status).toBe("failed");
  await w.retryFailed(id);
  expect(w.store.getState().sessions[id].status).toBe("failed");
  exists = true;
  await w.retryFailed(id);
  expect(w.store.getState().sessions[id].status).toBe("ready");
  expect(w.store.getState().sessions[id].requestGeneration).toBe(3);
});
it("layout admission blocks new document entry without opening another session", async () => {
  const w = createWorkspaceRuntime();
  w.layouts.state.setState({ busy: true });
  expect(await w.openSalesDocument(null)).toBe("");
  expect(Object.keys(w.store.getState().sessions)).toHaveLength(0);
});

// A failed transient fromJSON may already have removed every panel. Sessions
// survive that failure, but their editor must also remain reachable in the host.
it.each(["dirty", "new", "unknown"] as const)(
  "route remount after partial fromJSON failure keeps %s session visible and active",
  async (mode) => {
    const { Orientation } = await import("dockview");
    type Host = import("dockview").DockviewApi;
    type Layout = import("dockview").SerializedDockview;
    type Panel = { id: string; api: { setActive: () => void } };
    function host(failRestore = false) {
      const panels = new Map<string, Panel>();
      const states: Layout["panels"] = {};
      const activeListeners = new Set<(event: { panel?: Panel }) => void>();
      let active: string | undefined;
      const clear = () => {
        panels.clear();
        Object.keys(states).forEach((id) => delete states[id]);
        active = undefined;
        activeListeners.forEach((listener) => listener({}));
      };
      const emptyEvent = () => ({ dispose() {} });
      const api = {
        getPanel: (id: string) => panels.get(id),
        addPanel(options: {
          id: string;
          component: string;
          title: string;
          params: Record<string, unknown>;
        }) {
          const panel = {
            id: options.id,
            api: {
              setActive() {
                active = options.id;
                activeListeners.forEach((listener) => listener({ panel }));
              },
            },
          };
          panels.set(options.id, panel);
          states[options.id] = {
            id: options.id,
            contentComponent: options.component,
            title: options.title,
            params: options.params,
          };
          panel.api.setActive();
          return panel;
        },
        onDidActivePanelChange(listener: (event: { panel?: Panel }) => void) {
          activeListeners.add(listener);
          return { dispose: () => activeListeners.delete(listener) };
        },
        onDidRemovePanel: emptyEvent,
        onDidAddPanel: emptyEvent,
        onDidLayoutChange: emptyEvent,
        clear,
        fromJSON() {
          clear();
          if (failRestore) throw Error("Dockview failed after clearing panels");
        },
        toJSON(): Layout {
          return {
            panels: structuredClone(states),
            grid: {
              width: 1200,
              height: 700,
              orientation: Orientation.HORIZONTAL,
              root: {
                type: "branch",
                data: [
                  {
                    type: "leaf",
                    data: {
                      id: "group-1",
                      views: [...panels.keys()],
                      activeView: active,
                    },
                  },
                ],
              },
            },
          };
        },
      };
      return { api: api as unknown as Host, panels, active: () => active };
    }
    const w = createWorkspaceRuntime();
    const id = await w.openSalesDocument(mode === "new" ? null : "1001");
    w.store.setState((state) => ({
      sessions: {
        ...state.sessions,
        [id]: {
          ...state.sessions[id],
          dirty: true,
          rawBuffers: {
            note: { raw: "Uncommitted editor text", composing: false },
          },
          mutation: mode === "unknown" ? "outcome-unknown" : "idle",
        },
      },
    }));
    const first = host();
    const detach = w.attach(first.api);
    expect(first.panels.has(id)).toBe(true);
    detach();
    const second = host(true);
    const detachSecond = w.attach(second.api);
    try {
      expect(w.store.getState().sessions[id].rawBuffers.note.raw).toBe(
        "Uncommitted editor text",
      );
      expect(w.store.getState().sessions[id].mutation).toBe(
        mode === "unknown" ? "outcome-unknown" : "idle",
      );
      expect(second.panels.has(id)).toBe(true);
      expect(second.active()).toBe(id);
      expect(w.store.getState().activeSessionId).toBe(id);
    } finally {
      detachSecond();
    }
  },
);
