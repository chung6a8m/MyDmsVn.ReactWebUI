import type { ValidationIssue } from "../../ports/portContracts";
import { documentFieldId, type DocumentModule } from "./fieldIdentity";

// Structural subset of AG Grid API so both Sales and Receipt can use the same
// focus algorithm without coupling shared UI to their row/draft models.
export interface ValidationGrid {
  getRowNode(id: string): { rowIndex: number | null } | undefined;
  ensureIndexVisible(index: number, position?: "top" | "middle" | "bottom" | null): void;
  ensureColumnVisible(key: string): void;
  setFocusedCell(index: number, key: string): void;
  getEditingCells(): { rowIndex: number; column?: { getColId(): string } | null }[];
  startEditingCell(params: { rowIndex: number; colKey: string }): void;
}

export function focusValidationIssue({
  module, sessionId, issue, root, grid, canEdit,
}: {
  module: DocumentModule;
  sessionId: string;
  issue: ValidationIssue;
  root: HTMLElement | null;
  grid?: ValidationGrid;
  canEdit: boolean;
}) {
  if (!root?.isConnected) return false;
  const colon = issue.field.indexOf(":");
  const column = colon >= 0 ? issue.field.slice(0, colon) : "";
  const lineId = issue.clientLineId || (colon >= 0 ? issue.field.slice(colon + 1) : "");
  const editable = module === "sales"
    ? ["product", "qty", "unitPrice"]
    : ["product", "quantity", "unitCost"];
  if (grid && lineId && editable.includes(column)) {
    // Grid order may have changed since the issue was produced; never use a
    // draft index, product ID or server line ID as the row address.
    const row = grid.getRowNode(lineId)?.rowIndex;
    if (row != null && row >= 0) {
      grid.ensureIndexVisible(row, "middle");
      grid.ensureColumnVisible(column);
      const editing = grid.getEditingCells().some(cell =>
        cell.rowIndex === row && cell.column?.getColId() === column);
      if (editing && canEdit) {
        // Save and close admission can independently surface the same issue.
        // Focusing the AG Grid cell here would blur an already mounted editor,
        // and startEditingCell would correctly refuse to recreate it.
        const input = [...root.querySelectorAll<HTMLInputElement>("input[data-line-id]")].find(element =>
          element.dataset.lineId === lineId && element.closest("[col-id]")?.getAttribute("col-id") === column);
        input?.focus({ preventScroll: true });
      } else {
        grid.setFocusedCell(row, column);
        if (canEdit) grid.startEditingCell({ rowIndex: row, colKey: column });
      }
      return true;
    }
  }
  const field = document.getElementById(documentFieldId(module, sessionId, issue.field));
  if (field && root.contains(field) && field instanceof HTMLElement) {
    field.focus();
    return true;
  }
  // Non-editable aggregate errors or rows deleted in the meantime remain
  // visible in the summary, rather than jumping to an unrelated row.
  root.querySelector<HTMLElement>('[aria-label="Lỗi chứng từ"], [aria-label="Lỗi phiếu nhập"]')?.focus();
  return false;
}
