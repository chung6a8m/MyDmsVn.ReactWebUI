import { z } from "./cspZod";
import { pagingShape, scaledDecimal, utcOrder, web3Amount, web3Average, web3BalanceQuantity, web3IntId, web3LongId, web3Page, web3SignedAmount, web3SignedQuantity, web3Text, web3Utc } from "./web3WireSchemas";
const referenceShape = {
  warehouseId: web3IntId, warehouseCode: web3Text, warehouseName: web3Text, warehouseIsActive: z.boolean(),
  productId: web3IntId, productCode: web3Text, productName: web3Text, productIsActive: z.boolean(),
};
export const balanceRowSchema = z.object({ ...referenceShape, quantity: web3BalanceQuantity, inventoryValue: web3Amount, averageUnitCost: web3Average.nullable() }).strict().superRefine((v, ctx) => {
  const quantity = scaledDecimal(v.quantity, 4), value = scaledDecimal(v.inventoryValue, 4);
  const valid = quantity === 0n ? value === 0n && v.averageUnitCost === null : v.averageUnitCost !== null && scaledDecimal(v.averageUnitCost, 8) === value * 100000000n / quantity + ((value * 100000000n % quantity) * 2n >= quantity ? 1n : 0n);
  if (!valid) ctx.addIssue({ code: "custom", message: "Invalid server average" });
});
export const stockCardRowSchema = z.object({ ...referenceShape, ledgerId: web3LongId, documentId: web3LongId, postedAtUtc: web3Utc, documentType: web3Text.min(1), documentNumber: web3Text.min(1), quantityChange: web3SignedQuantity, valueChange: web3SignedAmount }).strict().superRefine((v, ctx) => {
  const q = scaledDecimal(v.quantityChange, 4), amount = scaledDecimal(v.valueChange, 4);
  if (q === 0n || (v.documentType === "GoodsReceipt" && (q <= 0n || amount < 0n)) || (v.documentType === "SalesReceipt" && (q >= 0n || amount > 0n))) ctx.addIssue({ code: "custom", message: "Invalid source movement" });
});
export const balancesPageSchema = web3Page(balanceRowSchema, v => `${v.warehouseId}/${v.productId}`);
export const stockCardPageSchema = web3Page(stockCardRowSchema, v => v.ledgerId, (a, b) => utcOrder(a.postedAtUtc) < utcOrder(b.postedAtUtc) || (utcOrder(a.postedAtUtc) === utcOrder(b.postedAtUtc) && BigInt(a.ledgerId) < BigInt(b.ledgerId)));
export const balancesQuerySchema = z.object({ ...pagingShape, warehouseId: web3IntId.optional(), productId: web3IntId.optional(), search: web3Text.max(256).optional() }).strict();
export const stockCardQuerySchema = z.object({ ...pagingShape, warehouseId: web3IntId, productId: web3IntId, fromUtc: web3Utc.optional(), toUtc: web3Utc.optional() }).strict().refine(v => !v.fromUtc || !v.toUtc || utcOrder(v.fromUtc) <= utcOrder(v.toUtc));
