import { expect, it, vi } from "vitest";
import {
  Orientation,
  type DockviewApi,
  type SerializedDockview,
} from "dockview";
import { createWorkspaceLayouts } from "../../../src/app/workspace/workspaceLayouts";
import { createSalesSessionStore } from "../../../src/features/sales/salesSessionStore";
const scope = { actorKey: "test", actorGeneration: 1 };
function setup() {
  const store = createSalesSessionStore();
  let actor = { ...scope };
  const storage = {
    getItem: vi.fn(() => null as string | null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  const closeAll = vi.fn(
    async () => "closed" as "closed" | "cancelled" | "blocked",
  );
  const base: SerializedDockview = {
    grid: {
      root: {
        type: "branch",
        data: [
          {
            type: "leaf",
            data: {
              id: "g",
              views: ["foundation-catalog"],
              activeView: "foundation-catalog",
            },
            size: 800,
          },
        ],
        size: 800,
      },
      width: 800,
      height: 600,
      orientation: Orientation.HORIZONTAL,
    },
    panels: {
      "foundation-catalog": {
        id: "foundation-catalog",
        contentComponent: "catalog",
        title: "Danh sách Sales",
      },
    },
  };
  let snapshot = structuredClone(base);
  let listener = () => {};
  const api = {
    toJSON: vi.fn(() => snapshot),
    fromJSON: vi.fn((layout: SerializedDockview) => {
      snapshot = layout;
    }),
    clear: vi.fn(),
    addPanel: vi.fn(),
    onDidLayoutChange: vi.fn((cb: () => void) => {
      listener = cb;
      return { dispose: vi.fn() };
    }),
  } as unknown as DockviewApi;
  const openRestored = vi.fn(async () => "new-session");
  const layout = createWorkspaceLayouts({
    store,
    closeAll,
    scope: () => actor,
    setScope: (value) => {
      actor = value;
    },
    openRestored,
    storage,
  });
  return {
    layout,
    store,
    storage,
    closeAll,
    api,
    openRestored,
    change: () => listener(),
    base,
  };
}
it.each(["cancelled", "blocked"] as const)(
  "%s admission never changes layout storage or actor",
  async (result) => {
    const w = setup();
    w.layout.attach(w.api, "Sales");
    await w.layout.ready();
    w.closeAll.mockResolvedValue(result);
    vi.clearAllMocks();
    expect(await w.layout.reset()).toBe(result);
    expect(w.api.clear).not.toHaveBeenCalled();
    expect(w.storage.removeItem).not.toHaveBeenCalled();
    expect(await w.layout.switchActor("other")).toBe(result);
    expect(w.layout.state.getState().scope).toEqual(scope);
  },
);
it("serialize layout operations and freeze entry while admission awaits", async () => {
  const w = setup();
  w.layout.attach(w.api, "Sales");
  await w.layout.ready();
  let resolve!: (r: "closed") => void;
  w.closeAll.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const reset = w.layout.reset();
  expect(w.layout.state.getState().busy).toBe(true);
  expect(w.layout.reset()).toBe(reset);
  expect(await w.layout.restore()).toBe("blocked");
  expect(w.api.clear).not.toHaveBeenCalled();
  resolve("closed");
  expect(await reset).toBe("closed");
  expect(w.layout.state.getState().busy).toBe(false);
});
it("storage failures preserve a usable workspace and report the limitation", async () => {
  const w = setup();
  w.storage.getItem.mockImplementation(() => {
    throw Error("denied");
  });
  w.layout.attach(w.api, "Sales");
  await w.layout.ready();
  expect(w.layout.state.getState().message).toContain("bố cục");
  w.storage.setItem.mockImplementation(() => {
    throw Error("quota");
  });
  expect(w.layout.saveNow()).toBe(false);
  expect(w.layout.state.getState().message).toContain("lưu");
});
it("invalid storage and fromJSON errors fallback without leaving busy state", async () => {
  const w = setup();
  w.storage.getItem.mockReturnValue("broken");
  w.layout.attach(w.api, "Sales");
  await w.layout.ready();
  expect(w.layout.state.getState().busy).toBe(false);
  expect(w.api.addPanel).toHaveBeenCalled();
  w.storage.getItem.mockReturnValue(
    JSON.stringify({
      schemaVersion: 1,
      registryVersion: 1,
      scope,
      layout: w.base,
      dropped: 0,
    }),
  );
  vi.mocked(w.api.fromJSON).mockImplementation(() => {
    throw Error("bad-layout");
  });
  expect(await w.layout.restore()).toBe("closed");
  expect(w.layout.state.getState().busy).toBe(false);
  expect(w.layout.state.getState().message).toContain("mặc định");
});
