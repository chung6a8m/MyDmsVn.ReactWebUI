import type {
  ActorScope,
  DocumentModule,
} from "../../app/workspace/documentContracts";
import type { StockBalancesQuery, StockCardQuery } from "./contracts";
import {
  internalCatalogId,
  utcOrder,
  web3Utc,
} from "../../infrastructure/http/web3WireSchemas";
export const inventoryKeys = {
  balances: (scope: ActorScope, query: StockBalancesQuery) =>
    [
      "inventory",
      scope.actorKey,
      scope.actorGeneration,
      "balances",
      query,
    ] as const,
  stockCard: (scope: ActorScope, query: StockCardQuery) =>
    [
      "inventory",
      scope.actorKey,
      scope.actorGeneration,
      "stock-card",
      query,
    ] as const,
};
export function stockCardIssue(query: {
  warehouseId: string;
  productId: string;
  fromUtc?: string;
  toUtc?: string;
}): string | undefined {
  if (
    !internalCatalogId.safeParse(query.warehouseId).success ||
    !internalCatalogId.safeParse(query.productId).success
  )
    return "Chọn kho và sản phẩm để xem thẻ kho.";
  if (
    (query.fromUtc && !web3Utc.safeParse(query.fromUtc).success) ||
    (query.toUtc && !web3Utc.safeParse(query.toUtc).success)
  )
    return "Thời gian UTC phải có dạng yyyy-MM-ddTHH:mm:ss[.fffffff]Z.";
  if (
    query.fromUtc &&
    query.toUtc &&
    utcOrder(query.fromUtc) > utcOrder(query.toUtc)
  )
    return "Thời gian bắt đầu phải trước hoặc bằng thời gian kết thúc.";
}
export function sourceModule(type: string): DocumentModule | undefined {
  return type === "GoodsReceipt"
    ? "goods-receipt"
    : type === "SalesReceipt"
      ? "sales"
      : undefined;
}
export function balanceRowId(row: { warehouseId: string; productId: string }) {
  return `${row.warehouseId}:${row.productId}`;
}
