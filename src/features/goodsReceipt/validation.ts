import type { GoodsReceiptSaveSnapshot } from "./contracts";
import type { ValidationIssue } from "../../ports/portContracts";
import { catalogLabels, lookupKindForField } from "../../shared/lookup/lookupTypes";
import { parseDecimal } from "../sales/decimal";
export function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return (
    y > 0 && value !== "0001-01-01" &&
    m >= 1 &&
    m <= 12 &&
    d >= 1 &&
    d <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
  );
}
export function validateGoodsReceipt(snapshot: GoodsReceiptSaveSnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (field: string, message: string, clientLineId?: string) =>
    issues.push({ code: "validation", field, message, clientLineId });
  if (!validCalendarDate(snapshot.receiptDate))
    add("receiptDate", "Ngày chứng từ phải là ngày thật dạng yyyy-MM-dd.");
  for (const field of ["warehouseId", "employeeId"] as const)
    if (!validCatalogId(snapshot[field]))
      add(field, `Cần chọn ${catalogLabels[lookupKindForField(field)]}.`);
  if (snapshot.note !== null && (snapshot.note.length > 1000 || snapshot.note.includes("\0") || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(snapshot.note)))
    add("note", "Ghi chú tối đa 1.000 ký tự và không chứa NUL.");
  if (snapshot.lines.length < 1 || snapshot.lines.length > 200)
    add("lines", "Chứng từ cần từ 1 đến 200 dòng.");
  const ids = new Set<string>();
  const products = new Set<string>();
  for (const line of snapshot.lines) {
    const id = line.clientLineId;
    if (!id || ids.has(id))
      add("lines", "ID dòng phải độc lập và duy nhất.", id);
    ids.add(id);
    if (!line.productId || !validCatalogId(line.productId))
      add(`product:${id}`, "Cần chọn sản phẩm.", id);
    if (line.productId && products.has(line.productId)) add(`product:${id}`, "Sản phẩm không được trùng trong phiếu nhập.", id);
    if (line.productId) products.add(line.productId);
    for (const field of ["quantity", "unitCost"] as const) {
      try {
        parseReceiptDecimal(line[field], field);
      } catch (e) {
        add(`${field}:${id}`, (e as Error).message, id);
      }
    }
  }
  return issues;
}

export function validCatalogId(value: string) { return /^[1-9]\d{0,9}$/.test(value) && BigInt(value) <= 2147483647n; }
export function parseReceiptDecimal(raw: string, field: "quantity" | "unitCost") {
  if (raw.length > 64) throw Error("Số tối đa 64 ký tự.");
  return parseDecimal(raw, field === "quantity" ? "qty" : "unitPrice");
}
