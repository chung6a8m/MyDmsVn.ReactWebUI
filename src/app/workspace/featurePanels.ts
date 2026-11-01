import type { FunctionComponent } from "react";
import type { IDockviewPanelProps } from "dockview";
import type { ActorScope, DocumentCloseAdapter, DocumentIdentity, DocumentModule, ModuleKey } from "./documentContracts";
import type { DraftRecord } from "../../infrastructure/drafts/draftRecord";
export interface LocalDraftHooks {
  beforeClose(identity: DocumentIdentity, stillAdmitted: () => boolean): Promise<boolean>;
}
export interface WorkspacePanel extends ActorScope {
  id: string;
  module: ModuleKey;
  kind: "document" | "records" | "read-only";
  componentId: string;
  title: string;
  ready: boolean;
  serverId?: string | null;
  filters?: Readonly<Record<string, string | number>>;
}
export interface DocumentFeatureAdapter {
  module: DocumentModule;
  componentId: string;
  panel(id: string): WorkspacePanel | undefined;
  documents(scope: ActorScope): readonly DocumentCloseAdapter[];
  getAdapter(id: string): DocumentCloseAdapter | undefined;
  open(serverId: string | null, restoredId?: string): Promise<string>;
  restoreLocal?(record: DraftRecord): string;
  setLocalDraftHooks?(hooks: LocalDraftHooks | undefined): void;
  activate(id: string | null): void;
  mark(identity: DocumentIdentity): boolean;
  subscribe(listener: () => void): () => void;
}
export interface SimplePanelRegistration {
  module: ModuleKey;
  kind: "records" | "read-only";
  componentId: string;
  title: string;
}
export type PanelComponents = Record<string, FunctionComponent<IDockviewPanelProps>>;
