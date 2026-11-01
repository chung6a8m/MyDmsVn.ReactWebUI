import { parseReceiptDecimal } from "./validation";

// Display-only exact half-up preview. Backend Post owns valuation range checks.
export function previewLineAmount(quantity: string, unitCost: string): string {
  const quantity4 = BigInt(parseReceiptDecimal(quantity, "quantity").replace(".", ""));
  const cost4 = BigInt(parseReceiptDecimal(unitCost, "unitCost").replace(".", ""));
  const amount4 = (quantity4 * cost4 + 5000n) / 10000n;
  return `${amount4 / 10000n}.${(amount4 % 10000n).toString().padStart(4, "0")}`;
}
