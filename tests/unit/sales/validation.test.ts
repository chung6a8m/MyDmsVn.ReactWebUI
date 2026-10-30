import { it, expect } from "vitest";
import { validateSales } from "../../../src/features/sales/validation";
import { createWorkspaceDocument } from "../../../src/infrastructure/fake/workspaceFixtures";
it("requires_real_calendar_date_headers_and_note", () => {
  const s = createWorkspaceDocument("1001").saved;
  expect(validateSales({ ...s, saleDate: "2024-02-29" })).toEqual([]);
  for (const saleDate of [
    "2023-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-1-01",
    "0000-01-01",
  ]) {
    expect(
      validateSales({ ...s, saleDate }).some((i) => i.field === "saleDate"),
    ).toBe(true);
  }
  expect(
    validateSales({
      ...s,
      customerId: "",
      warehouseId: "",
      employeeId: "",
      note: "\0",
    }),
  ).toHaveLength(4);
});
it("duplicate_products_keep_distinct_line_ids_and_200_limit", () => {
  const s = createWorkspaceDocument("1001").saved;
  const lines = Array.from({ length: 200 }, (_, i) => ({
    ...s.lines[0],
    clientLineId: `L${i}`,
  }));
  expect(validateSales({ ...s, lines })).toEqual([]);
  expect(
    validateSales({
      ...s,
      lines: [...lines, { ...lines[0], clientLineId: "201" }],
    }).some((i) => i.field === "lines"),
  ).toBe(true);
  expect(validateSales({ ...s, lines: [] })).not.toEqual([]);
  expect(validateSales({ ...s, lines: [lines[0], lines[0]] })).not.toEqual([]);
});
it("validates_decimal_and_total_overflow_with_line_identity", () => {
  const s = createWorkspaceDocument("1001").saved;
  const bad = { ...s.lines[0], qty: "-" };
  expect(validateSales({ ...s, lines: [bad] })[0].clientLineId).toBe(
    bad.clientLineId,
  );
  expect(
    validateSales({
      ...s,
      lines: [
        {
          ...bad,
          qty: "99999999999999.9999",
          unitPrice: "999999999999999.9999",
        },
      ],
    }),
  ).not.toEqual([]);
});
