import { SalesFeedback } from "./SalesFeedback";
import { SalesHeaderForm } from "./SalesHeaderForm";
import { SalesLinesGrid } from "./SalesLinesGrid";
import { LookupOverlayHost } from "../../shared/lookup/LookupOverlayHost";
import { editDraft } from "./sessionEditing";
import { canEdit } from "./salesSessionStore";
import { useWorkspaceExtensions } from "../../app/workspace/WorkspaceExtensions";
import { Button } from "../../components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import type { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import type { IDockviewPanelProps } from "dockview";
import { useWorkspace } from "../../app/workspace/WorkspaceContext";
import { Input } from "../../components/ui/input";
import type { SalesLineDraft } from "./contracts";
import type { ValidationIssue } from "../../ports/portContracts";
import { DocumentField } from "../../shared/forms/DocumentField";
import { documentFieldId, fieldIssueMessages } from "../../shared/forms/fieldIdentity";
import { focusValidationIssue } from "../../shared/forms/focusValidationIssue";
import { identityMatches } from "./salesSessionStore";

ModuleRegistry.registerModules([AllCommunityModule]);
export function SalesDocumentPanel({
  params,
  api,
}: IDockviewPanelProps<{ sessionId: string }>) {
  const workspace = useWorkspace();
  const { lookupHarness: LookupHarness, salesDiagnostics: SalesDiagnostics } = useWorkspaceExtensions();
  const [lookupHarness, setLookupHarness] = useState(false);
  const [visible, setVisible] = useState(api.isVisible);
  useEffect(() => {
    const sub = api.onDidVisibilityChange((e) => setVisible(e.isVisible));
    return () => sub.dispose();
  }, [api]);
  const [saveMessage, setSaveMessage] = useState("");
  const session = useStore(
    workspace.store,
    (state) => state.sessions[params.sessionId],
  );
  const closeIssues = useStore(
    workspace.close.state,
    (state) => state.issues[params.sessionId],
  );
  const grid = useRef<AgGridReact<SalesLineDraft>>(null);
  const root = useRef<HTMLElement>(null);
  const noteComposing = useRef(false);
  function navigateIssue(issue: ValidationIssue) {
    if (!session || !identityMatches(workspace.store.getState().sessions[params.sessionId], session)) return;
    api.setActive();
    if (lookupHarness) setLookupHarness(false);
    requestAnimationFrame(() => {
      if (!identityMatches(workspace.store.getState().sessions[params.sessionId], session) || !api.isVisible) return;
      focusValidationIssue({ module: "sales", sessionId: params.sessionId, issue, root: root.current,
        grid: grid.current?.api, canEdit: canEdit(workspace.store.getState().sessions[params.sessionId]) });
    });
  }
  useEffect(() => {
    const issue = closeIssues?.[0];
    if (!issue) return;
    navigateIssue(issue);
    workspace.close.acknowledgeIssues(params.sessionId, closeIssues);
  // Acknowledgement is the one-shot signal. Keystrokes do not retrigger focus.
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
        className="flex h-full min-h-0 flex-col overflow-auto"
        onFocusCapture={() => {
          api.setActive();
          workspace.commands.activate(session.sessionId);
        }}
      >
        {session.mutation !== "idle" && (
          <p role="status" className="px-4 py-2">
            {session.mutation === "pending"
              ? "Đang lưu chứng từ…"
              : "Kết quả chưa rõ; phiên đang khóa để đối soát."}
          </p>
        )}
        {session.status === "loading" ? (
          <p role="status">Đang đọc chứng từ…</p>
        ) : session.status === "failed" ? (
          <div>
            <p role="alert">{session.error?.message}</p>
            <Button
              variant="outline"
              onClick={() => void workspace.retryFailed(session.sessionId)}
            >
              Thử đọc lại chứng từ
            </Button>
          </div>
        ) : (
          <>
            <SalesFeedback sessionId={session.sessionId} onIssueSelect={navigateIssue} />
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
              <div className="p-4">
                <DocumentField id={documentFieldId("sales", session.sessionId, "note")} label="Ghi chú"
                  errors={fieldIssueMessages(session.issues, "note")}
                  readOnly={!!session.postAcknowledgement || session.baseline?.status === "Posted"}
                  disabled={!canEdit(session) && !session.postAcknowledgement && session.baseline?.status !== "Posted"}>
                  {attrs => <div className="flex flex-wrap items-center gap-4 text-sm">
                  <Input
                    {...attrs}
                    className="min-w-40 flex-1"
                    value={note}
                    onChange={(event) =>
                      workspace.writeBuffer(
                        session.sessionId,
                        "note",
                        event.target.value,
                        noteComposing.current,
                      )
                    }
                    onCompositionStart={(event) => {
                      noteComposing.current = true;
                      workspace.writeBuffer(
                        session.sessionId,
                        "note",
                        event.currentTarget.value,
                        true,
                      );
                    }}
                    onCompositionEnd={(event) => {
                      noteComposing.current = false;
                      workspace.writeBuffer(
                        session.sessionId,
                        "note",
                        event.currentTarget.value,
                        false,
                      );
                    }}
                  />
                  <span>{session.dirty ? "Chưa lưu" : "Chưa thay đổi"}</span>
                </div>}
                </DocumentField>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
              <Button
                disabled={!canEdit(session)}
                onClick={() => {
                  setSaveMessage("");
                  const origin = session;
                  void workspace.sales.requestSave(session.sessionId).then(result => {
                    const issues = result.kind === "blocked" ? result.issues
                      : result.kind === "failed" ? result.error.issues : undefined;
                    const issue = issues?.find(item => !!item.field);
                    if (issue && identityMatches(workspace.store.getState().sessions[origin.sessionId], origin))
                      navigateIssue(issue);
                  });
                }}
              >
                Lưu chứng từ
              </Button>
              <Button
                disabled={
                  session.mutation !== "idle" ||
                  !!session.localRecovery || session.writeReviewRequired ||
                  session.preparing ||
                  !session.saleId ||
                  session.dirty ||
                  !!session.postAcknowledgement ||
                  session.baseline?.status !== "Draft" ||
                  session.capabilities?.post === false
                }
                onClick={() =>
                  void workspace.sales.requestPost(session.sessionId)
                }
              >
                Post chứng từ
              </Button>
              {SalesDiagnostics && <SalesDiagnostics sessionId={session.sessionId} onFeedback={setSaveMessage} />}
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
              {LookupHarness && (
              <Button
                variant="outline"
                onClick={() => setLookupHarness(!lookupHarness)}
              >
                {lookupHarness ? "Đóng lookup harness" : "Kiểm tra lookup"}
              </Button>
              )}
            </div>
            <div className="min-h-64 flex-1">
              {lookupHarness && LookupHarness ? (
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
