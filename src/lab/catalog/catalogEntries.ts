export type CatalogGroup = "primitives" | "controls" | "recipes";
export interface CatalogEntry {
  id: string;
  group: CatalogGroup;
  title: string;
  purpose: string;
  source: string;
  consumers: readonly string[];
  states: readonly string[];
  keyboard: string;
  validation: string;
  tests: readonly string[];
  path: "components" | "receipts" | "inventory" | "filters" | "document-edit";
  status: "available" | "planned";
}
// These are discoverable production exports and their real consumers, not copies
// of WinForms controls. Planned entries do not render a fake parity façade.
export const catalogEntries: readonly CatalogEntry[] = [
  { id: "button", group: "primitives", title: "Button", purpose: "Lệnh theo trạng thái cho phép.",
    source: "src/components/ui/button.tsx", consumers: ["WorkspaceActions", "Sales", "Receipt"],
    states: ["normal", "disabled", "focus"], keyboard: "Tab, Enter, Space; không nhận IME commit.", validation: "Action/grant thuộc caller.",
    tests: ["tests/e2e/product-workspace-actions.spec.ts"], path: "components", status: "available" },
  { id: "input", group: "primitives", title: "Input", purpose: "Raw text, aria-invalid và read-only.",
    source: "src/components/ui/input.tsx", consumers: ["Sales", "Receipt", "Inventory"],
    states: ["normal", "disabled", "read-only", "invalid"], keyboard: "Tab, text editing, IME.", validation: "Không tự normalize hoặc Save.",
    tests: ["tests/e2e/form-validation.spec.ts"], path: "components", status: "available" },
  { id: "dialog", group: "primitives", title: "Dialog", purpose: "Modal focus/dismiss Base UI.",
    source: "src/components/ui/dialog.tsx", consumers: ["CloseDocumentDialog", "RecoverySupport"],
    states: ["open", "closed"], keyboard: "Escape đóng, trả focus trigger.", validation: "Admission do caller sở hữu.",
    tests: ["tests/e2e/product-workspace-actions.spec.ts"], path: "components", status: "available" },
  { id: "native-select", group: "primitives", title: "NativeSelect", purpose: "Chọn một giá trị rõ ràng.",
    source: "src/components/ui/native-select.tsx", consumers: ["Receipt list", "Inventory read"],
    states: ["normal", "disabled"], keyboard: "Tab, mũi tên, Enter.", validation: "Bộ lọc chỉ áp dụng lựa chọn đã commit.",
    tests: ["tests/e2e/web7-read-states.spec.ts"], path: "components", status: "available" },
  { id: "document-field", group: "controls", title: "DocumentField + ValidationSummary", purpose: "Label/helper/error và focus theo field/line identity.",
    source: "src/shared/forms/DocumentField.tsx", consumers: ["SalesHeaderForm", "GoodsReceiptHeaderForm"],
    states: ["normal", "required", "invalid", "disabled", "read-only"], keyboard: "Tab tới field; lỗi focus đúng clientLineId.",
    validation: "Không sở hữu business validators hoặc draft state.",
    tests: ["tests/components/fields/DocumentField.test.tsx", "tests/e2e/form-validation.spec.ts"], path: "components", status: "available" },
  { id: "date-field", group: "controls", title: "DateField + Calendar", purpose: "ISO date-only text/calendar với raw độc lập.",
    source: "src/shared/inputs/DateField.tsx", consumers: ["SalesHeaderForm", "GoodsReceiptHeaderForm"],
    states: ["leap", "partial", "invalid", "bounds", "disabled", "read-only"], keyboard: "Arrow, PageUp/Down, Escape, Tab; IME giữ raw.",
    validation: "yyyy-MM-dd; Receipt chặn 0001-01-01 theo feature.",
    tests: ["tests/components/inputs/DateField.test.tsx", "tests/e2e/date-field.spec.ts"], path: "components", status: "available" },
  { id: "decimal-input", group: "controls", title: "DecimalInput", purpose: "Exact decimal raw/IME/Escape mechanics.",
    source: "src/shared/inputs/DecimalInput.tsx", consumers: ["Sales grid", "GoodsReceipt grid"],
    states: ["comma", "partial", "invalid", "long", "disabled", "read-only"],
    keyboard: "IME, Escape restore, Tab commit bởi grid adapter.", validation: "Không dùng JS number/auto-round; feature quyết định scale.",
    tests: ["tests/components/inputs/DecimalInput.test.tsx", "tests/e2e/decimal-input.spec.ts"], path: "components", status: "available" },
  { id: "lookup", group: "controls", title: "ProductLookup field/cell", purpose: "Tìm, highlight, confirm và selected ID riêng.",
    source: "src/shared/lookup/ProductLookup.tsx", consumers: ["Sales", "Receipt", "Inventory filters"],
    states: ["many", "empty", "error", "draft", "confirmed", "grid"],
    keyboard: "ArrowDown highlight; Enter/Tab confirm; Escape dismiss; popup Floating UI.",
    validation: "Chưa confirm không thay applied ID.",
    tests: ["tests/e2e/lookup-grid.spec.ts", "tests/components/lookup/ProductLookup.test.tsx"], path: "components", status: "available" },
  { id: "read-state", group: "controls", title: "FilterBar + ReadState", purpose: "Filter, empty/no-match/error/forbidden và read retry đúng scope.",
    source: "src/shared/feedback/ReadState.tsx", consumers: ["SalesListPanel", "GoodsReceiptListPanel", "InventoryReadPanel"],
    states: ["loading", "ready", "empty", "no-match", "error", "forbidden", "pending", "unknown"],
    keyboard: "Tab qua filter/action; read retry chỉ khi có callback.", validation: "Không tự retry mutation.",
    tests: ["tests/components/feedback/ReadState.test.tsx", "tests/e2e/web7-read-states.spec.ts"], path: "components", status: "available" },
  { id: "workspace-actions", group: "controls", title: "Toolbar / Workspace Actions", purpose: "Command targeting, split/close/reset/restore qua admission.",
    source: "src/app/workspace/WorkspaceActions.tsx", consumers: ["ProductShell", "Dockview workspace"],
    states: ["active", "busy", "dirty", "unknown"], keyboard: "Ctrl+Alt+W; menu Enter/Escape return focus.",
    validation: "Không thay feature owner hoặc bypass close admission.",
    tests: ["tests/e2e/product-workspace-actions.spec.ts"], path: "components", status: "available" },
  { id: "filter-results", group: "recipes", title: "Filter Results", purpose: "Receipt/Inventory filter + real AG Grid, read states qua fake ports.",
    source: "src/lab/recipes/FilterResultsRecipe.tsx", consumers: ["Receipt list", "Inventory balances/card"],
    states: ["ready", "latency", "empty", "error", "forbidden"], keyboard: "Tab, filter lookup Arrow/Enter, grid keyboard.",
    validation: "Read-only scenario; không phát mutation.",
    tests: ["tests/e2e/ui-lab-catalog.spec.ts"], path: "filters", status: "available" },
  { id: "document-edit", group: "recipes", title: "Document Edit", purpose: "Real Receipt header + inline grid + feedback + Save/Post.",
    source: "src/lab/recipes/DocumentEditRecipe.tsx", consumers: ["GoodsReceiptDocumentPanel"],
    states: ["new", "invalid", "dirty", "saved", "posted"], keyboard: "Lookup, DateField, DecimalInput, Save barrier, close dialog.",
    validation: "Fake write contract; no HTTP/SQL/idempotency claims.",
    tests: ["tests/e2e/ui-lab-catalog.spec.ts", "tests/e2e/web3-receipt.spec.ts"], path: "document-edit", status: "available" },
  { id: "workspace-layout", group: "recipes", title: "Workspace split/layout", purpose: "Hai panel Dockview và admission cho dirty close.",
    source: "src/app/workspace/WorkspaceHost.tsx", consumers: ["Sales", "Receipt", "Inventory"],
    states: ["two panels", "dirty", "close dialog"], keyboard: "Ctrl+Alt+W, Tab, Escape.",
    validation: "Reset/restore có admission; không tự bỏ draft.",
    tests: ["tests/e2e/workspace.spec.ts", "tests/e2e/runtimeIsolation.spec.ts"], path: "receipts", status: "available" },
  { id: "advanced-grid", group: "controls", title: "Enterprise grid features", purpose: "Không có trong AG Grid Community; chưa thực hiện.",
    source: "—", consumers: [], states: [], keyboard: "Chưa áp dụng.", validation: "Planned, không tạo mock giả parity.",
    tests: [], path: "components", status: "planned" },
];
const entriesById = new Map(catalogEntries.map(entry => [entry.id, entry]));
export function findCatalogEntry(value: unknown): CatalogEntry | undefined {
  return typeof value === "string" ? entriesById.get(value) : undefined;
}
export function parseCatalogEntry(value: unknown): string { return findCatalogEntry(value)?.id ?? "button"; }
