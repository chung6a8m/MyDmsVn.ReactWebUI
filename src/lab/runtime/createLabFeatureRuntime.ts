import { createWorkspaceRuntime } from "../../app/workspace/panelRegistry";
import type { RuntimeAuthSnapshot } from "../../app/runtime/runtimeDependencies";
import { createGoodsReceiptWorkspaceAdapter } from "../../features/goodsReceipt/goodsReceiptWorkspaceAdapter";
import { createInventoryViews } from "../../features/inventory/inventoryViews";
import { createFakeSalesPort } from "../../infrastructure/fake/fakeSalesPort";
import {
  createFakeGoodsReceiptPort, createFakeInventoryPort, createLabReadScenarios, createLabReceiptCatalog,
} from "../../infrastructure/fake/fakeReceiptInventoryPorts";

export function createLabFeatureRuntime() {
  // A second, stable actor and memory-only layout isolate real Receipt/Inventory
  // recipes from the historical Sales/Receipt-stub lifetime harness.
  const grants = { read: true, write: true, post: true };
  const snapshot: RuntimeAuthSnapshot = {
    actorKey: "lab-feature-demo", actorGeneration: 1, capabilities: grants,
    features: { sales: grants, "goods-receipt": grants,
      "inventory-balances": { read: true }, "inventory-stock-card": { read: true } },
  };
  const auth = { getSnapshot: () => snapshot, subscribe: (_listener: () => void) => () => {} };
  const readScenarios = createLabReadScenarios();
  const catalog = createLabReceiptCatalog();
  const workspace = createWorkspaceRuntime({
    auth, sales: createFakeSalesPort(), catalog, today: () => "2026-11-20", storage: null,
  });
  const receipt = createGoodsReceiptWorkspaceAdapter({
    port: createFakeGoodsReceiptPort(readScenarios), catalog, auth, today: () => "2026-11-20",
  }, {
    scope: workspace.portContext,
    isCurrentScope: workspace.isCurrentScope,
    blocked: () => workspace.close.state.getState().busy || workspace.layouts.state.getState().busy,
    show: workspace.showPanel,
    remove: workspace.removePanel,
  });
  workspace.registerFeature(receipt.feature);
  workspace.registerPanel({ module: "goods-receipt", kind: "records",
    componentId: "goods-receipt-list", title: "Danh sách nhập kho" });
  workspace.registerPanel({ module: "inventory-balances", kind: "read-only",
    componentId: "inventory-balances", title: "Tồn kho" });
  workspace.registerPanel({ module: "inventory-stock-card", kind: "read-only",
    componentId: "inventory-stock-card", title: "Thẻ kho" });
  const inventory = { port: createFakeInventoryPort(readScenarios), catalog, views: createInventoryViews() };
  const unsubscribePanels = workspace.panelState.subscribe(state => inventory.views.retain(Object.keys(state.panels)));
  const originalDispose = workspace.dispose;
  workspace.dispose = () => { unsubscribePanels(); inventory.views.clear(); receipt.dispose(); originalDispose(); };
  return { workspace, receipt, inventory, readScenarios };
}
export type LabFeatureRuntime = ReturnType<typeof createLabFeatureRuntime>;
