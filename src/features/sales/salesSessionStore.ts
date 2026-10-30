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
  rawBuffers: Record<string, { raw: string; composing: boolean }>;
  lookupBuffers?: Record<string, LookupValue>;
  editRevision: number;
  dirty: boolean;
  status: "loading" | "ready" | "failed";
  error?: UiFailure;
  mutation: "idle" | "pending" | "outcome-unknown";
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
