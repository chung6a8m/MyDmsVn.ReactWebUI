import { useStore } from "zustand";
import { useWorkspace } from "../app/workspace/WorkspaceContext";
import { Button } from "../components/ui/button";
import { seedEditingFixture } from "./seedEditingFixture";
export function EditingHarnessControls() {
  const w = useWorkspace();
  const session = useStore(w.store, (s) =>
    s.activeSessionId ? s.sessions[s.activeSessionId] : undefined,
  );
  return (
    <aside aria-label="Dữ liệu kiểm tra editing" className="px-4 pb-2">
      <Button
        variant="outline"
        disabled={!session?.draft}
        onClick={() => {
          if (session) seedEditingFixture(w.store, session);
        }}
      >
        Mẫu 200 dòng
      </Button>
    </aside>
  );
}
