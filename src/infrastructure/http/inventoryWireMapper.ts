import type { InventoryPage, StockBalanceRow, StockCardRow } from "../../features/inventory/contracts";
import type { z } from "./cspZod";
import type { balancesPageSchema, stockCardPageSchema } from "./inventoryWireSchemas";
export function mapStockBalances(value: z.infer<typeof balancesPageSchema>): InventoryPage<StockBalanceRow> {
  return { ...value, items: value.items.map(row => ({ ...row, warehouseId: String(row.warehouseId), productId: String(row.productId) })) };
}
export function mapStockCard(value: z.infer<typeof stockCardPageSchema>): InventoryPage<StockCardRow> {
  return { ...value, items: value.items.map(row => ({ ...row, warehouseId: String(row.warehouseId), productId: String(row.productId) })) };
}
