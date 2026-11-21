// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Input } from "../../../src/components/ui/input";
import { DocumentField } from "../../../src/shared/forms/DocumentField";
import { documentFieldId, validationIssueId } from "../../../src/shared/forms/fieldIdentity";
import { ProductLookup } from "../../../src/shared/lookup/ProductLookup";
import { emptyLookup } from "../../../src/shared/lookup/lookupTypes";

afterEach(cleanup);

it("binds visible label, required state, helper and error to the same input", () => {
  const id = documentFieldId("sales", "session A", "saleDate");
  const { container } = render(<DocumentField id={id} label="Ngày chứng từ"
    helper="Định dạng yyyy-MM-dd" required errors={["Ngày sai định dạng."]}>
    {attributes => <Input {...attributes} defaultValue="2026-02-30" />}
  </DocumentField>);
  const input = screen.getByRole("textbox", { name: "Ngày chứng từ" });
  expect(input).toHaveAttribute("id", id);
  expect(input).toHaveAttribute("required");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAccessibleDescription(/Định dạng yyyy-MM-dd/);
  expect(input).toHaveAccessibleDescription(/Ngày sai định dạng/);
  const label = container.querySelector("label");
  expect(label).toHaveAttribute("for", id);
  // jsdom does not implement native label activation; Chromium E2E clicks the label.
  input.focus();
  expect(input).toHaveFocus();
});

it("uses module and document session, not the server record ID, for unique fields and errors", () => {
  const sameServerRecord = "1001";
  const first = documentFieldId("sales", "session-1", sameServerRecord);
  const second = documentFieldId("sales", "session-2", sameServerRecord);
  const receipt = documentFieldId("goods-receipt", "session-1", sameServerRecord);
  expect(new Set([first, second, receipt]).size).toBe(3);
  expect(documentFieldId("sales", "a-b", "c")).not.toBe(documentFieldId("sales", "a", "b-c"));
  const issue = { code: "invalid", field: "qty:client-42", clientLineId: "client-42", message: "Sai" };
  expect(validationIssueId("sales", "session-1", issue, 0))
    .not.toBe(validationIssueId("sales", "session-2", issue, 0));
  expect(validationIssueId("sales", "session-1", issue, 0))
    .not.toBe(validationIssueId("goods-receipt", "session-1", issue, 0));
});

it("distinguishes read-only, disabled, control-owned labels, and a valid field", () => {
  render(<div>
    <DocumentField id="field-valid" label="Hợp lệ">
      {attributes => <Input {...attributes} defaultValue="ok" />}
    </DocumentField>
    <DocumentField id="field-readonly" label="Chỉ đọc" readOnly>
      {attributes => <Input {...attributes} defaultValue="persist" />}
    </DocumentField>
    <DocumentField id="field-disabled" label="Bị khóa" disabled>
      {attributes => <Input {...attributes} defaultValue="denied" />}
    </DocumentField>
    <DocumentField id="field-lookup" label="Danh mục" labelOwner="control" required helper="Chọn mục">
      {attributes => <><label htmlFor={attributes.id}>Danh mục</label>
        <Input {...attributes} role="combobox" /></>}
    </DocumentField>
  </div>);
  expect(screen.getByRole("textbox", { name: "Hợp lệ" })).not.toHaveAttribute("aria-invalid");
  expect(screen.getByRole("textbox", { name: "Chỉ đọc" })).toHaveAttribute("readonly");
  expect(screen.getByRole("textbox", { name: "Chỉ đọc" })).not.toBeDisabled();
  expect(screen.getByRole("textbox", { name: "Bị khóa" })).toBeDisabled();
  expect(screen.getAllByText("Danh mục")).toHaveLength(1);
  expect(screen.getByRole("combobox", { name: "Danh mục" })).toHaveAccessibleDescription("Chọn mục");
});

it("gives inline lookup validation and server field errors distinct DOM IDs", () => {
  const id = documentFieldId("goods-receipt", "receipt-A", "warehouseId");
  const scope = { sessionId: "receipt-A", generation: 1, actorKey: "fixture",
    actorGeneration: 1, clientLineId: "warehouseId", catalogKind: "warehouse" as const,
    catalogContext: "receipt-header" };
  render(<DocumentField id={id} label="Kho" labelOwner="control" required
    helper="Chọn từ danh mục" errors={["Kho đã bị khóa trên máy chủ."]}>
    {props => <ProductLookup id={props.id} label="Kho" value={emptyLookup}
      scope={scope} port={{ search: async () => ({ kind: "success" as const, value: [] }) }}
      onChange={() => {}} invalid={props["aria-invalid"]} describedBy={props["aria-describedby"]} />}
  </DocumentField>);
  const input = screen.getByRole("combobox", { name: "Kho" });
  const describedBy = (input.getAttribute("aria-describedby") ?? "").split(" ");
  expect(describedBy).toContain(id + "-lookup-error");
  expect(describedBy).toContain(id + "-error");
  expect(describedBy).toContain(id + "-helper");
  const ids = [...document.querySelectorAll<HTMLElement>("[id]")].map(node => node.id);
  expect(ids.length).toBe(new Set(ids).size);
  expect(input).toHaveAccessibleDescription(/Cần chọn kho/);
  expect(input).toHaveAccessibleDescription(/Kho đã bị khóa trên máy chủ/);
});
