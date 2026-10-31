import { z } from "zod";

export const longIdSchema = z.string().refine(v => v.length <= 19 && /^[1-9]\d*$/.test(v) && BigInt(v) <= 9223372036854775807n);
export const intIdSchema = z.number().int().min(1).max(2147483647);
function decimal(precision: number, scale: number, signed = false, positive = false) {
  return z.string().refine(value => {
    if (!(signed ? /^-?\d+(?:\.\d+)?$/ : /^\d+(?:\.\d+)?$/).test(value)) return false;
    const unsigned = value.replace(/^-/, "");
    const [whole, fraction = ""] = unsigned.split(".");
    if (fraction.length > scale) return false;
    const significantWhole = whole.replace(/^0+/, "") || "0";
    if (significantWhole.length > precision - scale) return false;
    const digits = BigInt(significantWhole + fraction.padEnd(scale, "0"));
    return digits <= 10n ** BigInt(precision) - 1n && (!positive || digits > 0n);
  });
}
export const quantitySchema = decimal(18, 4, false, true);
export const priceSchema = decimal(19, 4);
export const amountSchema = decimal(28, 4);
export const profitSchema = decimal(28, 4, true);
export const unitCostSchema = decimal(28, 8);
export const saleDateSchema = z.string().refine(value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value === "0001-01-01") return false;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
});
export const utcSchema = z.iso.datetime();
const optionalAmount = amountSchema.nullish();
const lineSchema = z.object({
  saleLineId: longIdSchema, lineNo: intIdSchema, productId: intIdSchema,
  unit: z.string(), qty: quantitySchema, unitPrice: priceSchema, isGift: z.boolean(), lineAmount: amountSchema,
  postedUnitCost: unitCostSchema.nullish(), costAmount: optionalAmount,
  productDisplayName: z.string().nullish(), productIsActive: z.boolean(),
}).strict();
export const salesDetailSchema = z.object({
  saleId: longIdSchema, saleNumber: z.string(), saleDate: saleDateSchema,
  customerId: intIdSchema, warehouseId: intIdSchema, employeeId: intIdSchema,
  customerDisplayName: z.string().nullish(), customerIsActive: z.boolean(),
  warehouseDisplayName: z.string().nullish(), warehouseIsActive: z.boolean(),
  employeeDisplayName: z.string().nullish(), employeeIsActive: z.boolean(),
  status: z.enum(["Draft", "Posted"]), note: z.string().max(1000).nullish(),
  postedAtUtc: utcSchema.nullish(), version: z.string().min(1),
  lines: z.array(lineSchema).min(1).max(200), totalAmount: amountSchema,
  totalCost: optionalAmount, grossProfit: profitSchema.nullish(),
}).strict().superRefine((value, context) => {
  const ids = new Set<string>();
  const invalid = value.lines.some((line, index) => {
    const duplicate = ids.has(line.saleLineId); ids.add(line.saleLineId);
    return duplicate || line.lineNo !== index + 1;
  });
  if (invalid) context.addIssue({ code: "custom", message: "Invalid line identity/order" });
  const costs = [value.postedAtUtc, value.totalCost, value.grossProfit, ...value.lines.flatMap(line => [line.postedUnitCost, line.costAmount])];
  if (value.status === "Posted" ? costs.some(v => v == null) : costs.some(v => v != null)) context.addIssue({ code: "custom", message: "Invalid costs for status" });
});
export type SalesWireDetail = z.infer<typeof salesDetailSchema>;
export const salesPageSchema = z.object({
  items: z.array(z.object({
    saleId: longIdSchema, saleNumber: z.string(), saleDate: saleDateSchema,
    customerId: intIdSchema, customerDisplayName: z.string(), warehouseId: intIdSchema, warehouseDisplayName: z.string(),
    employeeId: intIdSchema, employeeDisplayName: z.string(), status: z.enum(["Draft", "Posted"]), lineCount: intIdSchema.max(200), totalAmount: amountSchema,
  }).strict()), nextCursor: z.string().min(1).nullish(), previousCursor: z.string().min(1).nullish(),
}).strict();
export const catalogSchema = z.array(z.object({ id: intIdSchema, code: z.string(), name: z.string(), isActive: z.boolean() }).strict());
export const errorEnvelopeSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), details: z.array(z.object({ code: z.string(), message: z.string(), field: z.string().optional() }).strict()).optional(), correlationId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional() }).strict() }).strict();
