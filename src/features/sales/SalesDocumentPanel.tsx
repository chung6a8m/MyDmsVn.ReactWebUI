import { SalesHeaderForm } from "./SalesHeaderForm";
import { SalesLinesGrid } from "./SalesLinesGrid";
import { LookupOverlayHost } from "../../shared/lookup/LookupOverlayHost";
import { editDraft } from "./sessionEditing";
import { canEdit } from "./salesSessionStore";
import { LookupHarness } from "../../lab/LookupHarness";
import { Button } from "../../components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import type { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import type { IDockviewPanelProps } from "dockview";
import { useWorkspace } from "../../app/workspace/WorkspaceContext";
import { Input } from "../../components/ui/input";
import type { SalesLineDraft } from "./contracts";

ModuleRegistry.registerModules([AllCommunityModule]);
export function SalesDocumentPanel({
  params,
  api,
}: IDockviewPanelProps<{ sessionId: string }>) {
  const workspace = useWorkspace();
  const [lookupHarness, setLookupHarness] = useState(false);
  const [visible, setVisible] = useState(api.isVisible);
  useEffect(() => {
    const sub = api.onDidVisibilityChange((e) => setVisible(e.isVisible));
    return () => sub.dispose();
  }, [api]);
  const [saveMessage, setSaveMessage] = useState("");
  const [snapshot, setSnapshot] = useState("");
  const session = useStore(
    workspace.store,
    (state) => state.sessions[params.sessionId],
  );
  const closeFeedback = useStore(
    workspace.close.state,
    (state) => state.feedback[params.sessionId],
  );
  const closeIssues = useStore(
    workspace.close.state,
    (state) => state.issues[params.sessionId],
  );
  const grid = useRef<AgGridReact<SalesLineDraft>>(null);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const issue = closeIssues?.[0];
    if (!issue) return;
    api.setActive();
    const lineId = issue.field.startsWith("qty:")
      ? issue.field.slice(4)
      : undefined;
    const index = lineId
      ? workspace.store
          .getState()
          .sessions[params.sessionId]?.draft?.lines.findIndex(
            (line) => line.clientLineId === lineId,
          )
      : undefined;
    if (index !== undefined && index >= 0) {
      grid.current?.api.ensureIndexVisible(index, "middle");
      grid.current?.api.ensureColumnVisible("qty");
    }
    const frame = requestAnimationFrame(() => {
      const element =
        issue.field === "note"
          ? document.getElementById(`note-${params.sessionId}`)
          : lineId
            ? document.getElementById(`qty-${params.sessionId}-${lineId}`)
            : undefined;
      (
        element ?? root.current?.querySelector<HTMLElement>('[role="alert"]')
      )?.focus();
      workspace.close.acknowledgeIssues(params.sessionId, closeIssues!);
    });
    return () => cancelAnimationFrame(frame);
  }, [api, closeIssues, params.sessionId, workspace]);
  if (!session) return null;
  const note = session.rawBuffers.note?.raw ?? session.draft?.note ?? "";
  return (
    <LookupOverlayHost visible={visible}>
      <section
        ref={root}
        aria-label={`Chứng từ ${session.saleId ?? "mới"}`}
        data-session-id={session.sessionId}
        data-generation={session.generation}
        data-request-generation={session.requestGeneration}
        className="flex h-full min-h-0 flex-col"
        onFocusCapture={() => {
          api.setActive();
          workspace.commands.activate(session.sessionId);
        }}
      >
        {closeFeedback && (
          <p role="alert" tabIndex={-1} className="px-4 py-2 text-destructive">
            {closeFeedback}
          </p>
        )}
        {session.mutation !== "idle" && (
          <p role="status" className="px-4 py-2">
            {session.mutation === "pending"
              ? "Đang lưu mô phỏng…"
              : "Kết quả chưa rõ; phiên đang khóa để đối soát."}
          </p>
        )}
        {session.status === "loading" ? (
          <p role="status">Đang đọc chứng từ…</p>
        ) : session.status === "failed" ? (
          <p role="alert">{session.error?.message}</p>
        ) : (
          <>
            {!lookupHarness && (
              <SalesHeaderForm
                workspace={workspace}
                sessionId={session.sessionId}
              />
            )}
            {saveMessage && (
              <p role="alert" tabIndex={-1}>
                {saveMessage}
              </p>
            )}
            {!lookupHarness && (
              <div className="flex flex-wrap items-center gap-4 p-4">
                <label
                  className="min-w-0 flex-1"
                  htmlFor={`note-${session.sessionId}`}
                >
                  Ghi chú
                  <Input
                    id={`note-${session.sessionId}`}
                    disabled={!canEdit(session)}
                    value={note}
                    onChange={(event) =>
                      workspace.writeBuffer(
                        session.sessionId,
                        "note",
                        event.target.value,
                        session.rawBuffers.note?.composing,
                      )
                    }
                    onCompositionStart={(event) =>
                      workspace.writeBuffer(
                        session.sessionId,
                        "note",
                        event.currentTarget.value,
                        true,
                      )
                    }
                    onCompositionEnd={(event) =>
                      workspace.writeBuffer(
                        session.sessionId,
                        "note",
                        event.currentTarget.value,
                        false,
                      )
                    }
                  />
                </label>
                <span>{session.dirty ? "Chưa lưu" : "Chưa thay đổi"}</span>
                <span>Lệnh đã nhận: {session.commandCount}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2 px-4 py-2">
              <Button
                disabled={!canEdit(session)}
                onClick={async () => {
                  const r = await workspace.sales.requestSave(
                    session.sessionId,
                  );
                  setSaveMessage(
                    r.kind === "saved"
                      ? "Đã lưu mô phỏng (không ghi dataset)."
                      : r.kind === "blocked"
                        ? r.issues.map((i) => i.message).join(" ")
                        : r.kind === "failed"
                          ? r.error.message
                          : "Kết quả chưa rõ.",
                  );
                }}
              >
                Lưu chứng từ (stub)
              </Button>
              <Button
                variant="outline"
                disabled={!canEdit(session)}
                onClick={async () => {
                  const r = await workspace.barrier.prepareSave(
                    session.sessionId,
                  );
                  if (r.kind === "ready") {
                    setSnapshot(JSON.stringify(r.snapshot));
                    setSaveMessage(
                      `Snapshot sẵn sàng · revision ${r.editRevision}`,
                    );
                  } else
                    setSaveMessage(r.issues.map((i) => i.message).join(" "));
                }}
              >
                Kiểm tra snapshot
              </Button>
              <Button
                variant="outline"
                disabled={!canEdit(session)}
                onClick={() => {
                  if (session.draft!.lines.length >= 200) {
                    setSaveMessage("Tối đa 200 dòng; không thêm dòng 201.");
                    return;
                  }
                  editDraft(workspace.store, session, (d) => ({
                    ...d,
                    lines: [
                      ...d.lines,
                      {
                        clientLineId: crypto.randomUUID(),
                        saleLineId: null,
                        productId: null,
                        qty: "1.0000",
                        unitPrice: "0.0000",
                        isGift: false,
                      },
                    ],
                  }));
                }}
              >
                Thêm dòng
              </Button>
              <span>{session.draft!.lines.length} dòng</span>
              <Button
                variant="outline"
                onClick={() => setLookupHarness(!lookupHarness)}
              >
                {lookupHarness ? "Đóng lookup harness" : "Kiểm tra lookup"}
              </Button>
            </div>
            {snapshot && (
              <details className="px-4">
                <summary>Snapshot kiểm chứng</summary>
                <pre
                  data-testid="prepared-snapshot"
                  className="max-h-32 overflow-auto"
                >
                  {snapshot}
                </pre>
              </details>
            )}
            <div className="min-h-0 flex-1">
              {lookupHarness ? (
                <LookupHarness sessionId={session.sessionId} api={api} />
              ) : (
                <SalesLinesGrid
                  workspace={workspace}
                  sessionId={session.sessionId}
                  api={api}
                  gridRef={grid}
                />
              )}
            </div>
          </>
        )}
      </section>
    </LookupOverlayHost>
  );
}
