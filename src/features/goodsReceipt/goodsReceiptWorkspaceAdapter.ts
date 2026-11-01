import { goodsReceiptPanelTitle } from "./goodsReceiptSessionStore";
import type { DocumentFeatureAdapter, LocalDraftHooks } from "../../app/workspace/featurePanels";
import { createGoodsReceiptEditorBarrier } from "./goodsReceiptEditorBarrier";
import type { AuthSessionReader } from "../../app/runtime/runtimeDependencies";
import type {
  GoodsReceiptSaveSnapshot,
} from "./contracts";
import {
  createGoodsReceiptSessionStore,
  identityMatches,
  sessionDirty,
  type GoodsReceiptSession,
} from "./goodsReceiptSessionStore";
import type { GoodsReceiptPort } from "../../ports/goodsReceiptPort";
import type { CatalogPort } from "../../ports/catalogPort";
import { writeRaw } from "./sessionEditing";
import { validReceiptDocument, createGoodsReceiptCommands } from "./goodsReceiptCommands";

import { capabilitiesForModule } from "../../app/runtime/moduleCapabilities";
import { createGoodsReceiptCloseRegistry } from "./goodsReceiptCloseAdapter";
import { sameActorScope, type ActorScope } from "../../app/workspace/documentContracts";
import { decodeDraftRecord, type DraftRecord } from "../../infrastructure/drafts/draftRecord";
export function createGoodsReceiptWorkspaceAdapter(deps: { port: GoodsReceiptPort; catalog: CatalogPort; auth: AuthSessionReader; today(): string }, host: {
  scope(): ActorScope;
  isCurrentScope(scope: ActorScope): boolean;
  blocked(): boolean;
  show(id: string): void;
  remove(id: string): void;
}) {
  const store = createGoodsReceiptSessionStore();
  let disposed = false;
  let localDraftHooks: LocalDraftHooks | undefined;
  const port = deps.port;
  function capabilitiesFor(
    scope: ActorScope,
    snapshot = deps.auth.getSnapshot(),
  ) {
    return capabilitiesForModule(snapshot, scope, "goods-receipt");
  }

  function refreshCapabilities() {
    const snapshot = deps.auth.getSnapshot();
    store.setState((state) => {
      let changed = false;
      const sessions = Object.fromEntries(
        Object.entries(state.sessions).map(([id, session]) => {
          const capabilities = capabilitiesFor(session, snapshot);
          if (
            session.capabilities?.read === capabilities.read &&
            session.capabilities?.write === capabilities.write &&
            session.capabilities?.post === capabilities.post
          ) return [id, session];
          changed = true;
          return [id, { ...session, capabilities }];
        }),
      );
      return changed ? { sessions } : state;
    });
  }
  let authConnection: { users: number; unsubscribe: () => void } | undefined;
  function connectAuth() {
    let connection = authConnection;
    if (!connection) {
      connection = { users: 0, unsubscribe: () => {} };
      authConnection = connection;
      try {
        connection.unsubscribe = deps.auth.subscribe(refreshCapabilities);
      } catch (error) {
        authConnection = undefined;
        throw error;
      }
    }
    connection.users++;
    refreshCapabilities();
    let connected = true;
    return () => {
      if (!connected) return;
      connected = false;
      connection.users--;
      if (connection.users === 0 && authConnection === connection) {
        authConnection = undefined;
        connection.unsubscribe();
      }
    };
  }
  function dispose() {
    disposed = true;
    const connection = authConnection;
    authConnection = undefined;
    connection?.unsubscribe();
    for (const request of requests.values()) request.abort();
    requests.clear();
  }
  const router = {
    activate(id: string | null) { if (!id || store.getState().sessions[id]) store.setState({ activeSessionId: id }); },
    mark(identity: import("../../app/workspace/documentContracts").DocumentIdentity) {
      const session = store.getState().sessions[identity.sessionId];
      if (!identityMatches(session, identity) || !host.isCurrentScope(identity)) return false;
      store.setState(s => ({ sessions: { ...s.sessions, [session.sessionId]: { ...session, commandCount: session.commandCount + 1 } } }));
      return true;
    },
  };
  const records = new Map<string, string>();
  const pending = new Map<string, Promise<string>>();
  const requests = new Map<string, AbortController>();
  const generations = new Map<string, number>();
  const recordKey = (id: string, scope = host.scope()) =>
    JSON.stringify([scope.deploymentEpoch, scope.actorKey, scope.actorGeneration, "goods-receipt", id]);
  function currentScope(scope: ActorScope) {
    return !disposed && host.isCurrentScope(scope) && sameActorScope(host.scope(), scope) && sameActorScope(deps.auth.getSnapshot(), scope);
  }
  const update = (
    id: string,
    change: (session: GoodsReceiptSession) => GoodsReceiptSession,
  ) =>
    store.setState((state) => {
      const session = state.sessions[id];
      return session
        ? { sessions: { ...state.sessions, [id]: change(session) } }
        : state;
    });
  function show(id: string) { host.show(id); }
  function loadSession(session: GoodsReceiptSession) {
    const id = session.sessionId;
    const receiptId = session.receiptId!;
    const controller = new AbortController();
    requests.set(id, controller);
    const task = (async () => {
      try {
        const result = await port.get(receiptId, {
          deploymentEpoch: session.deploymentEpoch,
          actorKey: session.actorKey,
          actorGeneration: session.actorGeneration,
          signal: controller.signal,
        });
        const current = store.getState().sessions[id];
        if (
          disposed || controller.signal.aborted ||
          !currentScope(session) ||
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
        else if (!validReceiptDocument(result.value) || result.value.receiptId !== receiptId) {
          update(id, value => ({ ...value, status: "failed", error: { kind: "protocol", code: "receipt-detail", message: "Bản đọc không khớp chứng từ." } }));
        } else {
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
        const current = store.getState().sessions[id];
        if (!controller.signal.aborted && currentScope(session) && identityMatches(current, session) && current.requestGeneration === session.requestGeneration && current.editRevision === session.editRevision)
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
        if (requests.get(id) === controller) {
          pending.delete(id);
          requests.delete(id);
        }
      }
      return id;
    })();
    pending.set(id, task);
    return task;
  }
  const runtime = {
    store,
    port,
    catalog: deps.catalog,
    connectAuth,
    dispose,
    setLocalDraftHooks(hooks: LocalDraftHooks | undefined) { localDraftHooks = hooks; },
    restoreLocal(input: DraftRecord): string {
      const scope = { ...host.scope() };
      if (host.blocked() || !scope.deploymentEpoch || !currentScope(scope)) return "";
      let record: DraftRecord;
      try { record = decodeDraftRecord(input); } catch { return ""; }
      if (record.feature !== "goods-receipt" || record.snapshot.feature !== "goods-receipt" || record.deploymentEpoch !== scope.deploymentEpoch || record.actorKey !== scope.actorKey || !currentScope(scope)) return "";
      const snapshot = record.snapshot;
      const id = record.localDocumentId;
      const capabilities = capabilitiesFor(scope);
      if (!(capabilities.read || capabilities.write || capabilities.post) || store.getState().sessions[id] ||
        snapshot.serverId && Object.values(store.getState().sessions).some(session => sameActorScope(session, scope) && session.receiptId === snapshot.serverId)) return "";
      const generation = (generations.get(id) ?? 0) + 1;
      const session: GoodsReceiptSession = {
        sessionId: id, ...scope, receiptId: snapshot.serverId, generation, requestGeneration: 0,
        draft: snapshot.draft, baseline: snapshot.baseline, initialDraft: snapshot.initialDraft ?? undefined,
        rawBuffers: snapshot.rawBuffers, lookupBuffers: snapshot.lookupBuffers,
        editRevision: record.editRevision, dirty: false, status: "ready", preparing: false,
        mutation: record.unresolvedOperation ? "outcome-unknown" : "idle",
        postAcknowledgement: snapshot.postAcknowledgement ?? undefined,
        ...(record.unresolvedOperation ? { localRecovery: { operationId: record.operationId }, feedback: "Bản lưu có thao tác chưa rõ kết quả. Cần đối soát; không tự gửi lại." } : {}),
        capabilities, commandCount: 0, view: {},
      };
      session.dirty = snapshot.dirty || sessionDirty(session);
      if (!currentScope(scope)) return "";
      generations.set(id, generation);
      const key = snapshot.serverId ? recordKey(snapshot.serverId, scope) : null;
      if (key) records.set(key, id);
      store.setState(state => ({ sessions: { ...state.sessions, [id]: session } }));
      if (!currentScope(scope)) {
        if (key && records.get(key) === id) records.delete(key);
        store.setState(state => {
          if (!identityMatches(state.sessions[id], session)) return state;
          const sessions = { ...state.sessions }; delete sessions[id]; return { sessions };
        });
        return "";
      }
      show(id);
      return id;
    },
    async openGoodsReceiptDocument(
      receiptId: string | null,
      restoredSessionId?: string,
    ): Promise<string> {
      if ((!restoredSessionId && host.blocked()) || !currentScope(host.scope())) return "";
      const capabilities = capabilitiesFor(host.scope());
      if (receiptId ? !capabilities.read : !capabilities.write) return "";
      if (restoredSessionId && store.getState().sessions[restoredSessionId]) return "";
      const key = receiptId ? recordKey(receiptId) : null;
      const existing = key ? records.get(key) : undefined;
      if (existing) {
        show(existing);
        return pending.get(existing) ?? existing;
      }
      const id = restoredSessionId ?? crypto.randomUUID();
      const generation = (generations.get(id) ?? 0) + 1;
      generations.set(id, generation);
      const draft: GoodsReceiptSaveSnapshot | null = receiptId
        ? null
        : {
            receiptId: null,
            expectedVersion: null,
            receiptDate: deps.today(),
            warehouseId: "",
            employeeId: "",
            note: "",
            lines: [
              {
                clientLineId: crypto.randomUUID(),
                receiptLineId: null,
                productId: null,
                quantity: "1.0000",
                unitCost: "0.0000",
              },
            ],
          };
      const session: GoodsReceiptSession = {
        sessionId: id,
        ...host.scope(),
        receiptId,
        generation,
        requestGeneration: receiptId ? 1 : 0,
        draft,
        baseline: null,
        initialDraft: draft ? structuredClone(draft) : undefined,
        rawBuffers: {},
        editRevision: 0,
        dirty: false,
        status: receiptId ? "loading" : "ready",
        mutation: "idle",
        capabilities: capabilitiesFor(host.scope()),
        commandCount: 0,
        view: {},
      };
      store.setState((state) => ({
        sessions: { ...state.sessions, [id]: session },
      }));
      if (key) records.set(key, id);
      if (!restoredSessionId) show(id);
      if (!receiptId) return id;
      return loadSession(session);
    },
    retryFailed(id: string) {
      const session = store.getState().sessions[id];
      if (
        !session ||
        session.status !== "failed" ||
        !session.receiptId ||
        host.blocked() || !currentScope(session) || !capabilitiesFor(session).read
      )
        return Promise.resolve(id);
      const next = {
        ...session,
        status: "loading" as const,
        error: undefined,
        requestGeneration: session.requestGeneration + 1,
      };
      update(id, () => next);
      return loadSession(next);
    },
    writeBuffer(id: string, field: string, raw: string, composing = false) {
      const session = store.getState().sessions[id];
      if (!session || !currentScope(session) || !capabilitiesFor(session).write) return false;
      return writeRaw(store, session, field, raw, composing);
    },
    setGridState(id: string, grid: NonNullable<GoodsReceiptSession["view"]["grid"]>) {
      update(id, (session) => ({
        ...session,
        view: { ...session.view, grid },
      }));
    },
    // Only an admitted close controller may call this in product code (WEB-03).
    finaliseSession(id: string) {
      const session = store.getState().sessions[id];
      if (!session || session.localRecovery || !currentScope(session) || session.mutation !== "idle" || session.preparing)
        return false;
      // Only called after admission; remove/add events never call this method.
      host.remove(id);
      requests.get(id)?.abort();
      requests.delete(id);
      if (session.receiptId) records.delete(recordKey(session.receiptId, session));
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
  const barrier = createGoodsReceiptEditorBarrier(store);
  const commands = createGoodsReceiptCommands(store, port, barrier, (id, receiptId) => {
    const key = recordKey(receiptId);
    const existing = records.get(key);
    if (existing && existing !== id) return false;
    records.set(key, id);
    return true;
  }, (identity) => {
    return currentScope(identity);
  });
  const closeRegistry = createGoodsReceiptCloseRegistry({
    store, save: commands.requestSave, finalise: runtime.finaliseSession,
    scope: host.scope, isCurrentScope: host.isCurrentScope,
    localDraftHooks: () => localDraftHooks,
  });
  const feature: DocumentFeatureAdapter = {
    module: "goods-receipt", componentId: "goods-receipt-document", ...closeRegistry,
    panel(id) {
      const session = store.getState().sessions[id];
      return session ? { id, module: "goods-receipt", kind: "document", componentId: "goods-receipt-document", deploymentEpoch: session.deploymentEpoch, actorKey: session.actorKey, actorGeneration: session.actorGeneration,
        serverId: session.receiptId, ready: session.status === "ready", title: goodsReceiptPanelTitle(session) } : undefined;
    },
    open: runtime.openGoodsReceiptDocument, activate: router.activate,
    restoreLocal: runtime.restoreLocal, setLocalDraftHooks: runtime.setLocalDraftHooks,
    mark: router.mark, subscribe: store.subscribe,
  };
  return { store, port, catalog: deps.catalog, commands, applyProtectedResult: commands.applyProtectedResult, barrier, feature, connectAuth, dispose, restoreLocal: runtime.restoreLocal, setLocalDraftHooks: runtime.setLocalDraftHooks, writeBuffer: runtime.writeBuffer, setGridState: runtime.setGridState, retryFailed: runtime.retryFailed };

}
