import type { SalesSession } from "./salesSessionStore";
export function salesPanelTitle(session: SalesSession): string {
  if (!session.saleId) return "Sales mới";
  const number = session.baseline?.saleNumber || session.saleId;
  return number.startsWith("Sales ") ? number : `Sales ${number}`;
}
