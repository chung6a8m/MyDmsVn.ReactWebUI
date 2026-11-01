import type { GoodsReceiptDocument, GoodsReceiptPage, GoodsReceiptSaveSnapshot } from "../../features/goodsReceipt/contracts";
import type { UiFailure } from "../../ports/portContracts";
import { ProtocolError } from "./authApi";
import { receiptCreateSchema, receiptPageSchema, type ReceiptWireDetail } from "./goodsReceiptWireSchemas";
import { internalCatalogId } from "./web3WireSchemas";
import type { z } from "./cspZod";

export function mapGoodsReceiptDetail(value: ReceiptWireDetail): GoodsReceiptDocument {
  const reference = (id: number, displayName: string | null, isActive: boolean) => ({ id: String(id), displayName, isActive });
  const lines = value.lines.map(line => ({
    clientLineId: `server:${line.receiptLineId}`, receiptLineId: line.receiptLineId,
    lineNumber: line.lineNumber, productId: String(line.productId), quantity: line.quantity, unitCost: line.unitCost,
    product: reference(line.productId, line.productDisplayName, line.productIsActive),
  }));
  return {
    receiptId: value.receiptId, receiptNumber: value.receiptNumber, version: value.version, status: value.status, postedAtUtc: value.postedAtUtc,
    saved: {
      receiptId: value.receiptId, expectedVersion: value.version, receiptDate: value.receiptDate,
      warehouseId: String(value.warehouseId), employeeId: String(value.employeeId), note: value.note,
      lines: lines.map(({ clientLineId, receiptLineId, productId, quantity, unitCost }) => ({ clientLineId, receiptLineId, productId, quantity, unitCost })),
    },
    references: { warehouse: reference(value.warehouseId, value.warehouseDisplayName, value.warehouseIsActive), employee: reference(value.employeeId, value.employeeDisplayName, value.employeeIsActive) }, lines,
  };
}
export function mapGoodsReceiptPage(value: z.infer<typeof receiptPageSchema>): GoodsReceiptPage {
  return { ...value, items: value.items.map(mapGoodsReceiptDetail) };
}
export function mapGoodsReceiptSaveInput(snapshot: GoodsReceiptSaveSnapshot) {
  return receiptCreateSchema.parse({
    receiptDate: snapshot.receiptDate, warehouseId: internalCatalogId.parse(snapshot.warehouseId), employeeId: internalCatalogId.parse(snapshot.employeeId), note: snapshot.note,
    lines: snapshot.lines.map(line => ({ productId: internalCatalogId.parse(line.productId), quantity: line.quantity, unitCost: line.unitCost })),
  });
}
export function mapSavedGoodsReceiptDetail(value: ReceiptWireDetail, snapshot: GoodsReceiptSaveSnapshot): GoodsReceiptDocument {
  if ((snapshot.receiptId !== null && value.receiptId !== snapshot.receiptId) || value.status !== "Draft" || value.lines.length !== snapshot.lines.length || value.lines.some((line, index) => line.lineNumber !== index + 1 || String(line.productId) !== snapshot.lines[index].productId)) throw new ProtocolError();
  const document = mapGoodsReceiptDetail(value);
  document.saved.lines = document.saved.lines.map((line, index) => ({ ...line, clientLineId: snapshot.lines[index].clientLineId }));
  document.lines = document.lines.map((line, index) => ({ ...line, clientLineId: snapshot.lines[index].clientLineId }));
  return document;
}
export function mapGoodsReceiptWriteIssues(error: UiFailure, snapshot: GoodsReceiptSaveSnapshot): UiFailure {
  return { ...error, issues: error.issues?.map(issue => {
    const match = /^lines\[(\d+)\](?:\.(\w+))?$/.exec(issue.field);
    const clientLineId = match && snapshot.lines[Number(match[1])]?.clientLineId;
    if (!clientLineId) return issue;
    return { ...issue, clientLineId, field: match![2] ? `${match![2] === "productId" ? "product" : match![2]}:${clientLineId}` : "" };
  }) };
}
