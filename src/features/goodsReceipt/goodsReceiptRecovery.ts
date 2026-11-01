import type { GoodsReceiptDocument, GoodsReceiptSaveSnapshot } from "./contracts";
import { identityMatches, type GoodsReceiptSession, type GoodsReceiptSessionStore, type SessionIdentity } from "./goodsReceiptSessionStore";
import type { GoodsReceiptPort } from "../../ports/goodsReceiptPort";
import type { PortContext } from "../../ports/portContracts";
import { safeBusinessMatches, validReceiptDocument } from "./goodsReceiptReconciliation";

export function createGoodsReceiptRecovery(deps: {
  store: GoodsReceiptSessionStore;
  port: GoodsReceiptPort;
  ownsScope(identity: SessionIdentity): boolean;
  patch(identity: SessionIdentity, change: Partial<GoodsReceiptSession>): void;
  context(identity: SessionIdentity): PortContext;
  accept(session: GoodsReceiptSession, document: GoodsReceiptDocument, sent?: GoodsReceiptSaveSnapshot): boolean;
}) {
  const { store, port, ownsScope, patch, context, accept } = deps;
  function readSource(session: GoodsReceiptSession) {
    const {
      sessionId, generation, actorKey, actorGeneration, deploymentEpoch, receiptId, editRevision,
      baseline, postAcknowledgement, mutation, mutationKind, mutationSnapshot,
    } = session;
    return {
      sessionId, generation, actorKey, actorGeneration, deploymentEpoch, receiptId, editRevision,
      baseline, postAcknowledgement, mutation, mutationKind, mutationSnapshot,
    };
  }
  function sourceMatches(
    live: GoodsReceiptSession | undefined,
    source: NonNullable<GoodsReceiptSession["recovery"]>["source"],
  ) {
    return (
      !!source && !!live && identityMatches(live, source) &&
      ownsScope(source) &&
      live.receiptId === source.receiptId &&
      live.baseline === source.baseline &&
      live.postAcknowledgement === source.postAcknowledgement &&
      live.mutation === source.mutation &&
      live.mutationKind === source.mutationKind &&
      live.mutationSnapshot === source.mutationSnapshot
    );
  }
  function currentRead(
    live: GoodsReceiptSession | undefined,
    source: GoodsReceiptSession,
    revision: number,
  ) {
    return (
      sourceMatches(live, source) && live?.recoveryReadRevision === revision &&
      live.recovery?.revision === revision
    );
  }
  function recoveryEligible(
    session: GoodsReceiptSession,
    doc: GoodsReceiptDocument,
    receiptId?: string,
  ) {
    return (
      !!session.mutationSnapshot && validReceiptDocument(doc) && doc.receiptId === receiptId &&
      (session.mutationKind === "post"
        ? doc.status === "Posted"
        : safeBusinessMatches(session.mutationSnapshot, doc.saved) &&
          (!session.receiptId || doc.version !== session.mutationSnapshot.expectedVersion))
    );
  }
  async function loadPostedDetail(session: GoodsReceiptSession) {
    const revision = (session.recoveryReadRevision ?? 0) + 1;
    patch(session, { recoveryReadRevision: revision, recovery: { eligible: false, loading: true, revision, message: "Đang đọc chi tiết đã Post…" } });
    try {
      const read = await port.get(session.receiptId!, context(session));
      const live = store.getState().sessions[session.sessionId];
      if (!currentRead(live, session, revision)) return;
      if (read.kind === "success" && read.value.receiptId === session.receiptId && read.value.status === "Posted" && accept(live!, read.value)) return;
      patch(session, { recovery: undefined, feedback: `Đã Post · chỉ đọc. Chi tiết chưa có: ${read.kind === "failed" ? read.error.message : "Bản đọc chưa xác nhận Posted."}` });
    } catch {
      if (currentRead(store.getState().sessions[session.sessionId], session, revision))
        patch(session, { recovery: undefined, feedback: "Đã Post · chỉ đọc. Không đọc được chi tiết; có thể đọc lại để review." });
    }
  }
  return {
    loadPostedDetail,
    async inspectRecovery(id: string, candidateId?: string) {
      const session = store.getState().sessions[id];
      if (
        !session ||
        !ownsScope(session) ||
        session.mutation !== "outcome-unknown" ||
        !session.mutationSnapshot
      )
        return;
      const receiptId = session.receiptId ?? candidateId;
      const revision = (session.recoveryReadRevision ?? 0) + 1;
      patch(session, {
        recoveryReadRevision: revision,
        recovery: {
          eligible: false,
          loading: true,
          message: "Đang đọc qua public Get…",
          revision,
        },
      });
      if (!receiptId || !/^[1-9]\d*$/.test(receiptId)) {
        patch(session, {
          recovery: {
            eligible: false,
            loading: false,
            message:
              "Chọn ID ứng viên từ danh sách rồi đọc và đối chiếu; không tự tạo lại.",
            revision,
          },
        });
        return;
      }
      try {
        const read = await port.get(receiptId, context(session));
        const live = store.getState().sessions[id];
        if (!currentRead(live, session, revision)) return;
        if (read.kind === "failed") {
          patch(session, {
            recovery: {
              eligible: false,
              loading: false,
              message: read.error.message,
              revision,
            },
          });
          return;
        }
        const doc = read.value;
        const eligible = recoveryEligible(session, doc, receiptId);
        patch(session, {
          recovery: {
            document: doc,
            source: readSource(session),
            readReceiptId: receiptId,
            eligible,
            loading: false,
            revision,
            message: eligible
              ? "Có bằng chứng phù hợp. Đối chiếu snapshot và xác nhận dùng bản authoritative; không xác định tác nhân đã commit."
              : "Chưa đủ bằng chứng dương tính. Giữ khóa; không retry mutation.",
          },
        });
      } catch {
        const live = store.getState().sessions[id];
        if (currentRead(live, session, revision))
          patch(session, {
            recovery: {
              eligible: false,
              loading: false,
              message: "Đọc thất bại; tiếp tục giữ khóa.",
              revision,
            },
          });
      }
    },
    async inspectReload(id: string) {
      const session = store.getState().sessions[id];
      if (!session?.receiptId || !ownsScope(session) || session.mutation !== "idle" || session.preparing)
        return;
      const revision = (session.recoveryReadRevision ?? 0) + 1;
      patch(session, {
        recoveryReadRevision: revision,
        recovery: {
          eligible: false,
          loading: true,
          message: "Đang đọc để review…",
          revision,
          editRevision: session.editRevision,
        },
      });
      try {
        const read = await port.get(session.receiptId, context(session));
        const live = store.getState().sessions[id];
        if (!currentRead(live, session, revision)) return;
        if (live.editRevision !== session.editRevision) {
          patch(session, {
            recovery: {
              eligible: false,
              loading: false,
              revision,
              message: "Bản sửa đã đổi trong lúc đọc. Đọc lại để review.",
            },
          });
          return;
        }
        patch(session, {
          recovery: {
            eligible: read.kind === "success" && validReceiptDocument(read.value) && read.value.receiptId === session.receiptId && (!(session.postAcknowledgement || session.baseline?.status === "Posted") || read.value.status === "Posted"),
            document: read.kind === "success" ? read.value : undefined,
            source: readSource(session),
            loading: false,
            revision,
            editRevision: session.editRevision,
            message:
              read.kind === "success"
                ? "Review bản đọc trước khi xác nhận bỏ bản sửa hiện tại."
                : read.error.message,
          },
        });
      } catch {
        const live = store.getState().sessions[id];
        if (currentRead(live, session, revision))
          patch(session, {
            recovery: {
              eligible: false,
              loading: false,
              revision,
              message: "Đọc thất bại; giữ bản sửa hiện tại.",
            },
          });
      }
    },
    confirmReload(id: string) {
      const session = store.getState().sessions[id];
      if (
        !session ||
        session.mutation !== "idle" ||
        session.preparing ||
        !session.recovery?.eligible ||
        session.recovery.loading ||
        session.recovery.editRevision !== session.editRevision ||
        !session.recovery.document ||
        session.recovery.revision !== session.recoveryReadRevision ||
        !sourceMatches(session, session.recovery.source) ||
        session.receiptId !== session.recovery.document.receiptId
      )
        return false;
      return accept(session, session.recovery.document);
    },
    confirmRecovery(id: string) {
      const s = store.getState().sessions[id];
      if (
        !s ||
        s.mutation !== "outcome-unknown" ||
        s.preparing ||
        !s.recovery?.eligible ||
        s.recovery.loading ||
        !s.recovery.document ||
        !s.mutationSnapshot ||
        s.recovery.revision !== s.recoveryReadRevision ||
        !sourceMatches(s, s.recovery.source) ||
        s.recovery.source?.editRevision !== s.editRevision ||
        !recoveryEligible(s, s.recovery.document, s.recovery.readReceiptId)
      )
        return false;
      // Post evidence requires only Posted status; Get may carry a different
      // line order/set. Preserve IDs by receiptLineId instead of snapshot position.
      const accepted = accept(
        s,
        s.recovery.document,
        s.mutationKind === "post" ? undefined : s.mutationSnapshot,
      );
      if (!accepted)
        patch(s, {
          feedback:
            "Chứng từ đã mở trong phiên khác. Đóng phiên đó qua admission trước khi liên kết.",
        });
      return accepted;
    },
  };
}
