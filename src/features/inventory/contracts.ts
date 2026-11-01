// Read-only server projections. No editable inventory model or inferred balance.
export interface InventoryReferences {
  readonly warehouseId: string;
  readonly warehouseCode: string;
  readonly warehouseName: string;
  readonly warehouseIsActive: boolean;
  readonly productId: string;
  readonly productCode: string;
  readonly productName: string;
  readonly productIsActive: boolean;
}
export interface StockBalanceRow extends InventoryReferences {
  readonly quantity: string;
  readonly inventoryValue: string;
  readonly averageUnitCost: string | null;
}
export interface StockCardRow extends InventoryReferences {
  readonly ledgerId: string;
  readonly postedAtUtc: string;
  readonly documentType: string;
  readonly documentId: string;
  readonly documentNumber: string;
  readonly quantityChange: string;
  readonly valueChange: string;
}
export interface InventoryPage<T> {
  readonly items: readonly T[];
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly totalCount: string;
}
export interface StockBalancesQuery {
  pageNumber: number;
  pageSize: number;
  warehouseId?: string;
  productId?: string;
  search?: string;
}
export interface StockCardQuery {
  pageNumber: number;
  pageSize: number;
  warehouseId: string;
  productId: string;
  fromUtc?: string;
  toUtc?: string;
}
