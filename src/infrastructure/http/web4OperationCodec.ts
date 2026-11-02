import type { SalesSaveSnapshot } from "../../features/sales/contracts";
import type { GoodsReceiptSaveSnapshot } from "../../features/goodsReceipt/contracts";
import { z } from "./cspZod";
import { deploymentEpochSchema } from "./operationsContext";
import { mapSaveInput } from "./salesWireMapper";
import { mapGoodsReceiptSaveInput } from "./goodsReceiptWireMapper";
import { wellFormedText } from "./strictJson";
import { scaledDecimal, web3Date, web3IntId, web3LongId, web3Quantity, web3Text, web3UnitCost, web3Version } from "./web3WireSchemas";

// B01 1c603c6 / B04 bd871518: these are wire commands, never UI snapshots.
export const web4OperationIdSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export const web4FingerprintSchema = z.string().regex(/^[0-9a-f]{64}$/);
const actorSchema = z.string().regex(/^[1-9][0-9]{0,9}$/).refine(value => Number(value) <= 2147483647);
const noteSchema = web3Text.refine(value => value.length <= 1000).nullable().optional();
function normalizedSalesVersion(value: string): string {
  const compact = value.replace(/[ \t\r\n]/g, "");
  if (value.length > 128 || !/^[A-Za-z0-9+/]{11}=$/.test(compact)) throw new Web4OperationCodecError();
  const bytes = atob(compact);
  if (bytes.length !== 8) throw new Web4OperationCodecError();
  return btoa(bytes);
}
const salesVersion = web3Text.refine(value => { try { normalizedSalesVersion(value); return true; } catch { return false; } });
const salesLine = z.object({ saleLineId: z.union([z.literal("0"), web3LongId]), productId: web3IntId, qty: web3Quantity, unitPrice: web3UnitCost, isGift: z.boolean() }).strict();
const salesSave = { saleDate: web3Date, customerId: web3IntId, warehouseId: web3IntId, employeeId: web3IntId, note: noteSchema, lines: z.array(salesLine).min(1).max(200) };
// Duplicate Receipt products remain Application validation in B04 wire input.
const receiptSave = { receiptDate: web3Date, warehouseId: web3IntId, employeeId: web3IntId, note: noteSchema,
  lines: z.array(z.object({ productId: web3IntId, quantity: web3Quantity, unitCost: web3UnitCost }).strict()).min(1).max(200) };
const requestSchema = z.discriminatedUnion("operationKind", [
  z.object({ operationKind: z.literal("Sales.Create"), method: z.literal("POST"), routeScope: z.literal("/api/v1/sales-receipts"), requestTargetId: z.null(), body: z.object(salesSave).strict().refine(body => body.lines.every(line => line.saleLineId === "0")) }).strict(),
  z.object({ operationKind: z.literal("Sales.Update"), method: z.literal("PUT"), routeScope: z.literal("/api/v1/sales-receipts/{saleId}/draft"), requestTargetId: web3LongId, body: z.object({ ...salesSave, expectedVersion: salesVersion }).strict() }).strict(),
  z.object({ operationKind: z.literal("Sales.Post"), method: z.literal("POST"), routeScope: z.literal("/api/v1/sales-receipts/{saleId}/post"), requestTargetId: web3LongId, body: z.object({ expectedVersion: salesVersion }).strict() }).strict(),
  z.object({ operationKind: z.literal("Receipt.Create"), method: z.literal("POST"), routeScope: z.literal("/api/v1/goods-receipts"), requestTargetId: z.null(), body: z.object(receiptSave).strict() }).strict(),
  z.object({ operationKind: z.literal("Receipt.Update"), method: z.literal("PUT"), routeScope: z.literal("/api/v1/goods-receipts/{receiptId}/draft"), requestTargetId: web3LongId, body: z.object({ ...receiptSave, expectedVersion: web3Version }).strict() }).strict(),
  z.object({ operationKind: z.literal("Receipt.Post"), method: z.literal("POST"), routeScope: z.literal("/api/v1/goods-receipts/{receiptId}/post"), requestTargetId: web3LongId, body: z.object({ expectedVersion: web3Version }).strict() }).strict(),
]);
export type Web4WireIntent = z.infer<typeof requestSchema>;
export type Web4OperationKind = Web4WireIntent["operationKind"];
export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
const identitySchema = z.object({ operationId: web4OperationIdSchema, deploymentEpoch: deploymentEpochSchema, actorKey: actorSchema }).strict();
const frozenSchema = identitySchema.extend({ schemaVersion: z.literal(1), requestFingerprint: web4FingerprintSchema, request: requestSchema }).strict();
// Structural inspection for synchronous IDB guards only; accepting or using a
// persisted intent still requires decodeFrozenWeb4Operation and a fresh hash.
export const frozenWeb4OperationSchema = frozenSchema;
export type FrozenWeb4Operation = DeepReadonly<z.infer<typeof frozenSchema>>;
export class Web4OperationCodecError extends Error {
  constructor() { super("Invalid immutable WEB4 operation."); this.name = "Web4OperationCodecError"; }
}

function jsonValue(value: unknown, depth = 0): void {
  if (depth > 15) throw new Web4OperationCodecError();
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "string") { if (!wellFormedText(value)) throw new Web4OperationCodecError(); return; }
  if (typeof value === "number") { if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new Web4OperationCodecError(); return; }
  if (typeof value !== "object") throw new Web4OperationCodecError();
  if (Array.isArray(value)) { for (const item of value) jsonValue(item, depth + 1); return; }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Web4OperationCodecError();
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== "string" || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) throw new Web4OperationCodecError();
    jsonValue(descriptor.value, depth + 1);
  }
}
export function parseWeb4WireIntent(value: unknown): Web4WireIntent {
  try {
    jsonValue(value);
    const parsed = requestSchema.parse(value);
    // B04 WebHostOptions defaults to this maximum; the host may configure less.
    if (new TextEncoder().encode(JSON.stringify(parsed.body)).byteLength > 1_048_576) throw new Web4OperationCodecError();
    return parsed;
  } catch { throw new Web4OperationCodecError(); }
}
function fixed4(value: string): string {
  const scaled = scaledDecimal(value, 4);
  return `${scaled / 10_000n}.${(scaled % 10_000n).toString().padStart(4, "0")}`;
}
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function canonicalizeWeb4Request(value: unknown): string {
  const request = parseWeb4WireIntent(value);
  const body = request.body;
  if ("lines" in body) {
    body.note = body.note ?? null;
    for (const line of body.lines) {
      if ("qty" in line) { line.qty = fixed4(line.qty); line.unitPrice = fixed4(line.unitPrice); }
      else { line.quantity = fixed4(line.quantity); line.unitCost = fixed4(line.unitCost); }
    }
  }
  if (request.operationKind.startsWith("Sales.") && "expectedVersion" in body) body.expectedVersion = normalizedSalesVersion(body.expectedVersion);
  return canonicalJson({ contract: "web4-v1", ...request });
}
export async function fingerprintWeb4Request(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalizeWeb4Request(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
function freeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) freeze(nested);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}
export async function freezeWeb4Operation(value: unknown, identity: z.infer<typeof identitySchema>): Promise<FrozenWeb4Operation> {
  const request = parseWeb4WireIntent(value);
  const scope = identitySchema.parse(identity);
  const requestFingerprint = await fingerprintWeb4Request(request);
  return freeze({ schemaVersion: 1 as const, ...scope, requestFingerprint, request });
}
export async function decodeFrozenWeb4Operation(value: unknown): Promise<FrozenWeb4Operation> {
  try {
    jsonValue(value);
    const parsed = frozenSchema.parse(value);
    const request = parseWeb4WireIntent(parsed.request);
    const fingerprint = await fingerprintWeb4Request(request);
    if (fingerprint !== parsed.requestFingerprint) throw new Web4OperationCodecError();
    return freeze({ ...parsed, request });
  } catch { throw new Web4OperationCodecError(); }
}
export function web4OperationPath(value: unknown): string {
  const request = parseWeb4WireIntent(value);
  return request.routeScope.replace("{saleId}", request.requestTargetId ?? "").replace("{receiptId}", request.requestTargetId ?? "");
}
export function salesSaveOperationRequest(snapshot: SalesSaveSnapshot): Web4WireIntent {
  const body = mapSaveInput(snapshot);
  if (snapshot.saleId === null) {
    if (snapshot.expectedVersion !== null) throw new Web4OperationCodecError();
    return parseWeb4WireIntent({ operationKind: "Sales.Create", method: "POST", routeScope: "/api/v1/sales-receipts", requestTargetId: null, body });
  }
  return parseWeb4WireIntent({ operationKind: "Sales.Update", method: "PUT", routeScope: "/api/v1/sales-receipts/{saleId}/draft", requestTargetId: snapshot.saleId, body: { ...body, expectedVersion: snapshot.expectedVersion } });
}
export function salesPostOperationRequest(input: { saleId: string; expectedVersion: string }): Web4WireIntent {
  return parseWeb4WireIntent({ operationKind: "Sales.Post", method: "POST", routeScope: "/api/v1/sales-receipts/{saleId}/post", requestTargetId: input.saleId, body: { expectedVersion: input.expectedVersion } });
}
export function receiptSaveOperationRequest(snapshot: GoodsReceiptSaveSnapshot): Web4WireIntent {
  const body = mapGoodsReceiptSaveInput(snapshot);
  if (snapshot.receiptId === null) {
    if (snapshot.expectedVersion !== null) throw new Web4OperationCodecError();
    return parseWeb4WireIntent({ operationKind: "Receipt.Create", method: "POST", routeScope: "/api/v1/goods-receipts", requestTargetId: null, body });
  }
  return parseWeb4WireIntent({ operationKind: "Receipt.Update", method: "PUT", routeScope: "/api/v1/goods-receipts/{receiptId}/draft", requestTargetId: snapshot.receiptId, body: { ...body, expectedVersion: snapshot.expectedVersion } });
}
export function receiptPostOperationRequest(input: { receiptId: string; expectedVersion: string }): Web4WireIntent {
  return parseWeb4WireIntent({ operationKind: "Receipt.Post", method: "POST", routeScope: "/api/v1/goods-receipts/{receiptId}/post", requestTargetId: input.receiptId, body: { expectedVersion: input.expectedVersion } });
}
