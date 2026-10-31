// Internal frontend contracts; not an HTTP wire format.
export type ServerId = string;
export type Decimal4 = string;
export type Decimal8 = string;
export type CalendarDate = string;
export type VersionToken = string;

export type DocumentSessionId = string;
export type ClientLineId = string;
export type CloseReason =
  "tab" | "middle-click" | "command" | "close-all" | "layout-reset";

export interface ValidationIssue {
  code: string;
  field: string;
  message: string;
  clientLineId?: ClientLineId;
}

export type PrepareSaveResult =
  | { kind: "ready"; snapshot: SalesSaveSnapshot; editRevision: number }
  | { kind: "blocked"; issues: ValidationIssue[] };

export type SaveOutcome =
  | { kind: "saved"; document: SalesDocument }
  | { kind: "posted"; acknowledgement: PostAcknowledgement }
  | { kind: "blocked"; issues: ValidationIssue[] }
  | { kind: "failed"; error: UiFailure }
  | { kind: "outcome-unknown" };

export interface SalesLineDraft {
  clientLineId: ClientLineId;
  saleLineId: ServerId | null;
  productId: ServerId | null;
  qty: Decimal4;
  unitPrice: Decimal4;
  isGift: boolean;
}
export interface SalesSaveSnapshot {
  saleId: ServerId | null;
  expectedVersion: VersionToken | null;
  saleDate: CalendarDate;
  customerId: ServerId;
  warehouseId: ServerId;
  employeeId: ServerId;
  note: string;
  lines: readonly SalesLineDraft[];
}
export interface ReferenceSummary {
  id: ServerId;
  code: string;
  name: string;
  isActive: boolean | null; // null khi nguồn đọc không cung cấp trạng thái
}
export interface SalesDocument {
  postedAtUtc?: string | null;
  saleId: ServerId;
  saleNumber: string;
  version: VersionToken;
  status: "Draft" | "Posted";
  saved: SalesSaveSnapshot;
  references: {
    customer: ReferenceSummary;
    warehouse: ReferenceSummary;
    employee: ReferenceSummary;
  };
  lines: readonly (SalesLineDraft & {
    product: ReferenceSummary;
    unit: string;
    lineAmount: Decimal4;
    costAmount: Decimal4 | null;
    postedUnitCost?: Decimal8 | null;
  })[];
  totalAmount: Decimal4;
  totalCost: Decimal4 | null;
  grossProfit: Decimal4 | null;
}
export interface PostAcknowledgement {
  saleId: ServerId;
  status: "Posted";
  postedAtUtc: string;
  version: VersionToken;
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
  actorKey: string;
  actorGeneration: number;
  signal: AbortSignal;
}

export interface SalesListQuery {
  fromDate?: CalendarDate;
  toDate?: CalendarDate;
  customerId?: ServerId;
  warehouseId?: ServerId;
  employeeId?: ServerId;
  productId?: ServerId;
  status?: "Draft" | "Posted";
  search?: string;
  cursor?: string;
  pageSize: number;
}

export interface SalesPage {
  items: readonly {
    saleId: ServerId;
    saleNumber: string;
    saleDate: CalendarDate;
    status: "Draft" | "Posted";
    totalAmount: Decimal4;
  }[];
  nextCursor: string | null;
  previousCursor: string | null;
}

export type CatalogKind = "product" | "customer" | "warehouse" | "employee";
export interface CatalogQuery {
  kind: CatalogKind;
  search: string;
  limit: number;
}
export interface LookupOption {
  id: ServerId;
  code: string;
  name: string;
  isActive: boolean;
  unit?: string;
}
