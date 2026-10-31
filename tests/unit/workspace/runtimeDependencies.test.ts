import { afterEach, expect, it, vi } from "vitest";
import { Orientation, type DockviewApi, type SerializedDockview } from "dockview";
import { createWorkspaceRuntime } from "../../../src/app/workspace/panelRegistry";
import { layoutStorageKey } from "../../../src/app/workspace/workspaceLayouts";
import { createWorkspaceDocument } from "../../../src/infrastructure/fake/workspaceFixtures";
import type { PortContext, ReadResult, SalesDocument } from "../../../src/features/sales/contracts";
import type { SalesPort } from "../../../src/ports/salesPort";
import { injectedRuntimeFixture } from "./injectedRuntimeFixture";

afterEach(() => { vi.unstubAllGlobals(); });

it("uses the injected Sales and Catalog instances without composing a hidden fake", () => {
  const fixture = injectedRuntimeFixture();
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  expect(workspace.port).toBe(fixture.sales);
  expect(workspace.catalog).toBe(fixture.catalog);
  expect(fixture.observerCount()).toBe(0);
});

it("new documents capture authenticated actor/capabilities and call the business calendar each time", async () => {
  const fixture = injectedRuntimeFixture();
  fixture.dependencies.today = vi.fn()
    .mockReturnValueOnce("2031-02-28")
    .mockReturnValueOnce("2031-03-01");
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  const first = await workspace.openSalesDocument(null);
  const second = await workspace.openSalesDocument(null);
  expect(workspace.store.getState().sessions[first]).toMatchObject({
    actorKey: "authenticated-user-42/session-A", actorGeneration: 7,
    capabilities: { read: true, write: true, post: false },
    draft: { saleDate: "2031-02-28" },
  });
  expect(workspace.store.getState().sessions[second].draft!.saleDate).toBe("2031-03-01");
  expect(fixture.dependencies.today).toHaveBeenCalledTimes(2);
});

it("reads through the injected Sales port with captured actor scope and independent line identities", async () => {
  const fixture = injectedRuntimeFixture();
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  const id = await workspace.openSalesDocument("9007199254740993");
  expect(fixture.sales.get).toHaveBeenCalledExactlyOnceWith("9007199254740993", {
    actorKey: "authenticated-user-42/session-A", actorGeneration: 7, signal: expect.any(AbortSignal),
  });
  const session = workspace.store.getState().sessions[id];
  expect(session.status).toBe("ready");
  expect(session.saleId).toBe("9007199254740993");
  expect(new Set(session.draft!.lines.map(line => line.clientLineId)).size).toBe(session.draft!.lines.length);
  expect(session.draft!.lines[0].productId).toBe(session.draft!.lines[1].productId);
});

it("preserves the receiver when invoking a stateful injected Sales port", async () => {
  const fixture = injectedRuntimeFixture();
  class StatefulSalesPort implements SalesPort {
    readonly received: { saleId: string; context: PortContext }[] = [];
    list = fixture.sales.list;
    save = fixture.sales.save;
    post = fixture.sales.post;
    async get(saleId: string, context: PortContext): Promise<ReadResult<SalesDocument>> {
      this.received.push({ saleId, context });
      return { kind: "success", value: createWorkspaceDocument(saleId) };
    }
  }
  const port = new StatefulSalesPort();
  fixture.dependencies.sales = port;
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  const id = await workspace.openSalesDocument("1001");
  expect(workspace.store.getState().sessions[id].status).toBe("ready");
  expect(port.received).toEqual([{ saleId: "1001", context: {
    actorKey: "authenticated-user-42/session-A", actorGeneration: 7, signal: expect.any(AbortSignal),
  } }]);
});

it("same-actor permission changes apply independently without discarding invalid text", async () => {
  const fixture = injectedRuntimeFixture();
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  const disconnect = workspace.connectAuth();
  try {
    const id = await workspace.openSalesDocument("1001");
    const before = workspace.store.getState().sessions[id];
    workspace.writeBuffer(id, "saleDate", "invalid-date");
    fixture.publish({ ...fixture.auth.getSnapshot(), capabilities: { read: false, write: false, post: true } });
    expect(workspace.store.getState().sessions[id]).toMatchObject({
      sessionId: id, generation: before.generation, actorKey: before.actorKey,
      rawBuffers: { saleDate: { raw: "invalid-date" } }, dirty: true,
      capabilities: { read: false, write: false, post: true },
    });
    workspace.writeBuffer(id, "saleDate", "must not edit after permission revoke");
    expect(workspace.store.getState().sessions[id].rawBuffers.saleDate.raw).toBe("invalid-date");
  } finally { disconnect(); }
});

it("foreign auth generations fail closed without relabeling or discarding the old owner's session", async () => {
  const fixture = injectedRuntimeFixture();
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  const disconnect = workspace.connectAuth();
  try {
    const id = await workspace.openSalesDocument("1001");
    workspace.writeBuffer(id, "note", "old owner private text");
    workspace.store.setState(state => ({ sessions: { ...state.sessions, [id]: { ...state.sessions[id], mutation: "outcome-unknown" } } }));
    fixture.publish({ actorKey: "different-user/session-B", actorGeneration: 8, capabilities: { read: true, write: true, post: true } });
    expect(workspace.store.getState().sessions[id]).toMatchObject({
      actorKey: "authenticated-user-42/session-A", actorGeneration: 7,
      rawBuffers: { note: { raw: "old owner private text" } },
      mutation: "outcome-unknown", capabilities: { read: false, write: false, post: false },
    });
  } finally { disconnect(); }
});

it("auth observers are lazy, refcounted and disposable without deleting unknown documents", async () => {
  const fixture = injectedRuntimeFixture();
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  expect(fixture.observerCount()).toBe(0);
  const first = workspace.connectAuth();
  const second = workspace.connectAuth();
  expect(fixture.observerCount()).toBe(1);
  first();
  expect(fixture.observerCount()).toBe(1);
  second();
  expect(fixture.observerCount()).toBe(0);
  const reconnect = workspace.connectAuth();
  const id = await workspace.openSalesDocument(null);
  workspace.store.setState(state => ({ sessions: { ...state.sessions, [id]: { ...state.sessions[id], mutation: "outcome-unknown" } } }));
  workspace.dispose();
  expect(fixture.observerCount()).toBe(0);
  expect(workspace.store.getState().sessions[id].mutation).toBe("outcome-unknown");
  reconnect();
  expect(fixture.observerCount()).toBe(0);
});

it("closing an injected read aborts its captured request and fences a late completion", async () => {
  const fixture = injectedRuntimeFixture();
  let resolve!: (result: ReadResult<SalesDocument>) => void;
  fixture.sales.get = vi.fn(() => new Promise<ReadResult<SalesDocument>>(done => { resolve = done; }));
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  const opening = workspace.openSalesDocument("1001");
  const id = Object.keys(workspace.store.getState().sessions)[0];
  const context = vi.mocked(fixture.sales.get).mock.calls[0][1];
  expect(workspace.finaliseSession(id)).toBe(true);
  expect(context.signal.aborted).toBe(true);
  resolve({ kind: "success", value: createWorkspaceDocument("1001") });
  await opening;
  expect(workspace.store.getState().sessions[id]).toBeUndefined();
});

it.each(["injected", "disabled"] as const)("layout persistence uses %s storage instead of ambient browser storage", async mode => {
  const fixture = injectedRuntimeFixture();
  const ambient = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
  vi.stubGlobal("window", { localStorage: ambient, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
  fixture.dependencies.storage = mode === "injected" ? storage : null;
  const workspace = createWorkspaceRuntime(fixture.dependencies);
  const snapshot: SerializedDockview = {
    grid: { width: 800, height: 600, orientation: Orientation.HORIZONTAL,
      root: { type: "branch", data: [{ type: "leaf", data: { id: "group", views: ["foundation-catalog"], activeView: "foundation-catalog" } }] } },
    panels: { "foundation-catalog": { id: "foundation-catalog", contentComponent: "catalog", title: "Sales" } },
  };
  const api = { clear() {}, addPanel() {}, toJSON: () => structuredClone(snapshot),
    onDidLayoutChange: () => ({ dispose() {} }) } as unknown as DockviewApi;
  const detach = workspace.layouts.attach(api, "Sales");
  try {
    await workspace.layouts.ready();
    expect(workspace.layouts.saveNow()).toBe(mode === "injected");
    if (mode === "injected") {
      const key = layoutStorageKey({ actorKey: "authenticated-user-42/session-A", actorGeneration: 7 });
      expect(storage.getItem).toHaveBeenCalledWith(key);
      expect(storage.setItem).toHaveBeenCalledWith(key, expect.any(String));
    }
    expect(ambient.getItem).not.toHaveBeenCalled();
    expect(ambient.setItem).not.toHaveBeenCalled();
  } finally { detach(); }
});
