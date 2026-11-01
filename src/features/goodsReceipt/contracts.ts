// Internal feature models; catalog IDs remain strings until the HTTP boundary.
export interface GoodsReceiptLineDraft {
  clientLineId: string;
  receiptLineId: string | null;
  productId: string | null;
  quantity: string;
  unitCost: string;
}
export interface GoodsReceiptSaveSnapshot {
  receiptId: string | null;
  expectedVersion: string | null;
  receiptDate: string;
  warehouseId: string;
  employeeId: string;
  note: string | null;
  lines: readonly GoodsReceiptLineDraft[];
}
export interface GoodsReceiptReferenceSummary {
  id: string;
  displayName: string | null;
  isActive: boolean;
}
export interface GoodsReceiptDocument {
  receiptId: string;
  receiptNumber: string;
  version: string;
  status: "Draft" | "Posted";
  postedAtUtc: string | null;
  saved: GoodsReceiptSaveSnapshot;
  references: { warehouse: GoodsReceiptReferenceSummary; employee: GoodsReceiptReferenceSummary };
  lines: readonly (GoodsReceiptLineDraft & { lineNumber: number; product: GoodsReceiptReferenceSummary })[];
}
export interface GoodsReceiptPostAcknowledgement {
  receiptId: string;
  status: "Posted";
  postedAtUtc: string;
}
export interface GoodsReceiptListQuery {
  pageNumber: number;
  pageSize: number;
  warehouseId?: string;
  status?: "Draft" | "Posted";
  search?: string;
}
export interface GoodsReceiptPage {
  items: readonly GoodsReceiptDocument[];
  pageNumber: number;
  pageSize: number;
  totalCount: string;
}
