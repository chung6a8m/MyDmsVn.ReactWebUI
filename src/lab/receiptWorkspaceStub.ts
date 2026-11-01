import { hasModuleCapability } from "../app/runtime/moduleCapabilities";
// F02 lifetime probe only. Not a Goods Receipt DTO/validator or production port.
import { createStore, type StoreApi } from "zustand/vanilla";
import type { WorkspaceRuntime } from "../app/workspace/panelRegistry";
import { sameDocumentIdentity, type DocumentIdentity, type DocumentCloseAdapter } from "../app/workspace/documentContracts";
export interface ReceiptStubSession extends DocumentIdentity {
  serverId: string | null;
  raw: string;
  saved: string;
  mutation: "idle" | "pending" | "outcome-unknown";
  commandCount: number;
}
export interface ReceiptStubPort { save(raw: string): Promise<"saved" | "unknown" | "failed"> }
const instances = new WeakMap<WorkspaceRuntime, ReceiptWorkspaceStub>();
export function registerReceiptWorkspaceStub(w: WorkspaceRuntime, port: ReceiptStubPort = { save: async () => "saved" }) {
  const existing = instances.get(w);
  if (existing) return existing;
  const store = createStore<{ sessions: Record<string, ReceiptStubSession> }>(() => ({ sessions: {} }));
  const records = new Map<string, string>();
  const update = (id: string, change: (s: ReceiptStubSession) => ReceiptStubSession) => store.setState(state => state.sessions[id] ? { sessions: { ...state.sessions, [id]: change(state.sessions[id]) } } : state);
  function getAdapter(id: string): DocumentCloseAdapter | undefined {
    if (!store.getState().sessions[id]) return;
    const get = () => store.getState().sessions[id];
    const valid = (identity: DocumentIdentity) => !!get() && sameDocumentIdentity(get(), identity) && w.isCurrentScope(identity) && get().mutation === "idle";
    return {
      captureIdentity: () => { const { sessionId, module, generation, editRevision, actorKey, actorGeneration } = get(); return { sessionId, module, generation, editRevision, actorKey, actorGeneration }; },
      title: () => get().serverId ? `Nhập kho ${get().serverId}` : "Nhập kho mới",
      isCloseBlocked: () => !get() || get().mutation !== "idle",
      isDirtyIncludingRaw: () => get().raw !== get().saved,
      mayFinalise: valid,
      finaliseAfterAdmission(identity) {
        if (!valid(identity)) return false;
        const session = get();
        if (session.serverId) records.delete(JSON.stringify([session.actorKey, session.actorGeneration, session.serverId]));
        w.removePanel(id);
        store.setState(state => { const sessions = { ...state.sessions }; delete sessions[id]; return { sessions }; });
        return true;
      },
      async prepareAndSave(identity) {
        if (!valid(identity)) return "blocked";
        const raw = get().raw;
        if (raw === "-" || raw === "invalid") return "blocked";
        update(id, s => ({ ...s, mutation: "pending" }));
        let outcome: "saved" | "failed" | "unknown";
        try { outcome = await port.save(raw); } catch { outcome = "unknown"; }
        if (!get() || !sameDocumentIdentity(get(), identity) || !w.isCurrentScope(identity)) return "blocked";
        update(id, s => ({ ...s, mutation: outcome === "unknown" ? "outcome-unknown" : "idle", saved: outcome === "saved" ? raw : s.saved }));
        return outcome === "saved" ? "saved-clean" : outcome;
      },
    };
  }
  w.registerFeature({ module: "goods-receipt", componentId: "goods-receipt", getAdapter,
    documents: scope => Object.values(store.getState().sessions).filter(s => s.actorKey === scope.actorKey && s.actorGeneration === scope.actorGeneration).map(s => getAdapter(s.sessionId)!),
    panel(id) { const s = store.getState().sessions[id]; return s ? { ...s, id, kind: "document", componentId: "goods-receipt", ready: true, title: s.serverId ? `Nhập kho ${s.serverId}` : "Nhập kho mới" } : undefined; },
    async open(serverId, restoredId) {
      const scope = w.portContext();
      const key = serverId ? JSON.stringify([scope.actorKey, scope.actorGeneration, serverId]) : null;
      const found = key ? records.get(key) : undefined;
      if (found) { w.showPanel(found); return found; }
      const id = restoredId ?? crypto.randomUUID();
      store.setState(state => ({ sessions: { ...state.sessions, [id]: { sessionId: id, module: "goods-receipt", actorKey: scope.actorKey, actorGeneration: scope.actorGeneration, generation: 1, editRevision: 0, serverId, raw: "", saved: "", mutation: "idle", commandCount: 0 } } }));
      if (key) records.set(key, id);
      if (!restoredId) w.showPanel(id);
      return id;
    },
    activate() {},
    mark(identity) { const s = store.getState().sessions[identity.sessionId]; if (!s || !sameDocumentIdentity(s, identity) || !w.isCurrentScope(identity)) return false; update(s.sessionId, value => ({ ...value, commandCount: value.commandCount + 1 })); return true; },
    subscribe: store.subscribe,
  });
  w.registerPanel({ module: "goods-receipt", kind: "records", componentId: "goods-receipt-records", title: "Danh sách nhập kho" });
  w.registerPanel({ module: "inventory-balances", kind: "read-only", componentId: "inventory-balances", title: "Tồn kho" });
  w.registerPanel({ module: "inventory-stock-card", kind: "read-only", componentId: "inventory-stock-card", title: "Thẻ kho" });
  const result = { store, write(id: string, raw: string) { update(id, s => s.mutation === "idle" && w.isCurrentScope(s) && hasModuleCapability(w.auth.getSnapshot(), s, "goods-receipt", "write") ? { ...s, raw, editRevision: s.editRevision + 1 } : s); },
    setMutation(id: string, mutation: ReceiptStubSession["mutation"]) { update(id, s => ({ ...s, mutation })); } };
  instances.set(w, result);
  return result;
}
export interface ReceiptWorkspaceStub {
  store: StoreApi<{ sessions: Record<string, ReceiptStubSession> }>;
  write(id: string, raw: string): void;
  setMutation(id: string, mutation: ReceiptStubSession["mutation"]): void;
}
