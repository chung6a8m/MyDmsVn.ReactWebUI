import { LabFeatureScope } from "./runtime/LabProvider";
import { LabFeatureWorkspace, LabReadControls } from "./LabFeatureWorkspace";
export function GoodsReceiptLab() {
  return <LabFeatureScope>
    <div className="shrink-0 px-4 py-2 text-sm">Receipt Lab · Real GoodsReceiptDocumentPanel / ListPanel qua fake ports. Stub WEB3 vẫn ở Sales/Components harness riêng.</div>
    <LabReadControls />
    <LabFeatureWorkspace />
  </LabFeatureScope>;
}
