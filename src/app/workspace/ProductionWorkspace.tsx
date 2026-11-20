import { SalesDocumentPanel } from "../../features/sales/SalesDocumentPanel";
import { SalesListPanel } from "../../features/sales/SalesListPanel";
import { GoodsReceiptDocumentPanel } from "../../features/goodsReceipt/GoodsReceiptDocumentPanel";
import { GoodsReceiptListPanel } from "../../features/goodsReceipt/GoodsReceiptListPanel";
import { StockBalancesPanel } from "../../features/inventory/StockBalancesPanel";
import { StockCardPanel } from "../../features/inventory/StockCardPanel";
import { WorkspaceHost } from "./WorkspaceHost";
import { WorkspaceActions } from "./WorkspaceActions";
import { LocalDraftControls } from "./LocalDraftControls";
import type { ProductionDrafts } from "../runtime/productionDrafts";
import type { Web4MutationRuntime } from "../runtime/web4MutationRuntime";

const components = {
  "inventory-balances": StockBalancesPanel,
  "inventory-stock-card": StockCardPanel,
  sales: SalesDocumentPanel,
  "goods-receipt-document": GoodsReceiptDocumentPanel,
  "goods-receipt-list": GoodsReceiptListPanel,
  "goods-receipt": GoodsReceiptDocumentPanel,
  "goods-receipt-records": GoodsReceiptListPanel,
};

export function ProductionWorkspace({ drafts, operations }: { drafts: ProductionDrafts; operations: Web4MutationRuntime }) {
  return <WorkspaceHost durableDrafts documentComponents={components}
    catalogComponent={SalesListPanel} catalogTitle="Danh sách Sales"
    workspaceActions={<WorkspaceActions />}
    toolbar={<LocalDraftControls drafts={drafts} operations={operations} />} />;
}
