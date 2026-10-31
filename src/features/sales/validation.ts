import type { SalesSaveSnapshot, ValidationIssue } from "./contracts";
import { catalogLabels, lookupKindForField } from "../../shared/lookup/lookupTypes";
import { parseDecimal, lineAmount, totalAmount } from "./decimal";
export function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return (
    y > 0 &&
    m >= 1 &&
    m <= 12 &&
    d >= 1 &&
    d <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
  );
}
export function validateSales(snapshot: SalesSaveSnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (field: string, message: string, clientLineId?: string) =>
    issues.push({ code: "validation", field, message, clientLineId });
  if (!validCalendarDate(snapshot.saleDate))
    add("saleDate", "Ngày chứng từ phải là ngày thật dạng yyyy-MM-dd.");
  for (const field of ["customerId", "warehouseId", "employeeId"] as const)
    if (!/^[1-9]\d*$/.test(snapshot[field]))
      add(field, `Cần chọn ${catalogLabels[lookupKindForField(field)]}.`);
  if (snapshot.note.length > 1000 || snapshot.note.includes("\0"))
    add("note", "Ghi chú tối đa 1.000 ký tự và không chứa NUL.");
  if (snapshot.lines.length < 1 || snapshot.lines.length > 200)
    add("lines", "Chứng từ cần từ 1 đến 200 dòng.");
  const ids = new Set<string>();
  const amounts: string[] = [];
  for (const line of snapshot.lines) {
    const id = line.clientLineId;
    if (!id || ids.has(id))
      add("lines", "ID dòng phải độc lập và duy nhất.", id);
    ids.add(id);
    if (!line.productId || !/^[1-9]\d*$/.test(line.productId))
      add(`product:${id}`, "Cần chọn sản phẩm.", id);
    let valid = true;
    for (const field of ["qty", "unitPrice"] as const) {
      try {
        parseDecimal(line[field], field);
      } catch (e) {
        valid = false;
        add(`${field}:${id}`, (e as Error).message, id);
      }
    }
    if (valid)
      try {
        amounts.push(lineAmount(line.qty, line.unitPrice, line.isGift));
      } catch (e) {
        add(`amount:${id}`, (e as Error).message, id);
      }
  }
  try {
    totalAmount(amounts);
  } catch (e) {
    add("totalAmount", (e as Error).message);
  }
  return issues;
}
