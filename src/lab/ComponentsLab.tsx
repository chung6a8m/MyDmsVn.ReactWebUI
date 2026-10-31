import { useSearch } from "@tanstack/react-router";
import { FoundationWorkspace } from "./FoundationWorkspace";
export function ComponentsLab() {
  const { scenario } = useSearch({ from: "/lab/components" });
  return (
    <>
      <p className="px-4 py-2">Components Lab · Nova / Dockview / Quartz</p>
      <p className="px-4 pb-2">Scenario: {scenario}</p>
      <p className="px-4 pb-2">
        Mở chứng từ mẫu → Kiểm tra lookup để thử field, grid và modal.
      </p>
      <FoundationWorkspace scenario={scenario} />
    </>
  );
}
