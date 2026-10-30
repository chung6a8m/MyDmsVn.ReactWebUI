import { useStore } from "zustand";
import { Button } from "../components/ui/button";
import { useWorkspace } from "../app/workspace/WorkspaceContext";
import type { CloseSaveMode } from "../infrastructure/fake/closeSaveHarness";

const modes: [CloseSaveMode, string][] = [
  ["success", "thành công"],
  ["failure", "lỗi"],
  ["deferred", "chờ điều khiển"],
  ["outcome-unknown", "không rõ kết quả"],
];
export function CloseHarnessControls() {
  const { saveHarness } = useWorkspace();
  const { mode, pending } = useStore(saveHarness.state);
  return (
    <aside
      aria-label="Điều khiển Save stub"
      className="flex flex-wrap items-center gap-2 border-b px-4 py-2"
    >
      {modes.map(([value, label]) => (
        <Button
          key={value}
          variant="outline"
          aria-pressed={mode === value}
          onClick={() => saveHarness.setMode(value)}
        >
          Stub: {label}
        </Button>
      ))}
      {pending.map((item) => (
        <span key={item.sessionId} className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => saveHarness.complete(item.sessionId, "success")}
          >
            Hoàn tất {item.title}
          </Button>
          <Button
            variant="outline"
            onClick={() => saveHarness.complete(item.sessionId, "failure")}
          >
            Báo lỗi {item.title}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              saveHarness.complete(item.sessionId, "outcome-unknown")
            }
          >
            Mất phản hồi {item.title}
          </Button>
        </span>
      ))}
    </aside>
  );
}
