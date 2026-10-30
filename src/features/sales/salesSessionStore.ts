import { createStore } from "zustand/vanilla";
import type { GridState } from "ag-grid-community";
import type {
  DocumentSessionId,
  SalesDocument,
  SalesSaveSnapshot,
  ServerId,
  UiFailure,
} from "./contracts";

import type { LookupValue } from "../../shared/lookup/lookupTypes";

export interface SessionIdentity {
  sessionId: DocumentSessionId;
  generation: number;
  actorKey: string;
  actorGeneration: number;
}
export interface SalesSession extends SessionIdentity {
  saleId: ServerId | null;
  requestGeneration: number;
  draft: SalesSaveSnapshot | null;
  baseline: SalesDocument | null;
  initialDraft?: SalesSaveSnapshot;
  rawBuffers: Record<string, { raw: string; composing: boolean }>;
  lookupBuffers?: Record<string, LookupValue>;
  editRevision: number;
  dirty: boolean;
  status: "loading" | "ready" | "failed";
  error?: UiFailure;
  mutation: "idle" | "pending" | "outcome-unknown";
  preparing?: boolean;
  mutationSnapshot?: SalesSaveSnapshot;
  commandCount: number;
  view: { grid?: GridState };
}
export function createSalesSessionStore() {
  return createStore<{
    sessions: Record<DocumentSessionId, SalesSession>;
    activeSessionId: DocumentSessionId | null;
  }>(() => ({ sessions: {}, activeSessionId: null }));
}
export type SalesSessionStore = ReturnType<typeof createSalesSessionStore>;

export function identityMatches(
  session: SalesSession | undefined,
  identity: SessionIdentity,
) {
  return (
    !!session &&
    session.sessionId === identity.sessionId &&
    session.generation === identity.generation &&
    session.actorKey === identity.actorKey &&
    session.actorGeneration === identity.actorGeneration
  );
}

export function canEdit(session: SalesSession | undefined) {
  return (
    !!session &&
    session.status === "ready" &&
    session.mutation === "idle" &&
    !session.preparing &&
    session.baseline?.status !== "Posted"
  );
}
export function sessionDirty(session: SalesSession) {
  const baseline = session.baseline?.saved ?? session.initialDraft;
  if (baseline && JSON.stringify(session.draft) !== JSON.stringify(baseline))
    return true;
  return Object.entries(session.rawBuffers).some(([key, buffer]) => {
    const lookup = session.lookupBuffers?.[key];
    if (lookup) {
      const selected = key.startsWith("product:")
        ? session.draft?.lines.find((line) => key === `product:${line.clientLineId}`)?.productId
        : session.draft?.[key as "customerId"];
      return buffer.composing || lookup.composing || !lookup.confirmed || lookup.selectedId !== selected;
    }
    let canonical: string | undefined;
    if (
      ["note", "saleDate", "customerId", "warehouseId", "employeeId"].includes(
        key,
      )
    )
      canonical = session.draft?.[key as "note"];
    else {
      const [field, id] = key.split(":");
      const line = session.draft?.lines.find((l) => l.clientLineId === id);
      canonical =
        field === "qty"
          ? line?.qty
          : field === "unitPrice"
            ? line?.unitPrice
            : undefined;
    }
    return buffer.composing || buffer.raw !== canonical;
  });
}
