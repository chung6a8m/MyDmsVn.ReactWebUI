import { useState } from "react";
import { useStore } from "zustand";
import { Button } from "../components/ui/button";
import { useWorkspace } from "../app/workspace/WorkspaceContext";
import { canEdit } from "../features/sales/salesSessionStore";

// Snapshot oracle uses the *real* feature barrier; no duplicate draft state.
export function SalesSnapshotDiagnostics({ sessionId, onFeedback }: {
  sessionId: string;
  onFeedback: (message: string) => void;
}) {
  const workspace = useWorkspace();
  const session = useStore(workspace.store, (state) => state.sessions[sessionId]);
  const [snapshot, setSnapshot] = useState("");
  if (!session) return null;
  return (
    <>
      <Button
        variant="outline"
        disabled={!canEdit(session)}
        onClick={async () => {
          const result = await workspace.barrier.prepareSave(sessionId);
          if (result.kind === "ready") {
            setSnapshot(JSON.stringify(result.snapshot));
            onFeedback(`Snapshot sẵn sàng · revision ${result.editRevision}`);
          } else {
            onFeedback(result.issues.map((issue) => issue.message).join(" "));
          }
        }}
      >
        Kiểm tra snapshot
      </Button>
      <span>Lệnh đã nhận: {session.commandCount}</span>
      {snapshot && (
        <details className="w-full px-1">
          <summary>Snapshot kiểm chứng</summary>
          <pre data-testid="prepared-snapshot" className="max-h-32 overflow-auto">
            {snapshot}
          </pre>
        </details>
      )}
    </>
  );
}
