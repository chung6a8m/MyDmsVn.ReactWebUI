import type { SalesDocument, SalesSaveSnapshot, PostAcknowledgement } from "../../features/sales/contracts";
import type { GoodsReceiptDocument, GoodsReceiptSaveSnapshot, GoodsReceiptPostAcknowledgement } from "../../features/goodsReceipt/contracts";
import type { SalesSession } from "../../features/sales/salesSessionStore";
import type { GoodsReceiptSession } from "../../features/goodsReceipt/goodsReceiptSessionStore";
import type { LookupValue } from "../../shared/lookup/lookupTypes";
import { z } from "../http/cspZod";
import { amountSchema, priceSchema, profitSchema, quantitySchema, saleDateSchema, unitCostSchema } from "../http/salesWireSchemas";
import { web3BalanceQuantity, web3Date, web3IntId, web3LongId, web3Quantity, web3Text, web3UnitCost, web3Utc, web3Version } from "../http/web3WireSchemas";

interface SnapshotBuffers {
  serverId: string | null;
  rawBuffers: Record<string, { raw: string; composing: boolean }>;
  lookupBuffers: Record<string, LookupValue>;
  dirty: boolean;
}
export type SalesDraftSnapshot = SnapshotBuffers & {
  feature: "sales";
  draft: SalesSaveSnapshot;
  baseline: SalesDocument | null;
  initialDraft: SalesSaveSnapshot | null;
  postAcknowledgement: PostAcknowledgement | null;
};
export type GoodsReceiptDraftSnapshot = SnapshotBuffers & {
  feature: "goods-receipt";
  draft: GoodsReceiptSaveSnapshot;
  baseline: GoodsReceiptDocument | null;
  initialDraft: GoodsReceiptSaveSnapshot | null;
  postAcknowledgement: GoodsReceiptPostAcknowledgement | null;
};
export type FeatureDraftSnapshot = SalesDraftSnapshot | GoodsReceiptDraftSnapshot;

// Zod 4.6.7 .max() counts code points; this local contract counts UTF-16 units.
const text = z.string().refine(value => value.length <= 16_384);
const clientLineId = text.min(1);
// Keep numeric identities as strings throughout local capture and decoding.
const catalogId = z.string().refine(value => value.length <= 10 && /^[1-9][0-9]*$/.test(value) && BigInt(value) <= 2147483647n);
const incompleteCatalogId = z.union([z.literal(""), catalogId]);
const rawBuffer = z.object({ raw: text, composing: z.boolean() }).strict();
const lookupBuffer = z.object({ selectedId: catalogId.nullable(), displayText: text, query: text, confirmed: z.boolean(), composing: z.boolean() }).strict();
function bufferRecord<T extends z.ZodType>(schema: T) {
  // Zod records deliberately skip __proto__; local decoding must reject it,
  // not silently omit an unowned persisted field before the ownership check.
  return z.unknown().refine(value => typeof value === "object" && value !== null && !Object.hasOwn(value, "__proto__"))
    .pipe(z.record(text, schema));
}
const commonShape = {
  serverId: web3LongId.nullable(),
  rawBuffers: bufferRecord(rawBuffer),
  lookupBuffers: bufferRecord(lookupBuffer),
  dirty: z.boolean(),
};
const salesLineShape = {
  clientLineId, saleLineId: web3LongId.nullable(), productId: catalogId.nullable(),
  qty: web3BalanceQuantity, unitPrice: priceSchema.max(64), isGift: z.boolean(),
};
const salesLine = z.object(salesLineShape).strict();
const salesDraftShape = {
  saleId: web3LongId.nullable(), expectedVersion: web3Version.nullable(),
  saleDate: z.union([z.literal(""), saleDateSchema]),
  customerId: incompleteCatalogId, warehouseId: incompleteCatalogId, employeeId: incompleteCatalogId,
  note: text, lines: z.array(salesLine).max(200),
};
const salesDraft = z.object(salesDraftShape).strict();
const savedSalesLine = z.object({ ...salesLineShape, saleLineId: web3LongId, productId: catalogId, qty: quantitySchema.max(64) }).strict();
const savedSalesDraft = z.object({
  ...salesDraftShape, saleId: web3LongId, expectedVersion: web3Version, saleDate: saleDateSchema,
  customerId: catalogId, warehouseId: catalogId, employeeId: catalogId, note: web3Text.refine(value => value.length <= 1000),
  lines: z.array(savedSalesLine).min(1).max(200),
}).strict();
const salesReference = z.object({ id: catalogId, code: text, name: text, isActive: z.boolean().nullable() }).strict();
const salesBaseline = z.object({
  saleId: web3LongId, saleNumber: text, version: web3Version, status: z.enum(["Draft", "Posted"]),
  postedAtUtc: web3Utc.nullable().optional(), saved: savedSalesDraft,
  references: z.object({ customer: salesReference, warehouse: salesReference, employee: salesReference }).strict(),
  lines: z.array(savedSalesLine.extend({ product: salesReference, unit: text, lineAmount: amountSchema.max(64),
    costAmount: amountSchema.max(64).nullable(), postedUnitCost: unitCostSchema.max(64).nullable().optional() }).strict()).min(1).max(200),
  totalAmount: amountSchema.max(64), totalCost: amountSchema.max(64).nullable(), grossProfit: profitSchema.max(64).nullable(),
}).strict();
const receiptLineShape = {
  clientLineId, receiptLineId: web3LongId.nullable(), productId: catalogId.nullable(), quantity: web3BalanceQuantity, unitCost: web3UnitCost,
};
const receiptLine = z.object(receiptLineShape).strict();
const receiptDraftShape = {
  receiptId: web3LongId.nullable(), expectedVersion: web3Version.nullable(),
  receiptDate: z.union([z.literal(""), web3Date]), warehouseId: incompleteCatalogId, employeeId: incompleteCatalogId,
  note: text.nullable(), lines: z.array(receiptLine).max(200),
};
const receiptDraft = z.object(receiptDraftShape).strict();
const savedReceiptLine = z.object({ ...receiptLineShape, receiptLineId: web3LongId, productId: catalogId, quantity: web3Quantity }).strict();
const savedReceiptDraft = z.object({
  ...receiptDraftShape, receiptId: web3LongId, expectedVersion: web3Version, receiptDate: web3Date,
  warehouseId: catalogId, employeeId: catalogId, note: web3Text.refine(value => value.length <= 1000).nullable(),
  lines: z.array(savedReceiptLine).min(1).max(200),
}).strict();
const receiptReference = z.object({ id: catalogId, displayName: web3Text.refine(value => value.length <= 16_384).nullable(), isActive: z.boolean() }).strict();
const receiptBaseline = z.object({
  receiptId: web3LongId, receiptNumber: z.string().refine(value => /^GR[0-9]{10}$/.test(value) && BigInt(value.slice(2)) > 0n),
  version: web3Version, status: z.enum(["Draft", "Posted"]), postedAtUtc: web3Utc.nullable(), saved: savedReceiptDraft,
  references: z.object({ warehouse: receiptReference, employee: receiptReference }).strict(),
  lines: z.array(savedReceiptLine.extend({ lineNumber: web3IntId.max(200), product: receiptReference }).strict()).min(1).max(200),
}).strict();
const salesPost = z.object({ saleId: web3LongId, status: z.literal("Posted"), postedAtUtc: web3Utc, version: web3Version }).strict();
const receiptPost = z.object({ receiptId: web3LongId, status: z.literal("Posted"), postedAtUtc: web3Utc }).strict();

function uniqueLines(lines: readonly { clientLineId: string }[]) {
  return new Set(lines.map(line => line.clientLineId)).size === lines.length;
}
function uniqueServerLines(ids: readonly (string | null)[]) {
  const saved = ids.filter(id => id !== null);
  return new Set(saved).size === saved.length;
}
function sameSalesLine(a: SalesSaveSnapshot["lines"][number], b: SalesSaveSnapshot["lines"][number]) {
  return a.clientLineId === b.clientLineId && a.saleLineId === b.saleLineId && a.productId === b.productId && a.qty === b.qty && a.unitPrice === b.unitPrice && a.isGift === b.isGift;
}
function sameReceiptLine(a: GoodsReceiptSaveSnapshot["lines"][number], b: GoodsReceiptSaveSnapshot["lines"][number]) {
  return a.clientLineId === b.clientLineId && a.receiptLineId === b.receiptLineId && a.productId === b.productId && a.quantity === b.quantity && a.unitCost === b.unitCost;
}
function buffersBelong(snapshot: FeatureDraftSnapshot) {
  const headers = snapshot.feature === "sales" ? ["customerId", "warehouseId", "employeeId"] : ["warehouseId", "employeeId"];
  const decimalFields = snapshot.feature === "sales" ? ["qty", "unitPrice"] : ["quantity", "unitCost"];
  const lookupKeys = new Set([...headers, ...snapshot.draft.lines.map(line => `product:${line.clientLineId}`)]);
  const rawKeys = new Set([...lookupKeys, "note", snapshot.feature === "sales" ? "saleDate" : "receiptDate",
    ...snapshot.draft.lines.flatMap(line => decimalFields.map(field => `${field}:${line.clientLineId}`))]);
  return Object.keys(snapshot.rawBuffers).every(key => rawKeys.has(key)) && Object.keys(snapshot.lookupBuffers).every(key => lookupKeys.has(key));
}
function salesCoherent(value: SalesDraftSnapshot) {
  const { draft, baseline, initialDraft, postAcknowledgement, serverId } = value;
  if (draft.saleId !== serverId || draft.expectedVersion !== (baseline?.version ?? null) || (baseline?.saleId ?? null) !== serverId) return false;
  if (!uniqueLines(draft.lines) || !uniqueServerLines(draft.lines.map(line => line.saleLineId))) return false;
  if (initialDraft && (initialDraft.saleId !== null || initialDraft.expectedVersion !== null || !uniqueLines(initialDraft.lines) || initialDraft.lines.some(line => line.saleLineId !== null))) return false;
  if (postAcknowledgement && postAcknowledgement.saleId !== serverId) return false;
  const baselineLines = new Map(baseline?.saved.lines.map(line => [line.clientLineId, line]));
  if (draft.lines.some(line => {
    const saved = baselineLines.get(line.clientLineId);
    return saved ? line.saleLineId !== saved.saleLineId : line.saleLineId !== null;
  })) return false;
  if (!baseline) return true;
  if (baseline.saved.saleId !== serverId || baseline.saved.expectedVersion !== baseline.version ||
    !uniqueLines(baseline.saved.lines) || !uniqueServerLines(baseline.saved.lines.map(line => line.saleLineId)) ||
    baseline.lines.length !== baseline.saved.lines.length || baseline.lines.some((line, index) => !sameSalesLine(line, baseline.saved.lines[index]) || line.product.id !== line.productId) ||
    baseline.references.customer.id !== baseline.saved.customerId || baseline.references.warehouse.id !== baseline.saved.warehouseId || baseline.references.employee.id !== baseline.saved.employeeId) return false;
  const postedValues = [baseline.postedAtUtc, baseline.totalCost, baseline.grossProfit, ...baseline.lines.flatMap(line => [line.costAmount, line.postedUnitCost])];
  return baseline.status === "Posted" ? postedValues.every(value => value != null) : postedValues.every(value => value == null);
}
function receiptCoherent(value: GoodsReceiptDraftSnapshot) {
  const { draft, baseline, initialDraft, postAcknowledgement, serverId } = value;
  if (draft.receiptId !== serverId || draft.expectedVersion !== (baseline?.version ?? null) || (baseline?.receiptId ?? null) !== serverId) return false;
  if (!uniqueLines(draft.lines) || !uniqueServerLines(draft.lines.map(line => line.receiptLineId))) return false;
  if (initialDraft && (initialDraft.receiptId !== null || initialDraft.expectedVersion !== null || !uniqueLines(initialDraft.lines) || initialDraft.lines.some(line => line.receiptLineId !== null))) return false;
  if (postAcknowledgement && postAcknowledgement.receiptId !== serverId) return false;
  const baselineLines = new Map(baseline?.saved.lines.map(line => [line.clientLineId, line]));
  if (draft.lines.some(line => {
    const saved = baselineLines.get(line.clientLineId);
    return saved ? line.receiptLineId !== saved.receiptLineId : line.receiptLineId !== null;
  })) return false;
  if (!baseline) return true;
  return baseline.saved.receiptId === serverId && baseline.saved.expectedVersion === baseline.version &&
    uniqueLines(baseline.saved.lines) && uniqueServerLines(baseline.saved.lines.map(line => line.receiptLineId)) &&
    new Set(baseline.saved.lines.map(line => line.productId)).size === baseline.saved.lines.length &&
    baseline.lines.length === baseline.saved.lines.length && baseline.lines.every((line, index) => sameReceiptLine(line, baseline.saved.lines[index]) && line.lineNumber === index + 1 && line.product.id === line.productId) &&
    baseline.references.warehouse.id === baseline.saved.warehouseId && baseline.references.employee.id === baseline.saved.employeeId &&
    (baseline.status === "Posted" ? baseline.postedAtUtc !== null : baseline.postedAtUtc === null);
}

// Local shape and ownership validation only. Current server truth and Save/Post
// business validation must still be established by the authenticated runtime.
export const featureDraftSnapshotSchema = z.discriminatedUnion("feature", [
  z.object({ ...commonShape, feature: z.literal("sales"), draft: salesDraft, baseline: salesBaseline.nullable(), initialDraft: salesDraft.nullable(), postAcknowledgement: salesPost.nullable() }).strict(),
  z.object({ ...commonShape, feature: z.literal("goods-receipt"), draft: receiptDraft, baseline: receiptBaseline.nullable(), initialDraft: receiptDraft.nullable(), postAcknowledgement: receiptPost.nullable() }).strict(),
]).refine(value => buffersBelong(value) && (value.feature === "sales" ? salesCoherent(value) : receiptCoherent(value)), { message: "Inconsistent local draft ownership." }) satisfies z.ZodType<FeatureDraftSnapshot>;

export class FeatureDraftSnapshotError extends Error {
  constructor() { super("Invalid local feature draft snapshot."); this.name = "FeatureDraftSnapshotError"; }
}
export function decodeFeatureDraft(value: unknown): FeatureDraftSnapshot {
  const result = featureDraftSnapshotSchema.safeParse(value);
  if (!result.success) throw new FeatureDraftSnapshotError();
  return result.data;
}
export const parseFeatureDraftSnapshot = decodeFeatureDraft;

function captureSalesLine(line: SalesSaveSnapshot["lines"][number]) {
  return { clientLineId: line.clientLineId, saleLineId: line.saleLineId, productId: line.productId, qty: line.qty, unitPrice: line.unitPrice, isGift: line.isGift };
}
function captureSalesSnapshot(draft: SalesSaveSnapshot) {
  return { saleId: draft.saleId, expectedVersion: draft.expectedVersion, saleDate: draft.saleDate,
    customerId: draft.customerId, warehouseId: draft.warehouseId, employeeId: draft.employeeId, note: draft.note, lines: draft.lines.map(captureSalesLine) };
}
function captureSalesReference(reference: SalesDocument["references"]["customer"]) {
  return { id: reference.id, code: reference.code, name: reference.name, isActive: reference.isActive };
}
function captureSalesBaseline(baseline: SalesDocument) {
  return { saleId: baseline.saleId, saleNumber: baseline.saleNumber, version: baseline.version, status: baseline.status,
    ...(baseline.postedAtUtc === undefined ? {} : { postedAtUtc: baseline.postedAtUtc }), saved: captureSalesSnapshot(baseline.saved),
    references: { customer: captureSalesReference(baseline.references.customer), warehouse: captureSalesReference(baseline.references.warehouse), employee: captureSalesReference(baseline.references.employee) },
    lines: baseline.lines.map(line => ({ ...captureSalesLine(line), product: captureSalesReference(line.product), unit: line.unit, lineAmount: line.lineAmount,
      costAmount: line.costAmount, ...(line.postedUnitCost === undefined ? {} : { postedUnitCost: line.postedUnitCost }) })),
    totalAmount: baseline.totalAmount, totalCost: baseline.totalCost, grossProfit: baseline.grossProfit };
}
function captureReceiptLine(line: GoodsReceiptSaveSnapshot["lines"][number]) {
  return { clientLineId: line.clientLineId, receiptLineId: line.receiptLineId, productId: line.productId, quantity: line.quantity, unitCost: line.unitCost };
}
function captureReceiptSnapshot(draft: GoodsReceiptSaveSnapshot) {
  return { receiptId: draft.receiptId, expectedVersion: draft.expectedVersion, receiptDate: draft.receiptDate,
    warehouseId: draft.warehouseId, employeeId: draft.employeeId, note: draft.note, lines: draft.lines.map(captureReceiptLine) };
}
function captureReceiptReference(reference: GoodsReceiptDocument["references"]["warehouse"]) {
  return { id: reference.id, displayName: reference.displayName, isActive: reference.isActive };
}
function captureReceiptBaseline(baseline: GoodsReceiptDocument) {
  return { receiptId: baseline.receiptId, receiptNumber: baseline.receiptNumber, version: baseline.version, status: baseline.status, postedAtUtc: baseline.postedAtUtc,
    saved: captureReceiptSnapshot(baseline.saved), references: { warehouse: captureReceiptReference(baseline.references.warehouse), employee: captureReceiptReference(baseline.references.employee) },
    lines: baseline.lines.map(line => ({ ...captureReceiptLine(line), lineNumber: line.lineNumber, product: captureReceiptReference(line.product) })) };
}
function captureBuffers(session: SalesSession | GoodsReceiptSession) {
  return { dirty: session.dirty,
    rawBuffers: Object.fromEntries(Object.entries(session.rawBuffers).map(([field, value]) => [field, { raw: value.raw, composing: value.composing }])),
    lookupBuffers: Object.fromEntries(Object.entries(session.lookupBuffers ?? {}).map(([field, value]) => [field, {
      selectedId: value.selectedId, displayText: value.displayText, query: value.query, confirmed: value.confirmed, composing: value.composing,
    }])) };
}
export function captureSalesDraft(session: SalesSession): SalesDraftSnapshot | null {
  if (!session.draft) return null;
  const ack = session.postAcknowledgement;
  return decodeFeatureDraft({ feature: "sales", serverId: session.saleId, draft: captureSalesSnapshot(session.draft),
    baseline: session.baseline ? captureSalesBaseline(session.baseline) : null,
    initialDraft: session.initialDraft ? captureSalesSnapshot(session.initialDraft) : null,
    ...captureBuffers(session), postAcknowledgement: ack ? { saleId: ack.saleId, status: ack.status, postedAtUtc: ack.postedAtUtc, version: ack.version } : null,
  }) as SalesDraftSnapshot;
}
export function captureGoodsReceiptDraft(session: GoodsReceiptSession): GoodsReceiptDraftSnapshot | null {
  if (!session.draft) return null;
  const ack = session.postAcknowledgement;
  return decodeFeatureDraft({ feature: "goods-receipt", serverId: session.receiptId, draft: captureReceiptSnapshot(session.draft),
    baseline: session.baseline ? captureReceiptBaseline(session.baseline) : null,
    initialDraft: session.initialDraft ? captureReceiptSnapshot(session.initialDraft) : null,
    ...captureBuffers(session), postAcknowledgement: ack ? { receiptId: ack.receiptId, status: ack.status, postedAtUtc: ack.postedAtUtc } : null,
  }) as GoodsReceiptDraftSnapshot;
}
export function captureFeatureDraft(feature: "sales", session: SalesSession): SalesDraftSnapshot | null;
export function captureFeatureDraft(feature: "goods-receipt", session: GoodsReceiptSession): GoodsReceiptDraftSnapshot | null;
export function captureFeatureDraft(feature: "sales" | "goods-receipt", session: SalesSession | GoodsReceiptSession): FeatureDraftSnapshot | null;
export function captureFeatureDraft(feature: "sales" | "goods-receipt", session: SalesSession | GoodsReceiptSession): FeatureDraftSnapshot | null {
  if (feature === "sales" && "saleId" in session) return captureSalesDraft(session);
  if (feature === "goods-receipt" && "receiptId" in session) return captureGoodsReceiptDraft(session);
  throw new FeatureDraftSnapshotError();
}
