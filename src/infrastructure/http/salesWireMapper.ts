import type { SalesDocument, SalesPage } from "../../features/sales/contracts";
import { salesPageSchema, type SalesWireDetail } from "./salesWireSchemas";
import type { z } from "zod";
export function mapSalesDetail(value: SalesWireDetail): SalesDocument {
  const reference = (id: number, name: string | null | undefined, isActive: boolean) => ({ id: String(id), code: "", name: name || "Không có nhãn tham chiếu", isActive });
  const lines = value.lines.map(line => ({
    clientLineId: `server:${line.saleLineId}`, saleLineId: line.saleLineId, productId: String(line.productId), qty: line.qty, unitPrice: line.unitPrice, isGift: line.isGift,
    product: reference(line.productId, line.productDisplayName, line.productIsActive), unit: line.unit, lineAmount: line.lineAmount,
    postedUnitCost: line.postedUnitCost ?? null, costAmount: line.costAmount ?? null,
  }));
  return {
    saleId: value.saleId, saleNumber: value.saleNumber, version: value.version, status: value.status,
    postedAtUtc: value.postedAtUtc ?? null,
    saved: { saleId: value.saleId, expectedVersion: value.version, saleDate: value.saleDate, customerId: String(value.customerId), warehouseId: String(value.warehouseId), employeeId: String(value.employeeId), note: value.note ?? "", lines: lines.map(({ clientLineId, saleLineId, productId, qty, unitPrice, isGift }) => ({ clientLineId, saleLineId, productId, qty, unitPrice, isGift })) },
    references: { customer: reference(value.customerId, value.customerDisplayName, value.customerIsActive), warehouse: reference(value.warehouseId, value.warehouseDisplayName, value.warehouseIsActive), employee: reference(value.employeeId, value.employeeDisplayName, value.employeeIsActive) },
    lines, totalAmount: value.totalAmount, totalCost: value.totalCost ?? null, grossProfit: value.grossProfit ?? null,
  };
}
export function mapSalesPage(value: z.infer<typeof salesPageSchema>): SalesPage {
  return { items: value.items, nextCursor: value.nextCursor ?? null, previousCursor: value.previousCursor ?? null };
}
