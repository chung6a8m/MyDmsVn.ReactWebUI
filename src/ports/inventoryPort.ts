import type { InventoryPage, StockBalanceRow, StockBalancesQuery, StockCardQuery, StockCardRow } from "../features/inventory/contracts";
import type { PortContext, ReadResult } from "./portContracts";
export interface InventoryPort {
  balances(query: StockBalancesQuery, context: PortContext): Promise<ReadResult<InventoryPage<StockBalanceRow>>>;
  stockCard(query: StockCardQuery, context: PortContext): Promise<ReadResult<InventoryPage<StockCardRow>>>;
}
