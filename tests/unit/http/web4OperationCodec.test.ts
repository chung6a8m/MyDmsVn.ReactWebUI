import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import vectors from "../../fixtures/web4-v1/corpus/fingerprint-vectors.json";
import {
  canonicalizeWeb4Request, decodeFrozenWeb4Operation, fingerprintWeb4Request, freezeWeb4Operation,
  parseWeb4WireIntent, receiptPostOperationRequest, receiptSaveOperationRequest, salesPostOperationRequest, salesSaveOperationRequest, web4OperationPath,
} from "../../../src/infrastructure/http/web4OperationCodec";
import { mapSalesDetail } from "../../../src/infrastructure/http/salesWireMapper";
import { mapGoodsReceiptDetail } from "../../../src/infrastructure/http/goodsReceiptWireMapper";
import { salesDetailSchema } from "../../../src/infrastructure/http/salesWireSchemas";
import { receiptDetailSchema } from "../../../src/infrastructure/http/goodsReceiptWireSchemas";
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/web4-v1/corpus/${name}.json`, import.meta.url), "utf8"));
const identity = { operationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", deploymentEpoch: "11111111-2222-4333-8444-555555555555", actorKey: "42" };

describe("production WEB4 immutable wire intent", () => {
  it.each(vectors.vectors)("matches independent B01 bytes and SHA256: $name", async vector => {
    expect(canonicalizeWeb4Request(vector.intent)).toBe(vector.canonical);
    expect(await fingerprintWeb4Request(vector.intent)).toBe(vector.sha256);
  });

  it("deep freezes original lexemes while canonical-equivalent versions hash identically", async () => {
    const source = structuredClone(vectors.vectors.find(vector => vector.name === "sales-version-whitespace-equivalent")!.intent);
    const originalVersion = source.body.expectedVersion;
    const frozen = await freezeWeb4Operation(source, identity);
    source.body.expectedVersion = "AAAAAAAAAAM=";
    expect(frozen.request.body).toHaveProperty("expectedVersion", originalVersion);
    expect(Object.isFrozen(frozen.request.body)).toBe(true);
    expect(() => Object.assign(frozen.request.body, { expectedVersion: "AAAAAAAAAAM=" })).toThrow();
    expect(await decodeFrozenWeb4Operation(JSON.parse(JSON.stringify(frozen)))).toEqual(frozen);
  });

  it.each(["requestFingerprint", "body", "missing-body", "header", "actor", "operation", "future-version"])("refuses corrupted durable intent: %s", async change => {
    const frozen = structuredClone(await freezeWeb4Operation(fixture("sales-create-intent"), identity)) as Record<string, any>;
    if (change === "requestFingerprint") frozen.requestFingerprint = "0".repeat(64);
    if (change === "body") frozen.request.body.note = "changed";
    if (change === "missing-body") delete frozen.request.body;
    if (change === "header") frozen.headers = { Authorization: "secret" };
    if (change === "actor") frozen.actorKey = "042";
    if (change === "operation") frozen.operationId = "aaaaaaaa-bbbb-1ccc-8ddd-eeeeeeeeeeee";
    if (change === "future-version") frozen.schemaVersion = 2;
    await expect(decodeFrozenWeb4Operation(frozen)).rejects.toThrow();
  });

  it.each([
    ["unknown command field", (value: any) => { value.authorization = "secret"; }],
    ["route alias", (value: any) => { value.routeScope += "/"; }],
    ["wrong method", (value: any) => { value.method = "PUT"; }],
    ["create target", (value: any) => { value.requestTargetId = "1"; }],
    ["undefined note", (value: any) => { value.body.note = undefined; }],
    ["lone surrogate", (value: any) => { value.body.note = "\ud800"; }],
    ["NUL", (value: any) => { value.body.note = "a\0b"; }],
    ["float decimal", (value: any) => { value.body.lines[0].qty = 1.25; }],
    ["excess precision", (value: any) => { value.body.lines[0].qty = "1.25000"; }],
    ["nonzero create line", (value: any) => { value.body.lines[0].saleLineId = "1"; }],
    ["client identity", (value: any) => { value.body.lines[0].clientLineId = "private"; }],
  ])("rejects %s before hashing", (_name, change) => {
    const value = fixture("sales-create-intent"); change(value);
    expect(() => canonicalizeWeb4Request(value)).toThrow();
  });

  it("keeps dynamic Receipt duplicate-product validation separate from wire decoding", () => {
    const value = fixture("receipt-create-intent");
    value.body.lines[1].productId = value.body.lines[0].productId;
    expect(parseWeb4WireIntent(value).body).toEqual(value.body);
  });

  it.each(["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"])("builds the real outgoing command from feature snapshot: %s", stem => {
    const expected = fixture(`${stem}-intent`);
    const data = fixture(`${stem}-response`).data;
    let actual;
    if (stem === "sales-post") actual = salesPostOperationRequest({ saleId: expected.requestTargetId, expectedVersion: expected.body.expectedVersion });
    else if (stem === "receipt-post") actual = receiptPostOperationRequest({ receiptId: expected.requestTargetId, expectedVersion: expected.body.expectedVersion });
    else if (stem.startsWith("sales")) {
      const snapshot = mapSalesDetail(salesDetailSchema.parse(data)).saved;
      snapshot.saleId = expected.requestTargetId; snapshot.expectedVersion = expected.body.expectedVersion ?? null;
      actual = salesSaveOperationRequest(snapshot);
    } else {
      const snapshot = mapGoodsReceiptDetail(receiptDetailSchema.parse(data)).saved;
      snapshot.receiptId = expected.requestTargetId; snapshot.expectedVersion = expected.body.expectedVersion ?? null;
      actual = receiptSaveOperationRequest(snapshot);
    }
    expect(actual).toEqual(expected);
    expect(web4OperationPath(actual)).toBe(expected.routeScope.replace("{saleId}", expected.requestTargetId ?? "").replace("{receiptId}", expected.requestTargetId ?? ""));
  });
});
