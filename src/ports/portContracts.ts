// Module-neutral async boundary contracts.
export interface ValidationIssue {
  code: string;
  field: string;
  message: string;
  clientLineId?: string;
}

export interface UiFailure {
  kind: "validation" | "unauthorized" | "protocol" | "forbidden" | "conflict" | "not-found" | "unavailable";
  correlationId?: string;
  code: string;
  message: string;
  issues?: readonly ValidationIssue[];
}
export type ReadResult<T> =
  { kind: "success"; value: T } | { kind: "failed"; error: UiFailure };
export type WriteResult<T> =
  | { kind: "success"; value: T }
  | { kind: "failed"; error: UiFailure; dispatched?: false }
  | { kind: "outcome-unknown" };
export interface PortContext {
  document?: { localDocumentId: string; generation: number; editRevision: number };
  deploymentEpoch?: string;
  actorKey: string;
  actorGeneration: number;
  signal: AbortSignal;
}
