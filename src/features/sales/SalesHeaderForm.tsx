import { useRef } from "react";
import { useStore } from "zustand";
import { Input } from "../../components/ui/input";
import { ProductLookup } from "../../shared/lookup/ProductLookup";
import { publishLookup } from "../../shared/lookup/sessionLookup";
import { emptyLookup, type LookupValue } from "../../shared/lookup/lookupTypes";
import type { WorkspaceRuntime } from "../../app/workspace/panelRegistry";
import { canEdit } from "./salesSessionStore";
export function SalesHeaderForm({
  workspace,
  sessionId,
}: {
  workspace: WorkspaceRuntime;
  sessionId: string;
}) {
  const composing = useRef(false);
  const session = useStore(workspace.store, (s) => s.sessions[sessionId]);
  const port = workspace.catalog;
  return (
    <div className="grid grid-cols-2 gap-3 px-4 py-2 xl:grid-cols-4">
      <label htmlFor={`saleDate-${sessionId}`}>
        Ngày chứng từ
        <Input
          id={`saleDate-${sessionId}`}
          disabled={!canEdit(session)}
          placeholder="yyyy-MM-dd"
          value={session.rawBuffers.saleDate?.raw ?? session.draft!.saleDate}
          onChange={(e) =>
            workspace.writeBuffer(
              sessionId,
              "saleDate",
              e.target.value,
              composing.current,
            )
          }
          onCompositionStart={(e) => {
            composing.current = true;
            workspace.writeBuffer(
              sessionId,
              "saleDate",
              e.currentTarget.value,
              true,
            );
          }}
          onCompositionEnd={(e) => {
            composing.current = false;
            workspace.writeBuffer(
              sessionId,
              "saleDate",
              e.currentTarget.value,
              false,
            );
          }}
        />
      </label>
      {(
        [
          ["customer", "Khách hàng"],
          ["warehouse", "Kho"],
          ["employee", "Nhân viên"],
        ] as const
      ).map(([kind, label]) => {
        const field = `${kind}Id`;
        const ref = session.baseline?.references[kind];
        const initial: LookupValue = ref
          ? {
              selectedId: ref.id,
              displayText: ref.name,
              query: ref.name,
              confirmed: true,
              composing: false,
            }
          : emptyLookup;
        return (
          <ProductLookup
            key={kind}
            label={label}
            scope={{
              ...session,
              clientLineId: field,
              catalogContext: "sales-header",
              catalogKind: kind,
            }}
            port={port}
            value={session.lookupBuffers?.[field] ?? initial}
            disabled={!canEdit(session)}
            onChange={(v) => publishLookup(workspace.store, session, field, v)}
          />
        );
      })}
    </div>
  );
}
