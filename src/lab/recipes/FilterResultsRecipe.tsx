import { LabFeatureScope } from "../runtime/LabProvider";
import { LabFeatureWorkspace, LabReadControls } from "../LabFeatureWorkspace";
export function FilterResultsRecipe() {
  return <LabFeatureScope>
    <section aria-label="Filter Results Recipe" className="shrink-0 border-b px-4 py-2 text-sm">
      <h2 className="font-semibold">Recipe · Filter Results</h2>
      <p>Thử bộ lọc đã commit, paging, các trạng thái read và fake latency/403 trên đúng GoodsReceiptListPanel và InventoryReadPanel. Không tạo mutation.</p>
    </section>
    <LabReadControls />
    <LabFeatureWorkspace />
  </LabFeatureScope>;
}
