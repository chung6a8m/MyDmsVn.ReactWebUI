import { LabFeatureScope } from "../runtime/LabProvider";
import { LabFeatureWorkspace, LabReadControls } from "../LabFeatureWorkspace";
export function DocumentEditRecipe() {
  return <LabFeatureScope>
    <section aria-label="Document Edit Recipe" className="shrink-0 border-b px-4 py-2 text-sm">
      <h2 className="font-semibold">Recipe · Document Edit</h2>
      <p>Chọn “Phiếu nhập mới” để thử DateField, ProductLookup, DecimalInput, validation summary, AG Grid, Save/Post và dirty-close trên cùng GoodsReceiptDocumentPanel production. Chỉ ghi vào memory fake.</p>
    </section>
    <LabReadControls />
    <LabFeatureWorkspace />
  </LabFeatureScope>;
}
