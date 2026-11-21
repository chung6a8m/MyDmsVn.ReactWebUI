import { LabFeatureScope } from "./runtime/LabProvider";
import { LabFeatureWorkspace, LabReadControls } from "./LabFeatureWorkspace";
export function InventoryLab() {
  return <LabFeatureScope>
    <div className="shrink-0 px-4 py-2 text-sm">Inventory Lab · Real StockBalancesPanel / StockCardPanel và AG Grid Community; chọn Kho + Sản phẩm để đọc thẻ kho.</div>
    <LabReadControls />
    <LabFeatureWorkspace />
  </LabFeatureScope>;
}
