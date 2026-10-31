import { createEditorBarrier } from "../../shared/grid/editorBarrier";
import type { DockviewApi } from "dockview";
import type { SalesPort } from "../../ports/salesPort";
import type {
  SalesSaveSnapshot,
  ServerId,
} from "../../features/sales/contracts";
import {
  createSalesSessionStore,
  canEdit,
  sessionDirty,
  identityMatches,
  type SalesSession,
} from "../../features/sales/salesSessionStore";
import { createFakeSalesPort } from "../../infrastructure/fake/fakeSalesPort";
import { createScenarioController } from "../../infrastructure/fake/scenarioController";
import { createCommandRouter } from "./commandRouter";
import { createWorkspaceController } from "./workspaceController";
import { createSalesPortCommands } from "../../features/sales/salesCommands";

export function createWorkspaceRuntime(
  read?: SalesPort["get"],
  actor = { actorKey: "workspace-demo", actorGeneration: 1 },
) {
  const store = createSalesSessionStore();
  const scenarios = createScenarioController();
  const port = createFakeSalesPort(scenarios);
  const get = read ?? port.get;
  scenarios.state.subscribe(({ capabilities }, previous) => {
    if (capabilities === previous.capabilities) return;
    store.setState((state) => ({
      sessions: Object.fromEntries(
        Object.entries(state.sessions).map(([id, session]) => [
          id,
          { ...session, capabilities },
        ]),
      ),
    }));
  });
  const commands = createCommandRouter(store);
  const records = new Map<string, string>();
  const pending = new Map<string, Promise<string>>();
  const requests = new Map<string, AbortController>();
  let api: DockviewApi | undefined;
  const recordKey = (id: string) =>
    JSON.stringify([actor.actorKey, actor.actorGeneration, "sales", id]);
  const update = (
    id: string,
    change: (session: SalesSession) => SalesSession,
  ) =>
    store.setState((state) => {
      const session = state.sessions[id];
      return session
        ? { sessions: { ...state.sessions, [id]: change(session) } }
        : state;
    });
  function show(id: string) {
    const session = store.getState().sessions[id];
    if (!session) return;
    commands.activate(id);
    if (!api) return;
    const existing = api.getPanel(id);
    if (existing) existing.api.setActive();
    else
      api.addPanel({
        id,
        component: "sales",
        title: session.saleId ? `Sales ${session.saleId}` : "Sales mới",
        params: { sessionId: id },
        renderer: "always",
      });
  }
  const runtime = {
    store,
    commands,
    port,
    scenarios,
    portContext: () => ({ ...actor, signal: new AbortController().signal }),
    attach(host: DockviewApi) {
      api = host;
      const active = store.getState().activeSessionId;
      Object.keys(store.getState().sessions).forEach(show);
      if (active) show(active);
      const activeSub = host.onDidActivePanelChange((event) =>
        commands.activate(
          event.panel && store.getState().sessions[event.panel.id]
            ? event.panel.id
            : null,
        ),
      );
      // These events represent layout membership, never document disposal.
      const removeSub = host.onDidRemovePanel((panel) =>
        this.panelRemoved(panel.id),
      );
      const addSub = host.onDidAddPanel((panel) => this.panelAdded(panel.id));
      return () => {
        activeSub.dispose();
        removeSub.dispose();
        addSub.dispose();
        if (api === host) api = undefined;
      };
    },
    panelRemoved(_id: string) {
      /* Move/remove is not an admitted close. */
    },
    panelAdded(_id: string) {
      /* Session identity is independent of layout membership. */
    },
    async openSalesDocument(saleId: ServerId | null): Promise<string> {
      const key = saleId ? recordKey(saleId) : null;
      const existing = key ? records.get(key) : undefined;
      if (existing) {
        show(existing);
        return pending.get(existing) ?? existing;
      }
      const id = crypto.randomUUID();
      const draft: SalesSaveSnapshot | null = saleId
        ? null
        : {
            saleId: null,
            expectedVersion: null,
            saleDate: "2026-10-31",
            customerId: "",
            warehouseId: "",
            employeeId: "",
            note: "",
            lines: [
              {
                clientLineId: crypto.randomUUID(),
                saleLineId: null,
                productId: null,
                qty: "1.0000",
                unitPrice: "0.0000",
                isGift: false,
              },
            ],
          };
      const session: SalesSession = {
        sessionId: id,
        ...actor,
        saleId,
        generation: 1,
        requestGeneration: saleId ? 1 : 0,
        draft,
        baseline: null,
        initialDraft: draft ? structuredClone(draft) : undefined,
        rawBuffers: {},
        editRevision: 0,
        dirty: false,
        status: saleId ? "loading" : "ready",
        mutation: "idle",
        capabilities: scenarios.state.getState().capabilities,
        commandCount: 0,
        view: {},
      };
      store.setState((state) => ({
        sessions: { ...state.sessions, [id]: session },
      }));
      if (key) records.set(key, id);
      show(id);
      if (!saleId) return id;
      const controller = new AbortController();
      requests.set(id, controller);
      const task = (async () => {
        try {
          const result = await get(saleId, {
            ...actor,
            signal: controller.signal,
          });
          const current = store.getState().sessions[id];
          if (
            !identityMatches(current, session) ||
            current.requestGeneration !== session.requestGeneration ||
            current.editRevision !== session.editRevision
          )
            return id;
          if (result.kind === "failed")
            update(id, (value) => ({
              ...value,
              status: "failed",
              error: result.error,
            }));
          else {
            const lines = result.value.saved.lines.map((line) => ({
              ...line,
              clientLineId: crypto.randomUUID(),
            }));
            const saved = { ...result.value.saved, lines };
            const baseline = {
              ...result.value,
              saved,
              lines: result.value.lines.map((line, index) => ({
                ...line,
                clientLineId: lines[index].clientLineId,
              })),
            };
            update(id, (value) => ({
              ...value,
              baseline,
              draft: structuredClone(saved),
              status: "ready",
            }));
          }
        } catch (error) {
          if (identityMatches(store.getState().sessions[id], session))
            update(id, (value) => ({
              ...value,
              status: "failed",
              error: {
                kind: "unavailable",
                code: "read-failed",
                message:
                  error instanceof Error
                    ? error.message
                    : "Không đọc được chứng từ.",
              },
            }));
        } finally {
          pending.delete(id);
          requests.delete(id);
        }
        return id;
      })();
      pending.set(id, task);
      return task;
    },
    writeBuffer(id: string, field: string, raw: string, composing = false) {
      update(id, (session) => {
        if (!canEdit(session)) return session;
        const previous = session.rawBuffers[field];
        if (previous?.raw === raw && previous.composing === composing)
          return session;
        const rawBuffers = {
          ...session.rawBuffers,
          [field]: { raw, composing },
        };
        const dirty = sessionDirty({ ...session, rawBuffers });
        return {
          ...session,
          rawBuffers,
          dirty,
          editRevision: session.editRevision + 1,
        };
      });
    },
    setGridState(id: string, grid: NonNullable<SalesSession["view"]["grid"]>) {
      update(id, (session) => ({
        ...session,
        view: { ...session.view, grid },
      }));
    },
    splitActive() {
      const target = commands.capture();
      const panel = target && api?.getPanel(target.sessionId);
      if (panel && panel.group.panels.length > 1)
        panel.api.moveTo({ group: panel.group, position: "right" });
    },
    // Only an admitted close controller may call this in product code (WEB-03).
    finaliseSession(id: string) {
      const session = store.getState().sessions[id];
      if (!session || session.mutation !== "idle" || session.preparing)
        return false;
      // Only called after admission; remove/add events never call this method.
      const panel = api?.getPanel(id);
      if (panel) api!.removePanel(panel);
      requests.get(id)?.abort();
      requests.delete(id);
      if (session.saleId) records.delete(recordKey(session.saleId));
      store.setState((state) => {
        const sessions = { ...state.sessions };
        delete sessions[id];
        return {
          sessions,
          activeSessionId:
            state.activeSessionId === id ? null : state.activeSessionId,
        };
      });
      return true;
    },
  };
  const barrier = createEditorBarrier(store);
  const sales = createSalesPortCommands(store, port, barrier, (id, saleId) => {
    const key = recordKey(saleId);
    const existing = records.get(key);
    if (existing && existing !== id) return false;
    records.set(key, id);
    api?.getPanel(id)?.api.setTitle(`Sales ${saleId}`);
    return true;
  });
  const close = createWorkspaceController({
    store,
    save: sales.requestSave,
    finalise: (id) => runtime.finaliseSession(id),
  });
  return { ...runtime, sales, close, barrier };
}
export type WorkspaceRuntime = ReturnType<typeof createWorkspaceRuntime>;
