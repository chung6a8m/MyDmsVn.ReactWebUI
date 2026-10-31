import { it, expect } from "vitest";
import {
  parseDecimal,
  lineAmount,
  totalAmount,
} from "../../../src/features/sales/decimal";
it("normalizes_exact_input_without_rounding", () => {
  expect(parseDecimal("0001,23000", "qty")).toBe("1.2300");
  expect(parseDecimal("1.00000000", "qty")).toBe("1.0000");
  expect(parseDecimal("0", "unitPrice")).toBe("0.0000");
});
it.each([
  "",
  "-",
  "0",
  "-1",
  "1e2",
  "1,2.3",
  "1 000",
  "1.23001",
  "999999999999999.0000",
])("rejects_invalid_qty_%s", (raw) =>
  expect(() => parseDecimal(raw, "qty")).toThrow(),
);
it("accepts_exact_bounds_and_rejects_overflow", () => {
  expect(parseDecimal("99999999999999.9999", "qty")).toBe(
    "99999999999999.9999",
  );
  expect(parseDecimal("999999999999999.9999", "unitPrice")).toBe(
    "999999999999999.9999",
  );
  expect(() => parseDecimal("1000000000000000", "unitPrice")).toThrow();
  expect(() =>
    lineAmount("99999999999999.9999", "999999999999999.9999"),
  ).toThrow();
});
it("rounds_half_away_and_sums_rounded_lines_without_float", () => {
  expect(lineAmount("1.0001", "0.5000")).toBe("0.5001");
  expect(lineAmount("1.0001", "0.5000", true)).toBe("0.0000");
  expect(totalAmount(["0.5001", "0.5001"])).toBe("1.0002");
  expect(() =>
    totalAmount(["999999999999999999999999.9999", "0.0001"]),
  ).toThrow();
});
