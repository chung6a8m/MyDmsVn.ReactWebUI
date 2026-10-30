import { useRef } from "react";
import { useStore } from "zustand";
import type { CustomCellEditorProps } from "ag-grid-react";
import type { SalesSessionStore } from "../../features/sales/salesSessionStore";
import type { CatalogPort } from "../../ports/catalogPort";
import { ProductLookup } from "../lookup/ProductLookup";
import {
  emptyLookup,
  type LookupValue,
  type LookupScope,
} from "../lookup/lookupTypes";
import { publishLookup, restoreLookup } from "../lookup/sessionLookup";
export interface LookupEditorBinding {
  store: SalesSessionStore;
  scope: LookupScope;
  port: CatalogPort;
  field: string;
  initialLookup?: LookupValue;
}
export function ProductLookupCellEditor(
  props: CustomCellEditorProps & LookupEditorBinding,
) {
  const { store, scope, port, field } = props;
  const original = useRef(
    store.getState().sessions[scope.sessionId]?.lookupBuffers?.[field],
  );
  const value = useStore(
    store,
    (s) =>
      s.sessions[scope.sessionId]?.lookupBuffers?.[field] ??
      props.initialLookup ??
      emptyLookup,
  );
  return (
    <ProductLookup
      label="Sản phẩm grid"
      autoFocus
      scope={scope}
      port={port}
      value={value}
      onChange={(next) => {
        if (publishLookup(store, scope, field, next))
          props.onValueChange(next.selectedId);
      }}
      onCancelEdit={() => {
        restoreLookup(store, scope, field, original.current);
        props.onValueChange(original.current?.selectedId ?? null);
      }}
    />
  );
}

// AG Grid's native key listener runs before React's bubble handler.
// Install this on the product column alongside the editor.
export function suppressProductLookupKeyboard({
  event,
  editing,
}: {
  event: KeyboardEvent;
  editing: boolean;
}) {
  const target = event.target as HTMLElement | null;
  if (!editing || target?.getAttribute("role") !== "combobox") return false;
  const composing = event.isComposing || target.dataset.composing === "true";
  return (
    (composing &&
      ["Enter", "Escape", "ArrowDown", "ArrowUp"].includes(event.key)) ||
    ["ArrowDown", "ArrowUp"].includes(event.key) ||
    (target.getAttribute("aria-expanded") === "true" &&
      ["Enter", "Escape"].includes(event.key))
  );
}
