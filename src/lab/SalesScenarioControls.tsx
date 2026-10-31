import { useStore } from "zustand";
import { useWorkspace } from "../app/workspace/WorkspaceContext";
import { Button } from "../components/ui/button";
import type {
  ScenarioMode,
  ReadMode,
} from "../infrastructure/fake/scenarioController";
const modes: [ScenarioMode, string][] = [
  ["success", "Thành công"],
  ["known-failure", "Lỗi chắc chắn"],
  ["forbidden", "Từ chối"],
  ["version-conflict", "Xung đột version"],
  ["reference-conflict", "Xung đột reference"],
  ["delay", "Chờ điều khiển"],
  ["commit-then-response-lost", "Commit mất response"],
  ["eventual-commit", "Commit trễ"],
];
const reads: [ReadMode, string][] = [
  ["success", "Bình thường"],
  ["deny", "Từ chối đọc"],
  ["error", "Lỗi đọc"],
  ["old-version", "Version cũ"],
  ["mismatch", "Nội dung khác"],
  ["empty-list", "Danh sách rỗng"],
];
export function SalesScenarioControls() {
  const { scenarios } = useWorkspace();
  const state = useStore(scenarios.state);
  return (
    <details className="border-b px-4 py-2">
      <summary>Điều khiển fake Sales (ngoài sản phẩm)</summary>
      <aside
        aria-label="Điều khiển fake Sales"
        className="flex flex-wrap items-center gap-2 py-2"
      >
        <label>
          Kết quả mutation{" "}
          <select
            aria-label="Kết quả mutation"
            value={state.mode}
            onChange={(e) => scenarios.setMode(e.target.value as ScenarioMode)}
          >
            {modes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kết quả đọc{" "}
          <select
            aria-label="Kết quả đọc"
            value={state.readMode}
            onChange={(e) => scenarios.setReadMode(e.target.value as ReadMode)}
          >
            {reads.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {(["read", "write", "post"] as const).map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={state.capabilities[key]}
              onChange={(e) =>
                scenarios.setCapabilities({ [key]: e.target.checked })
              }
            />
            Quyền {key}
          </label>
        ))}
        {state.pending.map((p) => (
          <span key={p.requestId}>
            <Button
              variant="outline"
              onClick={() => scenarios.complete(p.requestId)}
            >
              Hoàn tất {p.requestId}
            </Button>
            <Button
              variant="outline"
              onClick={() => scenarios.complete(p.requestId, "known-failure")}
            >
              Báo lỗi {p.requestId}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                scenarios.complete(p.requestId, "commit-then-response-lost")
              }
            >
              Mất phản hồi {p.requestId}
            </Button>
          </span>
        ))}
      </aside>
    </details>
  );
}
