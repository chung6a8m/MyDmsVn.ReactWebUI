import { createStore } from "zustand/vanilla";
import type { GridState } from "ag-grid-community";
import type {
  GoodsReceiptPostAcknowledgement,
  GoodsReceiptDocument,
  GoodsReceiptSaveSnapshot,
} from "./contracts";

import type { UiFailure, ValidationIssue } from "../../ports/portContracts";
import type { LookupValue } from "../../shared/lookup/lookupTypes";

export interface SessionIdentity {
  deploymentEpoch?: string;
  sessionId: string;
  generation: number;
  actorKey: string;
  actorGeneration: number;
}
export interface GoodsReceiptSession extends SessionIdentity {
  receiptId: string | null;
  requestGeneration: number;
  draft: GoodsReceiptSaveSnapshot | null;
  baseline: GoodsReceiptDocument | null;
  postAcknowledgement?: GoodsReceiptPostAcknowledgement;
  initialDraft?: GoodsReceiptSaveSnapshot;
  rawBuffers: Record<string, { raw: string; composing: boolean }>;
  lookupBuffers?: Record<string, LookupValue>;
  editRevision: number;
  dirty: boolean;
  status: "loading" | "ready" | "failed";
  error?: UiFailure;
  mutation: "idle" | "pending" | "outcome-unknown";
  localRecovery?: { operationId: string | null };
  writeReviewRequired?: boolean;
  preparing?: boolean;
  mutationSnapshot?: GoodsReceiptSaveSnapshot;
  mutationKind?: "save" | "post";
  capabilities?: { read: boolean; write: boolean; post: boolean };
  feedback?: string;
  issues?: readonly ValidationIssue[];
  // Never reset when a preview is cleared or a mutation is accepted.
  recoveryReadRevision?: number;
  recovery?: {
    document?: GoodsReceiptDocument;
    eligible: boolean;
    message: string;
    loading: boolean;
    revision: number;
    editRevision?: number;
    source?: SessionIdentity &
      Pick<GoodsReceiptSession,
        "receiptId" | "baseline" | "postAcknowledgement" | "mutation" | "mutationKind" | "mutationSnapshot" | "editRevision"
      >;
    readReceiptId?: string;
  };
  commandCount: number;
  view: { grid?: GridState };
}
export function createGoodsReceiptSessionStore() {
  return createStore<{
    sessions: Record<string, GoodsReceiptSession>;
    activeSessionId: string | null;
  }>(() => ({ sessions: {}, activeSessionId: null }));
}
export type GoodsReceiptSessionStore = ReturnType<typeof createGoodsReceiptSessionStore>;

export function goodsReceiptPanelTitle(session: GoodsReceiptSession | undefined) {
  if (!session) return "Phiếu nhập";
  const dirty = session.dirty || sessionDirty(session);
  return `Phiếu nhập ${session.baseline?.receiptNumber ?? session.receiptId ?? "mới · bản nháp"}${dirty ? " *" : ""}`;
}

export function identityMatches(
  session: GoodsReceiptSession | undefined,
  identity: SessionIdentity,
) {
  return (
    !!session &&
    session.sessionId === identity.sessionId &&
    session.generation === identity.generation &&
    session.deploymentEpoch === identity.deploymentEpoch &&
    session.actorKey === identity.actorKey &&
    session.actorGeneration === identity.actorGeneration
  );
}

export function canEdit(session: GoodsReceiptSession | undefined) {
  return (
    !!session &&
    session.status === "ready" &&
    session.mutation === "idle" &&
    !session.localRecovery && !session.writeReviewRequired &&
    !session.preparing &&
    session.capabilities?.write === true &&
    !session.postAcknowledgement &&
    session.baseline?.status !== "Posted"
  );
}
export function sessionDirty(session: GoodsReceiptSession) {
  const baseline = session.baseline?.saved ?? session.initialDraft;
  if (baseline && JSON.stringify(session.draft) !== JSON.stringify(baseline))
    return true;
  if (Object.entries(session.lookupBuffers ?? {}).some(([key, value]) => {
    const selected = key.startsWith("product:") ? session.draft?.lines.find(l => key === `product:${l.clientLineId}`)?.productId : session.draft?.[key as "warehouseId"];
    return value.composing || !value.confirmed || value.selectedId !== selected;
  })) return true;
  return Object.entries(session.rawBuffers).some(([key, buffer]) => {
    const lookup = session.lookupBuffers?.[key];
    if (lookup) {
      const selected = key.startsWith("product:")
        ? session.draft?.lines.find(
            (line) => key === `product:${line.clientLineId}`,
          )?.productId
        : session.draft?.[key as "warehouseId"];
      return (
        buffer.composing ||
        lookup.composing ||
        !lookup.confirmed ||
        lookup.selectedId !== selected
      );
    }
    let canonical: string | null | undefined;
    if (
      ["note", "receiptDate", "warehouseId", "employeeId"].includes(
        key,
      )
    )
      canonical = session.draft?.[key as "note"];
    else {
      const field = key.slice(0, key.indexOf(":"));
      const line = session.draft?.lines.find((l) => key === `${field}:${l.clientLineId}`);
      canonical =
        field === "quantity"
          ? line?.quantity
          : field === "unitCost"
            ? line?.unitCost
            : undefined;
    }
    return buffer.composing || buffer.raw !== canonical;
  });
}
