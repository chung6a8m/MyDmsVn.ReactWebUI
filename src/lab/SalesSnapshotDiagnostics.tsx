import { useState } from "react";
import { useStore } from "zustand";
import { Button } from "../components/ui/button";
import { useWorkspace } from "../app/workspace/WorkspaceContext";
import { canEdit } from "../features/sales/salesSessionStore";

// Snapshot oracle uses the *real* feature barrier; no duplicate draft state.
export function SalesSnapshotDiagnostics({ sessionId }: { sessionId: string }) {
  const workspace = useWorkspace();
  const session = useStore(workspace.store, (state) => state.sessions[sessionId]);
  const [message, setMessage] = useState("");
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
            setMessage(`Snapshot sẵn sàng · revision ${result.editRevision}`);
          } else {
            setMessage(result.issues.map((issue) => issue.message).join(" "));
          }
        }}
      >
        Kiểm tra snapshot
      </Button>
      {message && <p role="alert" tabIndex={-1} className="w-full">{message}</p>}
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
