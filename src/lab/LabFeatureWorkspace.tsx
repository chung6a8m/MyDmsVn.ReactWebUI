import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "zustand";
import { WorkspaceHost } from "../app/workspace/WorkspaceHost";
import { GoodsReceiptDocumentPanel } from "../features/goodsReceipt/GoodsReceiptDocumentPanel";
import { GoodsReceiptListPanel } from "../features/goodsReceipt/GoodsReceiptListPanel";
import { SalesListPanel } from "../features/sales/SalesListPanel";
import { SalesDocumentPanel } from "../features/sales/SalesDocumentPanel";
import { StockBalancesPanel } from "../features/inventory/StockBalancesPanel";
import { StockCardPanel } from "../features/inventory/StockCardPanel";
import { Button } from "../components/ui/button";
import { NativeSelect, NativeSelectOption } from "../components/ui/native-select";
import { useLabFeatureRuntime } from "./runtime/LabProvider";
import type { LabReadMode } from "../infrastructure/fake/fakeReceiptInventoryPorts";

const panels = {
  sales: SalesDocumentPanel,
  "goods-receipt": GoodsReceiptDocumentPanel,
  "goods-receipt-document": GoodsReceiptDocumentPanel,
  "goods-receipt-records": GoodsReceiptListPanel,
  "goods-receipt-list": GoodsReceiptListPanel,
  "inventory-balances": StockBalancesPanel,
  "inventory-stock-card": StockCardPanel,
};

export function LabFeatureWorkspace() {
  return <WorkspaceHost catalogTitle="Danh sách Sales"
    catalogComponent={SalesListPanel} documentComponents={panels}
    newDocumentModule="goods-receipt" />;
}

/** Case selector lives outside feature DOM. Changing cases never unmounts a
 * dirty document or dispatches a write. This client is DEV-only and isolated. */
export function LabReadControls() {
  const { readScenarios, workspace } = useLabFeatureRuntime();
  const client = useQueryClient();
  const { mode } = useStore(readScenarios.state);
  const layoutBusy = useStore(workspace.layouts.state, state => state.busy);
  const closing = useStore(workspace.close.state, state => state.busy);
  const busy = layoutBusy || closing;
  function choose(value: LabReadMode) {
    if (value === mode) return;
    readScenarios.setMode(value);
    void client.cancelQueries().then(() => client.invalidateQueries());
  }
  return <aside className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2 text-sm"
    aria-label="Kịch bản đọc fake">
    <label className="flex items-center gap-2">Kết quả đọc
      <NativeSelect aria-label="Kết quả đọc fake" value={mode} onChange={e => choose(e.target.value as LabReadMode)}>
        {(["ready", "latency", "empty", "error", "forbidden"] as const).map(value =>
          <NativeSelectOption value={value} key={value}>{value}</NativeSelectOption>)}
      </NativeSelect>
    </label>
    <Button variant="outline" disabled={busy} onClick={() => void workspace.openPanel("goods-receipt")}>Danh sách nhập kho</Button>
    <Button variant="outline" disabled={busy} onClick={() => void workspace.openPanel("inventory-balances")}>Tồn kho</Button>
    <Button variant="outline" disabled={busy} onClick={() => void workspace.openPanel("inventory-stock-card")}>Thẻ kho</Button>
    <Button variant="outline" disabled={busy} onClick={() => void workspace.openDocument("goods-receipt", null)}>Phiếu nhập mới</Button>
    <p className="w-full text-xs text-muted-foreground">Các kết quả fake không phải HTTP/SQL. 403 giữ read fence trong panel; đóng rồi mở lại tab đọc để thử cấp quyền lại. Chuyển case không đóng hoặc discard tài liệu dirty.</p>
  </aside>;
}
