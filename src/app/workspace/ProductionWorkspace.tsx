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
const components = { sales: SalesDocumentPanel, "goods-receipt-document": GoodsReceiptDocumentPanel, "goods-receipt-list": GoodsReceiptListPanel,
  "goods-receipt": GoodsReceiptDocumentPanel, "goods-receipt-records": GoodsReceiptListPanel };
function ReceiptActions() {
  const workspace = useWorkspace(), auth = useSyncExternalStore(workspace.auth.subscribe, workspace.auth.getSnapshot);
  const busy = useStore(workspace.layouts.state, s => s.busy), closing = useStore(workspace.close.state, s => s.busy);
  return <>
    <Button variant="outline" disabled={busy || closing || !hasModuleCapability(auth, workspace.portContext(), "goods-receipt", "read")} onClick={() => void workspace.openPanel("goods-receipt")}>Danh sách phiếu nhập</Button>
    <Button variant="outline" disabled={busy || closing || !hasModuleCapability(auth, workspace.portContext(), "goods-receipt", "write")} onClick={() => void workspace.openDocument("goods-receipt", null)}>Phiếu nhập mới</Button>
  </>;
}
export function ProductionWorkspace() {
  return <WorkspaceHost documentComponents={components} catalogComponent={SalesListPanel} catalogTitle="Danh sách Sales" newDocumentModule="sales" toolbar={<ReceiptActions />} />;
}
