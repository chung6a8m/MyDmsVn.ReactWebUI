import type { ValidationIssue } from "../../ports/portContracts";
import type { GoodsReceiptSession } from "./goodsReceiptSessionStore";

export function receiptErrorId(sessionId: string, issue: ValidationIssue, index: number) {
  return `receipt-error-${sessionId}-${encodeURIComponent(issue.field)}-${encodeURIComponent(issue.clientLineId ?? "")}-${index}`;
}

// Both local validation and mapped server errors use the captured clientLineId,
// so sorting/virtualization never associates an error with another visual row.
export function receiptFieldErrorAttributes(session: GoodsReceiptSession, field: string) {
  const ids = session.issues?.flatMap((issue, index) => issue.field === field
    ? [receiptErrorId(session.sessionId, issue, index)] : []) ?? [];
  return { "aria-invalid": ids.length ? true : undefined, "aria-describedby": ids.length ? ids.join(" ") : undefined };
}
