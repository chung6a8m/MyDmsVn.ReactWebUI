import { useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { Button } from "../../components/ui/button";
import { SalesDocumentPanel } from "../../features/sales/SalesDocumentPanel";
import { SalesListPanel } from "../../features/sales/SalesListPanel";
import { GoodsReceiptDocumentPanel } from "../../features/goodsReceipt/GoodsReceiptDocumentPanel";
import { GoodsReceiptListPanel } from "../../features/goodsReceipt/GoodsReceiptListPanel";
import { hasModuleCapability } from "../runtime/moduleCapabilities";
import { useWorkspace } from "./WorkspaceContext";
import { WorkspaceHost } from "./WorkspaceHost";
import { StockBalancesPanel } from "../../features/inventory/StockBalancesPanel";
import { StockCardPanel } from "../../features/inventory/StockCardPanel";
import { LocalDraftControls } from "./LocalDraftControls";
import type { ProductionDrafts } from "../runtime/productionDrafts";
import type { Web4MutationRuntime } from "../runtime/web4MutationRuntime";
const components = { "inventory-balances": StockBalancesPanel, "inventory-stock-card": StockCardPanel, sales: SalesDocumentPanel, "goods-receipt-document": GoodsReceiptDocumentPanel, "goods-receipt-list": GoodsReceiptListPanel,
  "goods-receipt": GoodsReceiptDocumentPanel, "goods-receipt-records": GoodsReceiptListPanel };
function ReceiptActions() {
  const workspace = useWorkspace(), auth = useSyncExternalStore(workspace.auth.subscribe, workspace.auth.getSnapshot);
  const busy = useStore(workspace.layouts.state, s => s.busy), closing = useStore(workspace.close.state, s => s.busy);
  return <>
    <Button variant="outline" disabled={busy || closing || !hasModuleCapability(auth, workspace.portContext(), "inventory-balances", "read")} onClick={() => void workspace.openPanel("inventory-balances")}>Tồn kho</Button>
    <Button variant="outline" disabled={busy || closing || !hasModuleCapability(auth, workspace.portContext(), "inventory-stock-card", "read")} onClick={() => void workspace.openPanel("inventory-stock-card")}>Thẻ kho</Button>
    <Button variant="outline" disabled={busy || closing || !hasModuleCapability(auth, workspace.portContext(), "goods-receipt", "read")} onClick={() => void workspace.openPanel("goods-receipt")}>Danh sách phiếu nhập</Button>
    <Button variant="outline" disabled={busy || closing || !hasModuleCapability(auth, workspace.portContext(), "goods-receipt", "write")} onClick={() => void workspace.openDocument("goods-receipt", null)}>Phiếu nhập mới</Button>
  </>;
}
export function ProductionWorkspace({ drafts, operations }: { drafts: ProductionDrafts; operations: Web4MutationRuntime }) {
  return <WorkspaceHost durableDrafts documentComponents={components} catalogComponent={SalesListPanel} catalogTitle="Danh sách Sales" newDocumentModule="sales" toolbar={<><ReceiptActions /><LocalDraftControls drafts={drafts} operations={operations} /></>} />;
}
