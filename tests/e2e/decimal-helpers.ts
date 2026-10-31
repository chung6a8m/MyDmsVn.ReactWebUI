import { expect, type Locator } from "@playwright/test";
export function decimalCell(panel: Locator, kind: "qty" | "unitPrice", row = 0) {
  return panel.locator(`.ag-row[row-index="${row}"] [col-id="${kind}"]`);
}
export async function openDecimal(panel: Locator, kind: "qty" | "unitPrice", row = 0) {
  await expect(decimalCell(panel, kind, row)).toHaveCount(1);
  await decimalCell(panel, kind, row).dblclick();
  return panel.getByLabel(`${kind === "qty" ? "Số lượng" : "Đơn giá"} dòng ${row + 1}`, { exact: true });
}
