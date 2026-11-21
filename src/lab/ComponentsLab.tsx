import { useSearch } from "@tanstack/react-router";
import { FoundationWorkspace } from "./FoundationWorkspace";
import { FieldStates } from "./FieldStates";
import { DateFieldStates } from "./DateFieldStates";
import { DecimalInputStates } from "./DecimalInputStates";
import { ReadStateStates } from "./ReadStateStates";
export function ComponentsLab() {
  const { scenario } = useSearch({ from: "/lab/components" });
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <span className="sr-only 2xl:not-sr-only">Components Lab · Nova / Dockview / Quartz</span>
        <div className="flex flex-wrap gap-2"><FieldStates /><DateFieldStates /><DecimalInputStates /><ReadStateStates /></div>
      </div>
      <p className="px-4 pb-2">Scenario: {scenario}</p>
      <p className="px-4 pb-2">
        Mở chứng từ mẫu → Kiểm tra lookup để thử field, grid và modal.
      </p>
      <FoundationWorkspace scenario={scenario} />
    </>
  );
}
