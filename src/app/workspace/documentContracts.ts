export interface ActorScope {
  actorKey: string;
  actorGeneration: number;
}
export type DocumentModule = "sales" | "goods-receipt";
export type ModuleKey = DocumentModule | "inventory-balances" | "inventory-stock-card";
export type PanelRef = { actorScope: ActorScope } & (
  | { kind: "records"; module: DocumentModule }
  | { kind: "document"; module: DocumentModule; documentSessionId: string; serverId: string | null }
  | { kind: "read-only"; module: "inventory-balances" | "inventory-stock-card" }
);
export interface DocumentIdentity extends ActorScope {
  sessionId: string;
  module: DocumentModule;
  generation: number;
  editRevision: number;
}
export type CloseReason = "tab" | "middle-click" | "command" | "close-all" | "layout-reset";
export interface CloseIssue {
  code: string;
  field: string;
  message: string;
}
export type CloseSaveResult = "saved-clean" | "blocked" | "failed" | "unknown";
export interface DocumentCloseAdapter {
  captureIdentity(): DocumentIdentity;
  title(): string;
  isCloseBlocked(): boolean;
  isDirtyIncludingRaw(): boolean;
  prepareAndSave(identity: DocumentIdentity): Promise<CloseSaveResult>;
  mayFinalise(identity: DocumentIdentity): boolean;
  finaliseAfterAdmission(identity: DocumentIdentity): boolean;
  reportBlocked?(): void;
  closeFeedback?(): { message?: string; issues?: readonly CloseIssue[] };
}
export interface DocumentRegistry {
  documents(scope: ActorScope): readonly DocumentCloseAdapter[];
  getAdapter(sessionId: string): DocumentCloseAdapter | undefined;
}
export function sameActorScope(left: ActorScope, right: ActorScope): boolean {
  return left.actorKey === right.actorKey && left.actorGeneration === right.actorGeneration;
}
export function sameDocumentIdentity(left: DocumentIdentity, right: DocumentIdentity): boolean {
  return sameActorScope(left, right) && left.module === right.module &&
    left.sessionId === right.sessionId && left.generation === right.generation &&
    left.editRevision === right.editRevision;
}
