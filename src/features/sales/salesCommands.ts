import { createEditorBarrier } from "../../shared/grid/editorBarrier";
import type { SalesDocument, SaveOutcome } from "./contracts";
import {
  identityMatches,
  type SalesSessionStore,
  type SessionIdentity,
} from "./salesSessionStore";
import type { SalesPort } from "../../ports/salesPort";
import type {
  SalesSaveSnapshot,
  ValidationIssue,
  PortContext,
} from "./contracts";
import { canEdit, sessionDirty, type SalesSession } from "./salesSessionStore";

export function businessMatches(a: SalesSaveSnapshot, b: SalesSaveSnapshot) {
  const business = (s: SalesSaveSnapshot) => ({
    saleDate: s.saleDate,
    customerId: s.customerId,
    warehouseId: s.warehouseId,
    employeeId: s.employeeId,
    note: s.note,
    lines: s.lines.map(({ productId, qty, unitPrice, isGift }) => ({
      productId,
      qty,
      unitPrice,
      isGift,
    })),
  });
  return JSON.stringify(business(a)) === JSON.stringify(business(b));
}
export function reconcileDocument(
  document: SalesDocument,
  session: SalesSession,
  sent?: SalesSaveSnapshot,
) {
  const result = structuredClone(document);
  const lines = result.saved.lines.map((line, index) => ({
    ...line,
    clientLineId:
      sent?.lines[index]?.clientLineId ??
      session.draft?.lines.find(
        (l) => l.saleLineId && l.saleLineId === line.saleLineId,
      )?.clientLineId ??
      crypto.randomUUID(),
  }));
  result.saved = { ...result.saved, lines };
  result.lines = result.lines.map((line, i) => ({
    ...line,
    clientLineId: lines[i].clientLineId,
  }));
  return result;
}
export function createSalesPortCommands(
  store: SalesSessionStore,
  port: SalesPort,
  barrier = createEditorBarrier(store),
  bindRecord: (sessionId: string, saleId: string) => boolean = () => true,
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
  function patch(identity: SessionIdentity, change: Partial<SalesSession>) {
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
  function readSource(session: SalesSession) {
    const {
      sessionId, generation, actorKey, actorGeneration, saleId,
      baseline, mutation, mutationKind, mutationSnapshot,
    } = session;
    return {
      sessionId, generation, actorKey, actorGeneration, saleId,
      baseline, mutation, mutationKind, mutationSnapshot,
    };
  }
  function sourceMatches(
    live: SalesSession | undefined,
    source: NonNullable<SalesSession["recovery"]>["source"],
  ) {
    return (
      !!source && !!live && identityMatches(live, source) &&
      live.saleId === source.saleId &&
      live.baseline === source.baseline &&
      live.mutation === source.mutation &&
      live.mutationKind === source.mutationKind &&
      live.mutationSnapshot === source.mutationSnapshot
    );
  }
  function currentRead(
    live: SalesSession | undefined,
    source: SalesSession,
    revision: number,
  ) {
    return (
      sourceMatches(live, source) && live?.recoveryReadRevision === revision &&
      live.recovery?.revision === revision
    );
  }
  function recoveryEligible(
    session: SalesSession,
    doc: SalesDocument,
    saleId?: string,
  ) {
    return (
      !!session.mutationSnapshot && doc.saleId === saleId &&
      (session.mutationKind === "post"
        ? doc.status === "Posted"
        : businessMatches(session.mutationSnapshot, doc.saved) &&
          (!session.saleId || doc.version !== session.mutationSnapshot.expectedVersion))
    );
  }
  function accept(
    session: SalesSession,
    doc: SalesDocument,
    sent?: SalesSaveSnapshot,
  ) {
    if (!bindRecord(session.sessionId, doc.saleId)) return false;
    const document = reconcileDocument(doc, session, sent);
    patch(session, {
      saleId: document.saleId,
      baseline: document,
      draft: structuredClone(document.saved),
      rawBuffers: {},
      lookupBuffers: {},
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
          ? "Đã Post · chỉ đọc. Chi phí/lợi nhuận là dữ liệu demo."
          : "Đã lưu mô phỏng vào dataset.",
    });
    return true;
  }
  function mappedIssues(
    issues: readonly ValidationIssue[] | undefined,
    snapshot: SalesSaveSnapshot,
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
    if (!session || session.status !== "ready" || !session.draft)
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
      (!session.saleId ||
        !session.baseline ||
        session.baseline.status !== "Draft" ||
        sessionDirty(session) ||
        session.dirty ||
        session.capabilities?.post === false)
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
    // Post has no editor barrier because only a clean, persisted baseline is legal.
    if (kind === "post")
      patch(session, {
        mutation: "pending",
        mutationKind: kind,
        mutationSnapshot: session.baseline!.saved,
        feedback: undefined,
        issues: [],
        recovery: undefined,
      });
    const task = (async (): Promise<SaveOutcome> => {
      const prepared =
        kind === "save"
          ? await barrier.prepareSave(id, true)
          : {
              kind: "ready" as const,
              snapshot: structuredClone(session.baseline!.saved),
              editRevision: session.editRevision,
            };
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
        current.editRevision !== prepared.editRevision
      )
        return blocked(undefined, "Phiên đã thay đổi.");
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
      let result;
      try {
        result =
          kind === "save"
            ? await port.save(snapshot, context(session))
            : await port.post(
                {
                  saleId: session.saleId!,
                  expectedVersion: session.baseline!.version,
                },
                context(session),
              );
      } catch {
        result = { kind: "outcome-unknown" as const };
      }
      const live = store.getState().sessions[id];
      if (!identityMatches(live, session)) return { kind: "outcome-unknown" };
      if (result.kind === "success") {
        if (
          live.editRevision !== prepared.editRevision ||
          !accept(live, result.value, snapshot)
        ) {
          patch(session, {
            mutation: "outcome-unknown",
            feedback: "Không thể áp kết quả vào phiên hiện tại; cần đối soát.",
          });
          return { kind: "outcome-unknown" };
        }
        return { kind: "saved", document: result.value };
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
    async inspectRecovery(id: string, candidateId?: string) {
      const session = store.getState().sessions[id];
      if (
        !session ||
        session.mutation !== "outcome-unknown" ||
        !session.mutationSnapshot
      )
        return;
      const saleId = session.saleId ?? candidateId;
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
      if (!saleId || !/^[1-9]\d*$/.test(saleId)) {
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
        const read = await port.get(saleId, context(session));
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
        const eligible = recoveryEligible(session, doc, saleId);
        patch(session, {
          recovery: {
            document: doc,
            source: readSource(session),
            readSaleId: saleId,
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
      if (!session?.saleId || session.mutation !== "idle" || session.preparing)
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
        const read = await port.get(session.saleId, context(session));
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
            eligible: read.kind === "success",
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
        session.saleId !== session.recovery.document.saleId
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
        !recoveryEligible(s, s.recovery.document, s.recovery.readSaleId)
      )
        return false;
      // Post evidence requires only Posted status; Get may carry a different
      // line order/set. Preserve IDs by saleLineId instead of snapshot position.
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
