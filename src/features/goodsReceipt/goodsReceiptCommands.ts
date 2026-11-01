import { createGoodsReceiptEditorBarrier } from "./goodsReceiptEditorBarrier";
import type { GoodsReceiptDocument, GoodsReceiptPostAcknowledgement } from "./contracts";
import type { WriteResult, UiFailure, ValidationIssue, PortContext } from "../../ports/portContracts";
export type SaveOutcome = { kind: "saved"; document: GoodsReceiptDocument } | { kind: "posted"; acknowledgement: GoodsReceiptPostAcknowledgement } | { kind: "blocked"; issues: ValidationIssue[] } | { kind: "failed"; error: UiFailure } | { kind: "outcome-unknown" };
import {
  identityMatches,
  type GoodsReceiptSessionStore,
  type SessionIdentity,
} from "./goodsReceiptSessionStore";
import type { GoodsReceiptPort } from "../../ports/goodsReceiptPort";
import type {
  GoodsReceiptSaveSnapshot,
} from "./contracts";
import { canEdit, type GoodsReceiptSession } from "./goodsReceiptSessionStore";

import { committedLookups, reconcileDocument, validReceiptDocument, validSaveResult } from "./goodsReceiptReconciliation";
import { createGoodsReceiptRecovery } from "./goodsReceiptRecovery";
export { businessMatches, reconcileDocument, validReceiptDocument } from "./goodsReceiptReconciliation";

export function createGoodsReceiptCommands(
  store: GoodsReceiptSessionStore,
  port: GoodsReceiptPort,
  barrier = createGoodsReceiptEditorBarrier(store),
  bindRecord: (sessionId: string, receiptId: string) => boolean = () => true,
  ownsScope: (identity: SessionIdentity) => boolean = () => true,
) {
  const pending = new Map<
    string,
    { kind: "save" | "post"; task: Promise<SaveOutcome> }
  >();
  const context = (s: SessionIdentity): PortContext => ({
    actorKey: s.actorKey,
    actorGeneration: s.actorGeneration,
    signal: new AbortController().signal,
  });
  function patch(identity: SessionIdentity, change: Partial<GoodsReceiptSession>) {
    store.setState((state) => {
      const current = state.sessions[identity.sessionId];
      return identityMatches(current, identity)
        ? {
            sessions: {
              ...state.sessions,
              [identity.sessionId]: { ...current, ...change },
            },
          }
        : state;
    });
  }
  function blocked(
    identity: SessionIdentity | undefined,
    message: string,
  ): SaveOutcome {
    const issues = [{ code: "not-ready", field: "", message }];
    if (identity) patch(identity, { feedback: message, issues });
    return { kind: "blocked", issues };
  }
  function accept(
    session: GoodsReceiptSession,
    doc: GoodsReceiptDocument,
    sent?: GoodsReceiptSaveSnapshot,
  ) {
    if (!ownsScope(session) || !validReceiptDocument(doc) || (session.postAcknowledgement && doc.status !== "Posted")) return false;
    if (!bindRecord(session.sessionId, doc.receiptId)) return false;
    const document = reconcileDocument(doc, session, sent);
    patch(session, {
      receiptId: document.receiptId,
      baseline: document,
      draft: structuredClone(document.saved),
      rawBuffers: {},
      lookupBuffers: committedLookups(session, document),
      dirty: false,
      preparing: false,
      mutation: "idle",
      mutationSnapshot: undefined,
      mutationKind: undefined,
      recovery: undefined,
      recoveryReadRevision: (session.recoveryReadRevision ?? 0) + 1,
      issues: [],
      feedback:
        document.status === "Posted"
          ? "Đã Post · chỉ đọc."
          : "Đã lưu chứng từ.",
    });
    return true;
  }
  const { loadPostedDetail, ...recoveryCommands } = createGoodsReceiptRecovery({ store, port, ownsScope, patch, context, accept });
  function mappedIssues(
    issues: readonly ValidationIssue[] | undefined,
    snapshot: GoodsReceiptSaveSnapshot,
  ) {
    return (
      issues?.map((issue) => {
        const match = /^lines\[(\d+)\]\.(\w+)$/.exec(issue.field);
        const id = match
          ? snapshot.lines[Number(match[1])]?.clientLineId
          : issue.clientLineId;
        return match && id
          ? {
              ...issue,
              clientLineId: id,
              field: `${match[2] === "productId" ? "product" : match[2]}:${id}`,
            }
          : issue;
      }) ?? []
    );
  }
  function request(id: string, kind: "save" | "post"): Promise<SaveOutcome> {
    const active = pending.get(id);
    const session = store.getState().sessions[id];
    if (active)
      return active.kind === kind
        ? active.task
        : Promise.resolve(blocked(undefined, "Đang thực hiện mutation khác."));
    if (!session || !ownsScope(session) || session.status !== "ready" || !session.draft)
      return Promise.resolve(blocked(session, "Phiên chưa sẵn sàng."));
    if (session.mutation === "outcome-unknown")
      return Promise.resolve({ kind: "outcome-unknown" });
    if (session.mutation !== "idle" || session.preparing)
      return Promise.resolve(blocked(session, "Phiên đang khóa."));
    if (kind === "save" && !canEdit(session))
      return Promise.resolve(
        blocked(session, "Không có quyền Write hoặc chứng từ chỉ đọc."),
      );
    if (
      kind === "post" &&
      (!session.receiptId ||
        !!session.postAcknowledgement ||
        !session.baseline ||
        session.baseline.status !== "Draft" ||
        session.capabilities?.post !== true)
    )
      return Promise.resolve(
        blocked(
          session,
          "Post cần Draft đã lưu, sạch và có quyền Post. Hãy lưu riêng trước khi Post.",
        ),
      );
    // Invalidate every earlier public read before crossing a mutation boundary.
    patch(session, {
      recoveryReadRevision: (session.recoveryReadRevision ?? 0) + 1,
      recovery: undefined,
    });
    const task = (async (): Promise<SaveOutcome> => {
      const prepared =
        kind === "save"
          ? await barrier.prepareSave(id, true)
          : await barrier.preparePost(id, true);
      if (prepared.kind === "blocked") {
        patch(session, {
          feedback: prepared.issues.map((i) => i.message).join(" "),
          issues: prepared.issues,
        });
        return prepared;
      }
      const current = store.getState().sessions[id];
      if (
        !identityMatches(current, session) ||
        !ownsScope(session) ||
        current.editRevision !== prepared.editRevision ||
        current.receiptId !== session.receiptId || current.baseline !== session.baseline ||
        (kind === "save" ? current.capabilities?.write !== true : current.capabilities?.post !== true)
      ) {
        // No write has been dispatched. Release only our old preparation;
        // identity matching keeps a replacement session untouched.
        patch(session, { preparing: false });
        return blocked(undefined, "Phiên đã thay đổi.");
      }
      const snapshot = prepared.snapshot;
      snapshot.lines.forEach(Object.freeze);
      Object.freeze(snapshot.lines);
      Object.freeze(snapshot);
      patch(session, {
        preparing: false,
        mutation: "pending",
        mutationKind: kind,
        mutationSnapshot: snapshot,
        feedback: undefined,
        issues: [],
        recovery: undefined,
      });
      let result: WriteResult<GoodsReceiptDocument> | WriteResult<GoodsReceiptPostAcknowledgement>;
      try {
        result =
          kind === "save"
            ? await port.save(snapshot, context(session))
            : await port.post(
                {
                  receiptId: session.receiptId!,
                  expectedVersion: session.baseline!.version,
                },
                context(session),
              );
      } catch {
        result = { kind: "outcome-unknown" as const };
      }
      const live = store.getState().sessions[id];
      if (!identityMatches(live, session)) return { kind: "outcome-unknown" };
      if (result.kind === "failed" && result.dispatched === false) {
        const issues = mappedIssues(result.error.issues, snapshot);
        patch(session, { preparing: false, mutation: "idle", mutationKind: undefined, mutationSnapshot: undefined, feedback: result.error.message, issues });
        return { kind: "failed", error: { ...result.error, issues } };
      }
      if (!ownsScope(session)) {
        patch(session, { mutation: "outcome-unknown", feedback: "Phiên đăng nhập đã đổi; giữ snapshot để đối soát riêng." });
        return { kind: "outcome-unknown" };
      }
      if (result.kind === "success") {
        if (kind === "post") {
          const acknowledgement = result.value as GoodsReceiptPostAcknowledgement;
          if (!acknowledgement || Object.keys(acknowledgement).length !== 3 || acknowledgement.receiptId !== session.receiptId || acknowledgement.status !== "Posted" || typeof acknowledgement.postedAtUtc !== "string" || !acknowledgement.postedAtUtc) {
            patch(session, { mutation: "outcome-unknown", feedback: "Phản hồi Post không phù hợp; cần đối soát." });
            return { kind: "outcome-unknown" };
          }
          patch(session, { postAcknowledgement: acknowledgement, mutation: "idle", mutationKind: undefined, mutationSnapshot: undefined, feedback: "Đã Post · chỉ đọc. Chi tiết/chi phí chưa có.", issues: [] });
          void loadPostedDetail(store.getState().sessions[id]);
          return { kind: "posted", acknowledgement };
        }
        const document = result.value as GoodsReceiptDocument;
        if (
          live.editRevision !== prepared.editRevision ||
          !validSaveResult(document, snapshot) ||
          !accept(live, document, snapshot)
        ) {
          patch(session, {
            mutation: "outcome-unknown",
            feedback: "Không thể áp kết quả vào phiên hiện tại; cần đối soát.",
          });
          return { kind: "outcome-unknown" };
        }
        return { kind: "saved", document };
      }
      if (result.kind === "failed") {
        const issues = mappedIssues(result.error.issues, snapshot);
        patch(session, {
          mutation: "idle",
          mutationSnapshot: undefined,
          mutationKind: undefined,
          feedback: result.error.message,
          issues,
        });
        return { kind: "failed", error: { ...result.error, issues } };
      }
      patch(session, {
        mutation: "outcome-unknown",
        feedback: "Kết quả chưa rõ; giữ snapshot và khóa phiên để đối soát.",
      });
      return { kind: "outcome-unknown" };
    })();
    pending.set(id, { kind, task });
    void task.then(() => {
      if (pending.get(id)?.task === task) pending.delete(id);
    });
    return task;
  }
  return {
    requestSave: (id: string) => request(id, "save"),
    requestPost: (id: string) => request(id, "post"),
    ...recoveryCommands,
  };
}
