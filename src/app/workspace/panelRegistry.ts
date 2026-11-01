import { createStore } from "zustand/vanilla";
import type { DockviewApi } from "dockview";
import type { RuntimeDependencies } from "../runtime/runtimeDependencies";
import { hasModuleCapability } from "../runtime/moduleCapabilities";
import { createSalesWorkspaceAdapter } from "../../features/sales/salesWorkspaceAdapter";
import { createWorkspaceController } from "./workspaceController";
import { createCommandRouter } from "./commandRouter";
import { createWorkspaceLayouts } from "./workspaceLayouts";
import type { LayoutPanelDescriptor, LiveLayoutPanel } from "./layoutPersistenceV2";
import type { ActorScope, DocumentModule, ModuleKey } from "./documentContracts";
import type { DocumentFeatureAdapter, SimplePanelRegistration, WorkspacePanel } from "./featurePanels";

export function createWorkspaceRuntime(deps: RuntimeDependencies) {
  const initial = deps.auth.getSnapshot();
  let actor: ActorScope = { actorKey: initial.actorKey, actorGeneration: initial.actorGeneration };
  let api: DockviewApi | undefined;
  const features = new Map<string, DocumentFeatureAdapter>();
  const simple = new Map<string, SimplePanelRegistration>();
  const subscriptions: (() => void)[] = [];
  const panelState = createStore<{ panels: Record<string, WorkspacePanel>; activeId: string | null; revision: number }>(() => ({ panels: {}, activeId: null, revision: 0 }));
  const scope = () => ({ ...actor });
  function isCurrentScope(value: ActorScope) {
    const auth = deps.auth.getSnapshot();
    return value.actorKey === actor.actorKey && value.actorGeneration === actor.actorGeneration && value.actorKey === auth.actorKey && value.actorGeneration === auth.actorGeneration;
  }
  const documents = () => [...features.values()].flatMap(feature => feature.documents(actor));
  function panel(id: string) {
    for (const feature of features.values()) {
      const value = feature.panel(id);
      if (value) return value;
    }
    return panelState.getState().panels[id];
  }
  function publish() {
    const panels: Record<string, WorkspacePanel> = {};
    for (const value of Object.values(panelState.getState().panels))
      if (value.kind !== "document" && isCurrentScope(value)) panels[value.id] = value;
    for (const feature of features.values()) for (const adapter of feature.documents(actor)) {
      const value = feature.panel(adapter.captureIdentity().sessionId);
      if (value && isCurrentScope(value)) {
        panels[value.id] = value;
        api?.getPanel(value.id)?.api.setTitle?.(value.title);
      }
    }
    panelState.setState(state => ({ panels, revision: state.revision + 1 }));
  }
  function activate(id: string | null) {
    const value = id ? panel(id) : undefined;
    if (id && (!value || !isCurrentScope(value))) return;
    panelState.setState({ activeId: id });
    for (const feature of features.values()) feature.activate(value?.kind === "document" && value.module === feature.module ? id : null);
  }
  function show(id: string) {
    const value = panel(id);
    if (!value || !isCurrentScope(value)) return;
    publish();
    activate(id);
    const existing = api?.getPanel(id);
    if (existing) existing.api.setActive();
    else api?.addPanel({ id, component: value.componentId, title: value.title,
      params: value.kind === "document" ? { sessionId: id, module: value.module, kind: value.kind } : { module: value.module, kind: value.kind }, renderer: "always" });
  }
  function remove(id: string) {
    const visible = api?.getPanel(id);
    if (visible) api!.removePanel(visible);
    panelState.setState(state => { const panels = { ...state.panels }; delete panels[id]; return { panels, activeId: state.activeId === id ? null : state.activeId }; });
  }
  const close = createWorkspaceController({ scope, isCurrentScope,
    documents: () => documents(),
    getAdapter: id => { for (const feature of features.values()) { const value = feature.getAdapter(id); if (value) return value; } },
    finalisePanels(captured) {
      for (const value of Object.values(panelState.getState().panels)) {
        if (!isCurrentScope(captured)) return false;
        if (value.kind !== "document" && isCurrentScope(value)) remove(value.id);
      }
      return isCurrentScope(captured);
    },
  });
  const blocked = () => close.state.getState().busy || layouts.state.getState().busy;
  const salesFeature = createSalesWorkspaceAdapter(deps, { scope, isCurrentScope, blocked, show, remove,
    title: (id, title) => api?.getPanel(id)?.api.setTitle(title),
  });
  function registerFeature(feature: DocumentFeatureAdapter) {
    if (features.has(feature.module)) throw Error(`Duplicate feature: ${feature.module}`);
    features.set(feature.module, feature);
    subscriptions.push(feature.subscribe(publish));
    publish();
  }
  registerFeature(salesFeature.feature);
  function registerPanel(registration: SimplePanelRegistration) {
    const key = `${registration.module}:${registration.kind}`;
    if (simple.has(key)) throw Error(`Duplicate panel registration: ${key}`);
    simple.set(key, registration);
  }
  registerPanel({ module: "sales", kind: "records", componentId: "catalog", title: "Danh sách Sales" });
  function isRegistered(ref: LayoutPanelDescriptor) {
    // Restore must admit simple panels through the same Read gate as openPanel.
    // The default Sales shell is registered separately, including denied users.
    return ref.kind === "document" ? features.has(ref.module) :
      simple.has(`${ref.module}:${ref.kind}`) && hasModuleCapability(deps.auth.getSnapshot(), actor, ref.module, "read");
  }
  function registerSimple(ref: LayoutPanelDescriptor) {
    if (ref.kind === "document") return "";
    const registration = simple.get(`${ref.module}:${ref.kind}`);
    if (!registration || !isCurrentScope(actor)) return "";
    const prior = Object.values(panelState.getState().panels).find(value => value.module === ref.module && value.kind === ref.kind && isCurrentScope(value));
    const id = prior?.id ?? (ref.module === "sales" ? "foundation-catalog" : crypto.randomUUID());
    const existing = panelState.getState().panels[id];
    if (!existing) panelState.setState(state => ({ panels: { ...state.panels, [id]: { ...actor, ...registration, id, ready: true } } }));
    return id;
  }
  registerSimple({ module: "sales", kind: "records" });
  const commands = createCommandRouter({ panel, active: () => panelState.getState().activeId, activate, feature: module => features.get(module), isCurrentScope });
  async function openOwnedDocument(module: DocumentModule, serverId: string | null, restoredId?: string) {
    if (close.state.getState().busy || (!restoredId && layouts.state.getState().busy) || !isCurrentScope(actor)) return "";
    if (!hasModuleCapability(deps.auth.getSnapshot(), actor, module, serverId ? "read" : "write")) return "";
    return features.get(module)?.open(serverId, restoredId) ?? "";
  }
  async function openPanel(module: ModuleKey, filters?: Record<string, string | number>, captured = scope()) {
    if (blocked() || !isCurrentScope(captured) || !hasModuleCapability(deps.auth.getSnapshot(), captured, module, "read")) return "";
    const kind = module === "sales" || module === "goods-receipt" ? "records" : "read-only";
    const id = registerSimple({ module, kind } as LayoutPanelDescriptor);
    if (!id) return "";
    // Runtime-only retarget state; filters never cross the layout trust boundary.
    if (filters !== undefined || kind === "records")
      panelState.setState(state => ({ panels: { ...state.panels, [id]: { ...state.panels[id], filters: { ...filters, pageNumber: 1 } } } }));
    show(id);
    return id;
  }
  function livePanels(): Record<string, LiveLayoutPanel> {
    const result: Record<string, LiveLayoutPanel> = {};
    for (const value of Object.values(panelState.getState().panels)) {
      const descriptor = value.kind === "document" ? (value.serverId ? { kind: "document", module: value.module, serverId: value.serverId } : null) : { kind: value.kind, module: value.module };
      result[value.id] = { actorKey: value.actorKey, actorGeneration: value.actorGeneration, descriptor: descriptor as LayoutPanelDescriptor | null };
    }
    return result;
  }
  const layouts = createWorkspaceLayouts({ documents, panels: livePanels, hasPanel: id => !!panel(id) && isCurrentScope(panel(id)!),
    isRegistered, registerSimple, isCurrentScope, isAdmissionBusy: () => close.state.getState().busy,
    storage: deps.storage, closeAll: () => close.closeAll("layout-reset"), scope,
    setScope(next) { actor = { ...next }; panelState.setState({ panels: {}, activeId: null }); registerSimple({ module: "sales", kind: "records" }); },
    openRestored: (descriptor, id) => descriptor.kind === "document" ? openOwnedDocument(descriptor.module, descriptor.serverId, id) : Promise.resolve(registerSimple(descriptor)),
  });
  return { ...salesFeature, commands, close, layouts, auth: deps.auth, panelState,
    registerFeature, registerPanel, openDocument: (module: DocumentModule, id: string | null) => openOwnedDocument(module, id), openPanel, showPanel: show, removePanel: remove, isCurrentScope,
    registeredPanels: () => [...simple.values()],
    documents, portContext: () => ({ ...actor, signal: new AbortController().signal }),
    openSalesDocument: (id: string | null) => openOwnedDocument("sales", id),
    panelRemoved(_id: string) { /* Dockview remove/add can mean move, never disposal. */ },
    panelAdded(_id: string) {},
    async closePanel(id: string, reason: Parameters<typeof close.requestClose>[1]) {
      const value = panel(id);
      if (!value || !isCurrentScope(value)) return "blocked" as const;
      if (value.kind === "document") return close.requestClose(id, reason);
      if (blocked()) return "blocked" as const;
      remove(id); return "closed" as const;
    },
    splitActive() { const id = panelState.getState().activeId; const target = id && api?.getPanel(id); if (target && target.group.panels.length > 1) target.api.moveTo({ group: target.group, position: "right" }); },
    attach(host: DockviewApi, catalogTitle = "Danh sách Sales") {
      api = host;
      registerSimple({ module: "sales", kind: "records" });
      const active = panelState.getState().activeId;
      for (const adapter of documents()) show(adapter.captureIdentity().sessionId);
      if (active) show(active);
      const activeSub = host.onDidActivePanelChange(event => activate(event.panel?.id ?? null));
      const detachLayout = layouts.attach(host, catalogTitle);
      let recovered = false;
      for (const adapter of documents()) { const id = adapter.captureIdentity().sessionId; if (!host.getPanel(id)) { show(id); recovered = true; } }
      if (recovered && active) show(active);
      return () => { detachLayout(); activeSub.dispose(); if (api === host) api = undefined; };
    },
    dispose() { salesFeature.dispose(); subscriptions.forEach(unsubscribe => unsubscribe()); },
  };
}
export type WorkspaceRuntime = ReturnType<typeof createWorkspaceRuntime>;
