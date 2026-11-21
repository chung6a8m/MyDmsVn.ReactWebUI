import { describe, expect, it } from "vitest";
import {
  clampDateOnly, compareDateOnly, daysInMonth, formatDateOnly, isDateOnlyWithinBounds,
  parseDateOnly, shiftDateOnlyDays, shiftDateOnlyMonths, weekdayMonday,
} from "../../../src/shared/inputs/dateOnly";

describe("WEB7-05: strict date-only grammar", () => {
  it("distinguishes empty, incomplete, invalid and canonical valid without normalizing raw", () => {
    expect(parseDateOnly("")).toEqual({ kind: "empty", raw: "" });
    for (const raw of ["2", "2026", "2026-", "2026-0", "2026-02-", "2026-02-2"])
      expect(parseDateOnly(raw)).toEqual({ kind: "incomplete", raw });
    for (const raw of ["2026-02-30", "2026-13-01", "2026-00-01", "2026-1-1", "01/01/2026", " 2026-01-01", "2026-01-01Z", "0000-01-01"])
      expect(parseDateOnly(raw)).toEqual({ kind: "invalid", raw });
    expect(parseDateOnly("2024-02-29")).toEqual({ kind: "valid", canonical: "2024-02-29", year: 2024, month: 2, day: 29 });
  });

  it("honors leap years, year 0001 and year 0099 without Date constructor offsets", () => {
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(parseDateOnly("0001-01-01").kind).toBe("valid");
    expect(parseDateOnly("0099-12-31").kind).toBe("valid");
    expect(formatDateOnly({ year: 1, month: 1, day: 1 })).toBe("0001-01-01");
    expect(weekdayMonday({ year: 1, month: 1, day: 1 })).toBe(0);
    expect(shiftDateOnlyDays({ year: 99, month: 12, day: 31 }, 1)).toEqual({ year: 100, month: 1, day: 1 });
    expect(shiftDateOnlyDays({ year: 2024, month: 3, day: 1 }, -1)).toEqual({ year: 2024, month: 2, day: 29 });
    expect(shiftDateOnlyMonths({ year: 2024, month: 3, day: 31 }, -1)).toEqual({ year: 2024, month: 2, day: 29 });
    expect(() => formatDateOnly({ year: 0, month: 1, day: 1 })).toThrow();
  });

  it("keeps business bounds separate from parser validity", () => {
    const min = "0001-01-02", max = "0001-01-31";
    const first = { year: 1, month: 1, day: 1 };
    expect(isDateOnlyWithinBounds(first, min, max)).toBe(false);
    expect(parseDateOnly(formatDateOnly(first)).kind).toBe("valid");
    expect(clampDateOnly(first, min, max)).toEqual({ year: 1, month: 1, day: 2 });
    expect(compareDateOnly(shiftDateOnlyDays({ year: 1, month: 1, day: 2 }, -1), first)).toBe(0);
  });
});
