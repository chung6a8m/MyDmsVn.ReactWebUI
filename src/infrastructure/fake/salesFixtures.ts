import type {
  SalesDocument,
  SalesSaveSnapshot,
} from "../../features/sales/contracts";
import {
  lineAmount,
  totalAmount,
  parseDecimal,
} from "../../features/sales/decimal";
import { catalogFixtures } from "./fixtures";
import { createWorkspaceDocument } from "./workspaceFixtures";
export function materializeSales(
  snapshot: SalesSaveSnapshot,
  id: string,
  version: string,
  status: "Draft" | "Posted" = "Draft",
): SalesDocument {
  const lookup = (kind: keyof typeof catalogFixtures, ref: string) => {
    const result = catalogFixtures[kind].find((x) => x.id === ref);
    if (!result) throw Error("reference-conflict");
    return { ...result };
  };
  let nextLine =
    snapshot.lines.reduce(
      (max, line) =>
        line.saleLineId && BigInt(line.saleLineId) > max
          ? BigInt(line.saleLineId)
          : max,
      BigInt(`${id}000`),
    ) + 1n;
  const lines = snapshot.lines.map((line) => ({
    ...line,
    saleLineId: line.saleLineId ?? String(nextLine++),
    qty: parseDecimal(line.qty, "qty"),
    unitPrice: parseDecimal(line.unitPrice, "unitPrice"),
  }));
  const details = lines.map((line) => ({
    ...line,
    product: lookup("product", line.productId!),
    unit: lookup("product", line.productId!).unit ?? "",
    lineAmount: lineAmount(line.qty, line.unitPrice, line.isGift),
    costAmount: status === "Posted" ? "0.0000" : null,
  }));
  const total = totalAmount(details.map((x) => x.lineAmount));
  return {
    saleId: id,
    saleNumber: `Sales ${id}`,
    version,
    status,
    saved: { ...snapshot, saleId: id, expectedVersion: version, lines },
    references: {
      customer: lookup("customer", snapshot.customerId),
      warehouse: lookup("warehouse", snapshot.warehouseId),
      employee: lookup("employee", snapshot.employeeId),
    },
    lines: details,
    totalAmount: total,
    totalCost: status === "Posted" ? "0.0000" : null,
    grossProfit: status === "Posted" ? total : null,
  };
}
export function createSalesFixtures(): SalesDocument[] {
  return Array.from({ length: 36 }, (_, i) => {
    const id =
      i < 34 ? String(1001 + i) : String(9007199254740993n + BigInt(i - 34));
    const base = createWorkspaceDocument(id);
    const snapshot = {
      ...base.saved,
      saleDate: `2026-10-${String(1 + (i % 31)).padStart(2, "0")}`,
      lines:
        i < 2
          ? base.saved.lines
          : base.saved.lines
              .slice(0, 2)
              .map((l, j) => ({
                ...l,
                productId: catalogFixtures.product[(i + j) % 4].id,
                unitPrice: "12.5000",
                isGift: j === 1 && i % 3 === 0,
              })),
    };
    return materializeSales(
      snapshot,
      id,
      "workspace-v1",
      i > 1 && i % 4 === 0 ? "Posted" : "Draft",
    );
  });
}
