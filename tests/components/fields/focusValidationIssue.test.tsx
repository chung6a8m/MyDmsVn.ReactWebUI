// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { DocumentField } from "../../../src/shared/forms/DocumentField";
import { Input } from "../../../src/components/ui/input";
import { documentFieldId } from "../../../src/shared/forms/fieldIdentity";
import { focusValidationIssue, type ValidationGrid } from "../../../src/shared/forms/focusValidationIssue";

afterEach(cleanup);

it("navigates the currently displayed sorted/virtualized row by clientLineId", () => {
  const calls: string[] = [];
  const grid: ValidationGrid = {
    getRowNode: vi.fn(id => { calls.push(id); return { rowIndex: id === "stable-client" ? 17 : -1 }; }),
    ensureIndexVisible: vi.fn(),
    ensureColumnVisible: vi.fn(),
    setFocusedCell: vi.fn(),
    getEditingCells: vi.fn(() => []),
    startEditingCell: vi.fn(),
  };
  const node = document.createElement("section");
  document.body.append(node);
  const issue = { code: "invalid", field: "qty:stable-client", clientLineId: "stable-client", message: "Số sai" };
  expect(focusValidationIssue({ module: "sales", sessionId: "doc", issue, root: node, grid, canEdit: true })).toBe(true);
  expect(calls).toEqual(["stable-client"]);
  expect(grid.ensureIndexVisible).toHaveBeenCalledWith(17, "middle");
  expect(grid.ensureColumnVisible).toHaveBeenCalledWith("qty");
  expect(grid.setFocusedCell).toHaveBeenCalledWith(17, "qty");
  expect(grid.startEditingCell).toHaveBeenCalledWith({ rowIndex: 17, colKey: "qty" });
  node.remove();
});

it("does not force an editor for read-only fields or an already active editor", () => {
  const grid: ValidationGrid = {
    getRowNode: () => ({ rowIndex: 2 }),
    ensureIndexVisible: vi.fn(),
    ensureColumnVisible: vi.fn(),
    setFocusedCell: vi.fn(),
    getEditingCells: () => [{ rowIndex: 2, column: { getColId: () => "quantity" } }],
    startEditingCell: vi.fn(),
  };
  const node = document.createElement("section");
  document.body.append(node);
  const issue = { code: "invalid", field: "quantity:client-a", clientLineId: "client-a", message: "Sai" };
  expect(focusValidationIssue({ module: "goods-receipt", sessionId: "doc", issue, root: node, grid, canEdit: true })).toBe(true);
  expect(grid.startEditingCell).not.toHaveBeenCalled();
  grid.getEditingCells = () => [];
  expect(focusValidationIssue({ module: "goods-receipt", sessionId: "doc", issue, root: node, grid, canEdit: false })).toBe(true);
  expect(grid.startEditingCell).not.toHaveBeenCalled();
  node.remove();
});

it("focuses only the active document's header control and never guesses a deleted row", () => {
  const target = documentFieldId("sales", "session-A", "note");
  const { container } = render(<section>
    <DocumentField id={target} label="Ghi chú">{attrs => <Input {...attrs} />}</DocumentField>
    <section aria-label="Lỗi chứng từ" tabIndex={-1}>Có lỗi khác</section>
  </section>);
  const root = container.firstElementChild as HTMLElement;
  const note = screen.getByRole("textbox", { name: "Ghi chú" });
  expect(focusValidationIssue({ module: "sales", sessionId: "session-A",
    issue: { code: "invalid", field: "note", message: "Sai ghi chú" }, root, canEdit: true })).toBe(true);
  expect(note).toHaveFocus();
  const grid: ValidationGrid = {
    getRowNode: () => undefined,
    ensureIndexVisible: vi.fn(), ensureColumnVisible: vi.fn(),
    setFocusedCell: vi.fn(), getEditingCells: () => [], startEditingCell: vi.fn(),
  };
  expect(focusValidationIssue({ module: "sales", sessionId: "session-A",
    issue: { code: "invalid", field: "qty:deleted-client", clientLineId: "deleted-client", message: "Đã xóa" },
    root, grid, canEdit: true })).toBe(false);
  expect(grid.setFocusedCell).not.toHaveBeenCalled();
  expect(screen.getByRole("region", { name: "Lỗi chứng từ" })).toHaveFocus();
});

it("keeps focus inside an already open Receipt editor on duplicate navigation", () => {
  const root = document.createElement("section");
  const cell = document.createElement("div");
  cell.setAttribute("col-id", "quantity");
  const input = document.createElement("input");
  input.dataset.lineId = "client-17";
  cell.append(input);
  root.append(cell);
  document.body.append(root);
  const grid: ValidationGrid = {
    getRowNode: () => ({ rowIndex: 17 }),
    ensureIndexVisible: vi.fn(),
    ensureColumnVisible: vi.fn(),
    setFocusedCell: vi.fn(),
    getEditingCells: () => [{ rowIndex: 17, column: { getColId: () => "quantity" } }],
    startEditingCell: vi.fn(),
  };
  const issue = { code: "validation", field: "quantity:client-17",
    clientLineId: "client-17", message: "Số lượng không hợp lệ" };
  expect(focusValidationIssue({ module: "goods-receipt", sessionId: "receipt-1",
    issue, root, grid, canEdit: true })).toBe(true);
  expect(input).toHaveFocus();
  expect(grid.setFocusedCell).not.toHaveBeenCalled();
  expect(grid.startEditingCell).not.toHaveBeenCalled();
  root.remove();
});
