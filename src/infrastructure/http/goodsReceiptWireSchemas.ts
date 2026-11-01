import { z } from "./cspZod";
import { web3Date, web3IntId, web3LongId, web3Page, web3Quantity, web3Text, web3UnitCost, web3Utc, web3Version, pagingShape } from "./web3WireSchemas";
const status = z.enum(["Draft", "Posted"]);
const businessLine = z.object({ productId: web3IntId, quantity: web3Quantity, unitCost: web3UnitCost }).strict();
const businessLines = z.array(businessLine).min(1).max(200).refine(lines => new Set(lines.map(line => line.productId)).size === lines.length);
const saveShape = { receiptDate: web3Date, warehouseId: web3IntId, employeeId: web3IntId, note: web3Text.max(1000).nullable().optional(), lines: businessLines };
export const receiptCreateSchema = z.object(saveShape).strict();
export const receiptUpdateSchema = z.object({ ...saveShape, expectedVersion: web3Version }).strict();
export const receiptPostInputSchema = z.object({ expectedVersion: web3Version }).strict();
const lineSchema = businessLine.extend({ receiptLineId: web3LongId, lineNumber: web3IntId.max(200), productDisplayName: web3Text.nullable(), productIsActive: z.boolean() }).strict();
export const receiptDetailSchema = z.object({
  receiptId: web3LongId, receiptNumber: z.string().refine(v => /^GR[0-9]{10}$/.test(v) && BigInt(v.slice(2)) > 0n, { abort: true }), receiptDate: web3Date,
  warehouseId: web3IntId, warehouseDisplayName: web3Text.nullable(), warehouseIsActive: z.boolean(),
  employeeId: web3IntId, employeeDisplayName: web3Text.nullable(), employeeIsActive: z.boolean(),
  status, note: web3Text.max(1000).nullable(), postedAtUtc: web3Utc.nullable(), version: web3Version,
  lines: z.array(lineSchema).min(1).max(200),
}).strict().superRefine((v, ctx) => {
  if (new Set(v.lines.map(line => line.productId)).size !== v.lines.length || new Set(v.lines.map(line => line.receiptLineId)).size !== v.lines.length || v.lines.some((line, i) => line.lineNumber !== i + 1)) ctx.addIssue({ code: "custom", message: "Invalid product, line identity or order" });
  if (v.status === "Draft" ? v.postedAtUtc !== null : v.postedAtUtc === null) ctx.addIssue({ code: "custom", message: "Invalid posting timestamp for status" });
});
export type ReceiptWireDetail = z.infer<typeof receiptDetailSchema>;
export const receiptPageSchema = web3Page(receiptDetailSchema, v => v.receiptId, (a, b) => a.receiptDate > b.receiptDate || (a.receiptDate === b.receiptDate && BigInt(a.receiptId) > BigInt(b.receiptId)), true);
export const receiptPostAcknowledgementSchema = z.object({ receiptId: web3LongId, status: z.literal("Posted"), postedAtUtc: web3Utc }).strict();
export const receiptListQuerySchema = z.object({ ...pagingShape, warehouseId: web3IntId.optional(), status: status.optional(), search: web3Text.max(128).optional() }).strict();
