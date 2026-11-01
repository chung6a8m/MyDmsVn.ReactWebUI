import { z } from "./cspZod";
import { wellFormedText } from "./strictJson";

export const web3Text = z.string().refine(v => wellFormedText(v) && !v.includes("\0"));
export const web3IntId = z.number().int().min(1).max(2147483647);
export const internalCatalogId = z.string().regex(/^[1-9][0-9]*$/).max(10).transform(Number).pipe(web3IntId);
export const web3LongId = z.string().refine(v => v.length <= 19 && /^[1-9][0-9]*$/.test(v) && BigInt(v) <= 9223372036854775807n, { abort: true });
export const web3Count = z.string().refine(v => v.length <= 19 && /^(?:0|[1-9][0-9]*)$/.test(v) && BigInt(v) <= 9223372036854775807n, { abort: true });
export function scaledDecimal(value: string, scale: number): bigint {
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const magnitude = BigInt(whole + fraction.padEnd(scale, "0"));
  return value.startsWith("-") ? -magnitude : magnitude;
}
function decimal(precision: number, scale: number, signed = false, positive = false) {
  const pattern = new RegExp(`^${signed ? "-?" : ""}[0-9]+(?:\\.[0-9]{1,${scale}})?$`);
  return z.string().refine(value => {
    if (value.length > 64 || !pattern.test(value)) return false;
    const amount = scaledDecimal(value, scale), magnitude = amount < 0n ? -amount : amount;
    return magnitude <= 10n ** BigInt(precision) - 1n && (!positive || amount > 0n) && !(value.startsWith("-") && magnitude === 0n);
  }, { abort: true });
}
function calendar(value: string, allowDefault = false) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] && (allowDefault || value !== "0001-01-01");
}
export const web3Date = z.string().refine(v => calendar(v));
export const web3Utc = z.string().refine(v => /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,7})?Z$/.test(v) && calendar(v.slice(0, 10), true) && Number(v.slice(11, 13)) < 24 && Number(v.slice(14, 16)) < 60 && Number(v.slice(17, 19)) < 60);
export function utcOrder(value: string) { return value.slice(0, 19) + "." + value.slice(19, -1).replace(/^\./, "").padEnd(7, "0"); }
export const web3Version = z.string().refine(v => {
  if (!/^[A-Za-z0-9+/]{11}=$/.test(v)) return false;
  try { const raw = atob(v); return raw.length === 8 && btoa(raw) === v; } catch { return false; }
});
export const web3Quantity = decimal(18, 4, false, true);
export const web3UnitCost = decimal(19, 4);
export const web3Amount = decimal(28, 4);
export const web3BalanceQuantity = decimal(18, 4);
export const web3Average = decimal(28, 8);
export const web3SignedQuantity = decimal(18, 4, true);
export const web3SignedAmount = decimal(28, 4, true);
export const web3ErrorEnvelopeSchema = z.object({ error: z.object({
  code: web3Text, message: web3Text,
  details: z.array(z.object({ code: web3Text, message: web3Text, field: z.string().regex(/^[a-z][A-Za-z0-9]*(?:\[[0-9]+\])?(?:\.[a-z][A-Za-z0-9]*(?:\[[0-9]+\])?)*$/).optional() }).strict()),
  correlationId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
}).strict() }).strict().refine(v => !["Auth.Unauthorized", "Auth.Forbidden", "Auth.RateLimited", "InternalError"].includes(v.error.code) || v.error.details.length === 0);
export const pagingShape = { pageNumber: web3IntId, pageSize: web3IntId.max(200) };
export function web3Page<T extends z.ZodType>(row: T, identity: (row: z.infer<T>) => string, ordered?: (previous: z.infer<T>, current: z.infer<T>) => boolean, countConsistent = false) {
  return z.object({ items: z.array(row), ...pagingShape, totalCount: web3Count }).strict().superRefine((v, ctx) => {
    if (v.items.length > v.pageSize || new Set(v.items.map(identity)).size !== v.items.length || (countConsistent && BigInt(v.items.length) > BigInt(v.totalCount)) || (ordered && v.items.some((row, index) => index > 0 && !ordered(v.items[index - 1], row)))) ctx.addIssue({ code: "custom", message: "Invalid page cardinality, identity or order" });
  });
}
export function serializeWeb3Query<T extends z.ZodType>(schema: T, query: object): string {
  const wire: Record<string, unknown> = { ...query };
  for (const key of ["warehouseId", "productId"]) if (wire[key] !== undefined) wire[key] = internalCatalogId.parse(wire[key]);
  const parsed = schema.parse(wire) as Record<string, string | number | undefined>;
  const values = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed)) if (value !== undefined) values.set(key, String(value));
  return values.toString();
}
