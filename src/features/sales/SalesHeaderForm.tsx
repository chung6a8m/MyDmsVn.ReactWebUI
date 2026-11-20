import { useRef } from "react";
import { useStore } from "zustand";
import { Input } from "../../components/ui/input";
import { ProductLookup } from "../../shared/lookup/ProductLookup";
import { publishLookup } from "../../shared/lookup/sessionLookup";
import { emptyLookup, type LookupValue } from "../../shared/lookup/lookupTypes";
import { DocumentField } from "../../shared/forms/DocumentField";
import { documentFieldId, fieldIssueMessages } from "../../shared/forms/fieldIdentity";
import type { WorkspaceRuntime } from "../../app/workspace/panelRegistry";
import { canEdit } from "./salesSessionStore";

export function SalesHeaderForm({ workspace, sessionId }: { workspace: WorkspaceRuntime; sessionId: string }) {
  const composing = useRef(false);
  const session = useStore(workspace.store, s => s.sessions[sessionId]);
  if (!session?.draft) return null;
  const readOnly = !!session.postAcknowledgement || session.baseline?.status === "Posted";
  const disabled = !canEdit(session);
  const issues = (field: string) => fieldIssueMessages(session.issues, field);
  return <div className="grid grid-cols-2 gap-3 px-4 py-2 xl:grid-cols-4">
    <DocumentField id={documentFieldId("sales", sessionId, "saleDate")} label="Ngày chứng từ"
      helper="Định dạng yyyy-MM-dd" required errors={issues("saleDate")} readOnly={readOnly} disabled={disabled}>
      {attrs => <Input {...attrs} placeholder="yyyy-MM-dd"
        value={session.rawBuffers.saleDate?.raw ?? session.draft!.saleDate}
        onChange={e => workspace.writeBuffer(sessionId, "saleDate", e.target.value, composing.current)}
        onCompositionStart={e => { composing.current = true; workspace.writeBuffer(sessionId, "saleDate", e.currentTarget.value, true); }}
        onCompositionEnd={e => { composing.current = false; workspace.writeBuffer(sessionId, "saleDate", e.currentTarget.value, false); }} />}
    </DocumentField>
    {([["customer", "Khách hàng"], ["warehouse", "Kho"], ["employee", "Nhân viên"]] as const).map(([kind, label]) => {
      const field = kind + "Id";
      const ref = session.baseline?.references[kind];
      const initial: LookupValue = ref
        ? { selectedId: ref.id, displayText: ref.name, query: ref.name, confirmed: true, composing: false }
        : emptyLookup;
      return <DocumentField key={kind} id={documentFieldId("sales", sessionId, field)}
        label={label} labelOwner="control" required helper="Chọn từ danh mục"
        errors={issues(field)} readOnly={readOnly} disabled={disabled}>
        {attrs => <ProductLookup id={attrs.id} label={label} required readOnly={readOnly}
          scope={{ ...session, clientLineId: field, catalogContext: "sales-header", catalogKind: kind }}
          port={workspace.catalog} value={session.lookupBuffers?.[field] ?? initial}
          disabled={disabled} invalid={attrs["aria-invalid"]} describedBy={attrs["aria-describedby"]}
          onChange={value => publishLookup(workspace.store, session, field, value)} />}
      </DocumentField>;
    })}
  </div>;
}
