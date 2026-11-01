import type { WorkspaceRuntime } from "../workspace/panelRegistry";
import type { GoodsReceiptRuntime } from "../../features/goodsReceipt/GoodsReceiptContext";
import type { AuthSession } from "../../infrastructure/http/authSession";
import type { DraftRepository } from "../../infrastructure/drafts/indexedDbDraftRepository";
import { createLocalDraftPersistence } from "../../infrastructure/drafts/localDraftPersistence";
import { captureFeatureDraft } from "../../infrastructure/drafts/featureDraftSnapshot";
import { createDurableDraftWorkspace } from "./durableDraftWorkspace";
import { hasModuleCapability } from "./moduleCapabilities";
import { sameActorScope, type DocumentIdentity } from "../workspace/documentContracts";
import type { createReceiptCapabilityLoading } from "./receiptCapabilityLoading";
import type { DraftRecord } from "../../infrastructure/drafts/draftRecord";

export function createProductionDrafts(auth: AuthSession, workspace: WorkspaceRuntime, receipt: GoodsReceiptRuntime,
  capabilities: ReturnType<typeof createReceiptCapabilityLoading>, repository: DraftRepository) {
  const scope = auth.getSnapshot();
  if (scope.status !== "authenticated") throw new Error("Authenticated draft scope required");
  let disposed = false;
  let recoveryHandlers: { validateRestore(record: DraftRecord): Promise<boolean>; bindRestored(record: DraftRecord, id: string): void } | undefined;
  const isCurrent = () => !disposed && auth.getSnapshot().status === "authenticated" && sameActorScope(scope, auth.getSnapshot());
  const persistence = createLocalDraftPersistence({ namespace: { deploymentEpoch: scope.deploymentEpoch, actorKey: scope.actorKey }, repository, isCurrent });
  const recovery = createDurableDraftWorkspace({ repository, persistence, isCurrent,
    ready: () => capabilities.state.getState().initialSettled,
    allowed: feature => (["read", "write", "post"] as const).some(permission => hasModuleCapability(auth.getSnapshot(), scope, feature, permission)),
    isLive: key => !!(key.feature === "sales" ? workspace.store : receipt.store).getState().sessions[key.localDocumentId],
    restore: record => record.feature === "sales" ? workspace.restoreLocal(record) : receipt.restoreLocal(record),
    validateRestore: record => recoveryHandlers?.validateRestore(record) ?? Promise.resolve(true),
    restored: (record, id) => recoveryHandlers?.bindRestored(record, id),
  });
  function capture() {
    if (!isCurrent()) return;
    for (const [feature, sessions] of [["sales", workspace.store.getState().sessions], ["goods-receipt", receipt.store.getState().sessions]] as const) {
      for (const session of Object.values(sessions)) {
        if (!sameActorScope(scope, session)) continue;
        const key = { feature, localDocumentId: session.sessionId };
        try {
          const snapshot = captureFeatureDraft(feature, session);
          if (snapshot) persistence.update({ ...key, snapshot, editRevision: session.editRevision,
            unresolvedOperation: session.mutation === "outcome-unknown" || !!session.localRecovery,
            operationId: session.localRecovery?.operationId ?? null });
        } catch { persistence.fail(key); }
      }
    }
  }
  async function beforeClose(identity: DocumentIdentity, stillAdmitted: () => boolean) {
    if (!isCurrent()) return false;
    capture();
    return persistence.discard({ feature: identity.module, localDocumentId: identity.sessionId }, identity.editRevision, stillAdmitted);
  }
  workspace.setLocalDraftHooks({ beforeClose }); receipt.setLocalDraftHooks({ beforeClose });
  const subscriptions = [workspace.store.subscribe(capture), receipt.store.subscribe(capture)];
  async function flush() {
    capture();
    const keys = [
      ...Object.values(workspace.store.getState().sessions).map(session => ({ feature: "sales" as const, localDocumentId: session.sessionId })),
      ...Object.values(receipt.store.getState().sessions).map(session => ({ feature: "goods-receipt" as const, localDocumentId: session.sessionId })),
    ];
    await Promise.allSettled(keys.map(key => persistence.flush(key)));
  }
  const pagehide = () => { if (isCurrent()) void flush(); };
  const visibility = () => { if (document.visibilityState === "hidden") pagehide(); };
  globalThis.window?.addEventListener("pagehide", pagehide); globalThis.document?.addEventListener("visibilitychange", visibility);
  function dispose() {
    if (disposed) return;
    disposed = true;
    subscriptions.forEach(unsubscribe => unsubscribe());
    globalThis.window?.removeEventListener("pagehide", pagehide); globalThis.document?.removeEventListener("visibilitychange", visibility);
    recovery.dispose(); persistence.dispose();
    workspace.setLocalDraftHooks(undefined); receipt.setLocalDraftHooks(undefined);
  }
  subscriptions.push(auth.subscribe(() => {
    if (!isCurrent()) {
      dispose();
      workspace.store.setState({ sessions: {}, activeSessionId: null });
      receipt.store.setState({ sessions: {}, activeSessionId: null });
    } else { void recovery.review(); }
  }));
  subscriptions.push(capabilities.state.subscribe(() => { if (isCurrent() && capabilities.state.getState().initialSettled) void recovery.review(); }));
  return { persistence, recovery, capture, flush, dispose,
    setRecoveryHandlers(handlers: typeof recoveryHandlers) { recoveryHandlers = handlers; },
    copySnapshot(feature: "sales" | "goods-receipt", id: string): string | null {
      if (!isCurrent() || !(["read", "write", "post"] as const).some(permission => hasModuleCapability(auth.getSnapshot(), scope, feature, permission))) return null;
      const session = (feature === "sales" ? workspace.store : receipt.store).getState().sessions[id];
      if (!session || !sameActorScope(scope, session)) return null;
      try { const snapshot = captureFeatureDraft(feature, session); return snapshot ? JSON.stringify(snapshot, null, 2) : null; } catch { return null; }
    },
  };
}
export type ProductionDrafts = ReturnType<typeof createProductionDrafts>;
