/** Proleptic Gregorian date-only primitives. No Date.parse/UTC conversion for wire values. */
export interface DateOnlyParts {
  year: number;
  month: number;
  day: number;
}

export type ParsedDateOnly =
  | { kind: "empty"; raw: string }
  | { kind: "incomplete"; raw: string }
  | { kind: "invalid"; raw: string }
  | ({ kind: "valid"; canonical: string } & DateOnlyParts);

export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(year) || year < 1 || year > 9999 ||
      !Number.isInteger(month) || month < 1 || month > 12) return 0;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function isDateOnlyParts(value: DateOnlyParts): boolean {
  return Number.isInteger(value.day) && value.day >= 1 &&
    value.day <= daysInMonth(value.year, value.month);
}

export function parseDateOnly(raw: string): ParsedDateOnly {
  if (raw === "") return { kind: "empty", raw };
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    if (isDateOnlyParts({ year, month, day }))
      return { kind: "valid", canonical: raw, year, month, day };
    return { kind: "invalid", raw };
  }
  // Only a prefix of the exact ISO grammar counts as incomplete.
  if (/^(?:\d{1,4}|\d{4}-\d{0,2}|\d{4}-\d{2}-\d{0,2})$/.test(raw))
    return { kind: "incomplete", raw };
  return { kind: "invalid", raw };
}

export function formatDateOnly(value: DateOnlyParts): string {
  if (!isDateOnlyParts(value)) throw new RangeError("Date-only parts are out of range");
  return String(value.year).padStart(4, "0") + "-" +
    String(value.month).padStart(2, "0") + "-" +
    String(value.day).padStart(2, "0");
}

export function compareDateOnly(a: DateOnlyParts, b: DateOnlyParts): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

export function shiftDateOnlyMonths(value: DateOnlyParts, delta: number): DateOnlyParts {
  const index = Math.max(0, Math.min(9999 * 12 - 1,
    (value.year - 1) * 12 + value.month - 1 + Math.trunc(delta)));
  const year = Math.floor(index / 12) + 1;
  const month = index % 12 + 1;
  return { year, month, day: Math.min(value.day, daysInMonth(year, month)) };
}

export function shiftDateOnlyDays(value: DateOnlyParts, delta: number): DateOnlyParts {
  let result = { ...value };
  const direction = Math.sign(delta);
  for (let step = 0; step < Math.abs(Math.trunc(delta)); step++) {
    if (direction > 0) {
      if (result.year === 9999 && result.month === 12 && result.day === 31) break;
      if (result.day < daysInMonth(result.year, result.month)) result.day++;
      else if (result.month < 12) { result.month++; result.day = 1; }
      else { result.year++; result.month = 1; result.day = 1; }
    } else if (direction < 0) {
      if (result.year === 1 && result.month === 1 && result.day === 1) break;
      if (result.day > 1) result.day--;
      else if (result.month > 1) { result.month--; result.day = daysInMonth(result.year, result.month); }
      else { result.year--; result.month = 12; result.day = 31; }
    }
  }
  return result;
}

/** Monday=0 … Sunday=6, including years 0001–0099. */
export function weekdayMonday(value: DateOnlyParts): number {
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const year = value.year - (value.month < 3 ? 1 : 0);
  const sunday = (year + Math.floor(year / 4) - Math.floor(year / 100) +
    Math.floor(year / 400) + offsets[value.month - 1] + value.day) % 7;
  return (sunday + 6) % 7;
}

function validBound(value: string | undefined): DateOnlyParts | null {
  const parsed = value === undefined ? null : parseDateOnly(value);
  return parsed?.kind === "valid" ? parsed : null;
}

export function isDateOnlyWithinBounds(value: DateOnlyParts, min?: string, max?: string): boolean {
  const lower = validBound(min), upper = validBound(max);
  return (!lower || compareDateOnly(value, lower) >= 0) &&
    (!upper || compareDateOnly(value, upper) <= 0);
}

export function clampDateOnly(value: DateOnlyParts, min?: string, max?: string): DateOnlyParts {
  const lower = validBound(min), upper = validBound(max);
  if (lower && compareDateOnly(value, lower) < 0) return lower;
  if (upper && compareDateOnly(value, upper) > 0) return upper;
  return value;
}
