import type { GoodsReceiptDocument, GoodsReceiptSaveSnapshot } from "./contracts";
import type { GoodsReceiptSession } from "./goodsReceiptSessionStore";
import type { LookupValue } from "../../shared/lookup/lookupTypes";
import { parseDecimal } from "../sales/decimal";
import { validateGoodsReceipt } from "./validation";

export function safeBusinessMatches(a: GoodsReceiptSaveSnapshot, b: GoodsReceiptSaveSnapshot) {
  try { return businessMatches(a, b); } catch { return false; }
}
export function validReceiptDocument(doc: GoodsReceiptDocument) {
  try {
    return /^[1-9]\d{0,18}$/.test(doc.receiptId) && BigInt(doc.receiptId) <= 9223372036854775807n &&
      !!doc.version && doc.saved.receiptId === doc.receiptId && doc.saved.expectedVersion === doc.version &&
      (doc.status === "Draft" ? doc.postedAtUtc === null : doc.status === "Posted" && !!doc.postedAtUtc) &&
      validateGoodsReceipt(doc.saved).length === 0 && doc.lines.length === doc.saved.lines.length &&
      doc.references.warehouse.id === doc.saved.warehouseId && doc.references.employee.id === doc.saved.employeeId &&
      new Set(doc.lines.map(l => l.receiptLineId)).size === doc.lines.length &&
      doc.lines.every((line, index) => {
        const saved = doc.saved.lines[index];
        return line.lineNumber === index + 1 && !!line.receiptLineId && line.receiptLineId === saved.receiptLineId &&
          line.productId === saved.productId && line.product.id === saved.productId &&
          parseDecimal(line.quantity, "qty") === parseDecimal(saved.quantity, "qty") &&
          parseDecimal(line.unitCost, "unitPrice") === parseDecimal(saved.unitCost, "unitPrice");
      });
  } catch { return false; }
}
export function validSaveResult(doc: GoodsReceiptDocument, sent: GoodsReceiptSaveSnapshot) {
  return validReceiptDocument(doc) && doc.status === "Draft" &&
    (!sent.receiptId || doc.receiptId === sent.receiptId) &&
    doc.lines.length === sent.lines.length && doc.lines.every((line, index) => line.productId === sent.lines[index].productId);
}
export function committedLookups(session: GoodsReceiptSession, doc: GoodsReceiptDocument): Record<string, LookupValue> {
  const result: Record<string, LookupValue> = {};
  const references = [
    ["warehouseId", doc.references.warehouse], ["employeeId", doc.references.employee],
    ...doc.lines.map(line => [`product:${line.clientLineId}`, line.product] as const),
  ] as const;
  for (const [field, reference] of references) {
    const prior = session.lookupBuffers?.[field];
    const label = reference.displayName ?? (prior?.confirmed && prior.selectedId === reference.id ? prior.displayText : null);
    if (label !== null) result[field] = { selectedId: reference.id, displayText: label, query: label, confirmed: true, composing: false };
  }
  return result;
}

export function businessMatches(a: GoodsReceiptSaveSnapshot, b: GoodsReceiptSaveSnapshot) {
  const business = (s: GoodsReceiptSaveSnapshot) => ({
    receiptDate: s.receiptDate,
    warehouseId: s.warehouseId,
    employeeId: s.employeeId,
    note: s.note,
    lines: s.lines.map(({ productId, quantity, unitCost }) => ({
      productId,
      quantity: parseDecimal(quantity, "qty"),
      unitCost: parseDecimal(unitCost, "unitPrice"),
    })),
  });
  return JSON.stringify(business(a)) === JSON.stringify(business(b));
}
export function reconcileDocument(
  document: GoodsReceiptDocument,
  session: GoodsReceiptSession,
  sent?: GoodsReceiptSaveSnapshot,
) {
  const result = structuredClone(document);
  const lines = result.saved.lines.map((line, index) => ({
    ...line,
    clientLineId:
      sent?.lines[index]?.clientLineId ??
      session.draft?.lines.find(
        (l) => l.receiptLineId && l.receiptLineId === line.receiptLineId,
      )?.clientLineId ??
      crypto.randomUUID(),
  }));
  result.saved = { ...result.saved, lines };
  result.lines = result.lines.map((line, i) => ({
    ...line,
    clientLineId: lines[i].clientLineId,
  }));
  return result;
}
