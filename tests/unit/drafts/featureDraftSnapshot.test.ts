import { describe, expect, it } from "vitest";
import { captureFeatureDraft, captureSalesDraft, captureGoodsReceiptDraft, decodeFeatureDraft, FeatureDraftSnapshotError } from "../../../src/infrastructure/drafts/featureDraftSnapshot";
import type { SalesSession } from "../../../src/features/sales/salesSessionStore";
import type { GoodsReceiptSession } from "../../../src/features/goodsReceipt/goodsReceiptSessionStore";
import { mapSalesDetail } from "../../../src/infrastructure/http/salesWireMapper";
import { mapGoodsReceiptDetail } from "../../../src/infrastructure/http/goodsReceiptWireMapper";
import { salesDetailSchema, postAcknowledgementSchema } from "../../../src/infrastructure/http/salesWireSchemas";
import { receiptDetailSchema, receiptPostAcknowledgementSchema } from "../../../src/infrastructure/http/goodsReceiptWireSchemas";
import salesResponse from "../../fixtures/web4-v1/corpus/sales-create-response.json";
import receiptResponse from "../../fixtures/web4-v1/corpus/receipt-create-response.json";
import salesPost from "../../fixtures/web4-v1/corpus/sales-post-response.json";
import receiptPost from "../../fixtures/web4-v1/corpus/receipt-post-response.json";

function sessionState() {
  return { sessionId: "local-document", generation: 17, actorKey: "13", actorGeneration: 5, requestGeneration: 9,
    editRevision: 7, dirty: false, status: "ready" as const, mutation: "idle" as const, commandCount: 3,
    capabilities: { read: true, write: true, post: true }, view: {}, rawBuffers: {}, lookupBuffers: {} };
}
function salesSession(): SalesSession {
  const baseline = mapSalesDetail(salesDetailSchema.parse(salesResponse.data));
  return { ...sessionState(), saleId: baseline.saleId, baseline, draft: structuredClone(baseline.saved) };
}
function receiptSession(): GoodsReceiptSession {
  const baseline = mapGoodsReceiptDetail(receiptDetailSchema.parse(receiptResponse.data));
  return { ...sessionState(), receiptId: baseline.receiptId, baseline, draft: structuredClone(baseline.saved) };
}
function newSales(): SalesSession {
  const draft = { saleId: null, expectedVersion: null, saleDate: "", customerId: "", warehouseId: "", employeeId: "", note: "", lines: [] };
  return { ...sessionState(), saleId: null, baseline: null, draft, initialDraft: structuredClone(draft) };
}
function newReceipt(): GoodsReceiptSession {
  const draft = { receiptId: null, expectedVersion: null, receiptDate: "", warehouseId: "", employeeId: "", note: null, lines: [] };
  return { ...sessionState(), receiptId: null, baseline: null, draft, initialDraft: structuredClone(draft) };
}
function changed(input: unknown, path: string, value: unknown): unknown {
  const copy = structuredClone(input) as Record<string, unknown>;
  const parts = path.split(".");
  let parent = copy;
  for (const key of parts.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
  parent[parts.at(-1)!] = value;
  return copy;
}

describe("feature draft allowlist capture", () => {
  it("preserves exact Sales IDs, ordered duplicate products and Gift lines", () => {
    const session = salesSession();
    const snapshot = captureSalesDraft(session)!;
    expect(snapshot).toEqual({ feature: "sales", serverId: session.saleId, draft: session.draft, baseline: session.baseline,
      initialDraft: null, rawBuffers: {}, lookupBuffers: {}, dirty: false, postAcknowledgement: null });
    expect(snapshot.draft.lines.map(line => line.saleLineId)).toEqual(["9007199254740993", "9007199254740994", "9223372036854775807"]);
    expect(snapshot.draft.lines.map(line => line.productId)).toEqual(["104", "104", "104"]);
    expect(decodeFeatureDraft(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
  });

  it("preserves Receipt nullable note, canonical baseline and server/client identities", () => {
    const session = receiptSession();
    const snapshot = captureGoodsReceiptDraft(session)!;
    expect(snapshot).toEqual({ feature: "goods-receipt", serverId: session.receiptId, draft: session.draft, baseline: session.baseline,
      initialDraft: null, rawBuffers: {}, lookupBuffers: {}, dirty: false, postAcknowledgement: null });
    expect(decodeFeatureDraft(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
  });

  it("keeps incomplete new drafts, exact invalid raw text, unconfirmed selection and composition", () => {
    const session = newSales();
    session.draft!.lines = [{ clientLineId: "local:line", saleLineId: null, productId: null, qty: "0.0000", unitPrice: "0.0000", isGift: false }];
    session.rawBuffers = { "qty:local:line": { raw: " 1,2,3\ud800 ", composing: true }, saleDate: { raw: "2026-99-", composing: false } };
    session.lookupBuffers = { "product:local:line": { selectedId: "104", displayText: "Sữa cũ", query: "  sữa mới  ", confirmed: false, composing: true } };
    session.dirty = true;
    const snapshot = captureFeatureDraft("sales", session)!;
    expect(snapshot.rawBuffers).toEqual(session.rawBuffers);
    expect(snapshot.lookupBuffers).toEqual(session.lookupBuffers);
    expect(snapshot.initialDraft).toEqual(session.initialDraft);
    expect(snapshot.dirty).toBe(true);
    expect(decodeFeatureDraft(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
    expect(captureFeatureDraft("goods-receipt", newReceipt())!.draft.lines).toEqual([]);
  });

  it("returns null while either feature has no loaded draft", () => {
    expect(captureFeatureDraft("sales", { ...newSales(), draft: null })).toBeNull();
    expect(captureFeatureDraft("goods-receipt", { ...newReceipt(), draft: null })).toBeNull();
  });

  it("selects known fields deeply without persisting runtime/auth or nested arbitrary payloads", () => {
    const session = salesSession();
    session.rawBuffers = { note: { raw: "ghi chú", composing: false } };
    session.lookupBuffers = { customerId: { selectedId: "101", displayText: "Khách", query: "Khách", confirmed: true, composing: false } };
    const expected = captureSalesDraft(session);
    Object.assign(session, { accessToken: "SECRET", error: { message: "SECRET" }, recovery: { source: "SECRET" }, mutationSnapshot: { bearer: "SECRET" } });
    Object.assign(session.draft!, { authorization: "SECRET" });
    Object.assign(session.draft!.lines[0], { cookie: "SECRET" });
    Object.assign(session.baseline!, { response: { secret: "SECRET" } });
    Object.assign(session.baseline!.saved.lines[0], { token: "SECRET" });
    Object.assign(session.baseline!.lines[0].product, { password: "SECRET" });
    Object.assign(session.rawBuffers.note, { accessToken: "SECRET" });
    Object.assign(session.lookupBuffers.customerId, { headers: "SECRET" });
    expect(captureSalesDraft(session)).toEqual(expected);
    expect(JSON.stringify(captureSalesDraft(session))).not.toContain("SECRET");
  });

  it("returns an independent deep copy, leaving live editing state untouched", () => {
    const session = receiptSession();
    session.rawBuffers = { note: { raw: "cũ", composing: true } };
    session.lookupBuffers = { warehouseId: { selectedId: "1", displayText: "Kho", query: "Kho", confirmed: true, composing: false } };
    const snapshot = captureGoodsReceiptDraft(session)!;
    session.draft!.lines[0].quantity = "2.0000";
    session.baseline!.references.warehouse.displayName = "khác";
    session.rawBuffers.note.raw = "mới";
    session.lookupBuffers.warehouseId.query = "mới";
    expect(snapshot.draft.lines[0].quantity).toBe("1.2500");
    expect(snapshot.baseline!.references.warehouse.displayName).toBeNull();
    expect(snapshot.rawBuffers.note.raw).toBe("cũ");
    expect(snapshot.lookupBuffers.warehouseId.query).toBe("Kho");
  });
});

describe("strict untrusted snapshot decoding", () => {
  it.each(["accessToken", "draft.cookie", "draft.lines.0.authorization", "baseline.response", "baseline.saved.headers", "baseline.lines.0.product.password", "rawBuffers.note.refreshToken", "lookupBuffers.customerId.capabilities"])("rejects unknown field %s", path => {
    const session = salesSession();
    session.rawBuffers = { note: { raw: "", composing: false } };
    session.lookupBuffers = { customerId: { selectedId: "101", displayText: "", query: "", confirmed: true, composing: false } };
    expect(() => decodeFeatureDraft(changed(captureSalesDraft(session), path, "SECRET"))).toThrow(FeatureDraftSnapshotError);
  });

  it.each([
    ["baseline.saleId", "9223372036854775808"], ["baseline.saved.expectedVersion", "different"],
    ["baseline.saved.saleDate", "2026-02-29"], ["baseline.saved.lines.0.qty", "1e0"],
    ["baseline.saved.lines.0.unitPrice", "1.00001"], ["baseline.saved.customerId", 101],
    ["baseline.references.customer.id", "2147483648"], ["baseline.lines.0.product.id", "105"],
    ["baseline.lines.0.clientLineId", "different-line"], ["baseline.lines.0.qty", "2.0000"],
    ["baseline.version", "AAAAAAAAAAF="], ["baseline.postedAtUtc", "2026-11-02T12:00:00Z"],
    ["baseline.totalAmount", "-1.0000"], ["baseline.totalCost", "0.0000"],
    ["baseline.saved.saleId", "1"], ["baseline.saved.note", "\0"],
  ])("rejects malformed or inconsistent canonical Sales field %s", (path, value) => {
    expect(() => decodeFeatureDraft(changed(captureSalesDraft(salesSession()), path, value))).toThrow(FeatureDraftSnapshotError);
  });

  it.each([
    ["baseline.receiptNumber", "GR0000000000"], ["baseline.version", "AAAAAAAAAAF="],
    ["baseline.saved.receiptDate", "0001-01-01"], ["baseline.saved.lines.0.quantity", "0.0000"],
    ["baseline.saved.lines.0.unitCost", "-0.0000"], ["baseline.lines.0.lineNumber", 2],
    ["baseline.references.warehouse.id", "2"], ["baseline.saved.receiptId", "1"],
    ["baseline.saved.expectedVersion", "AAAAAAAAAAI="], ["baseline.postedAtUtc", "2026-11-02T12:00:00Z"],
  ])("rejects malformed or inconsistent canonical Receipt field %s", (path, value) => {
    expect(() => decodeFeatureDraft(changed(captureGoodsReceiptDraft(receiptSession()), path, value))).toThrow(FeatureDraftSnapshotError);
  });

  it.each(["NaN", "Bearer PRIVATE-CONTENT", "", "1.5", "-1"])("rejects malformed persisted canonical catalog ID %s through the public error type", value => {
    expect(() => decodeFeatureDraft(changed(captureSalesDraft(salesSession()), "baseline.references.customer.id", value))).toThrow(FeatureDraftSnapshotError);
  });

  it("rejects a malformed Receipt number through the public error type", () => {
    expect(() => decodeFeatureDraft(changed(captureGoodsReceiptDraft(receiptSession()), "baseline.receiptNumber", "GRprivate-payload"))).toThrow(FeatureDraftSnapshotError);
  });

  it("rejects duplicate baseline server identities even when saved and displayed lines agree", () => {
    const session = salesSession();
    session.baseline!.saved.lines[1].saleLineId = session.baseline!.saved.lines[0].saleLineId;
    session.baseline!.lines[1].saleLineId = session.baseline!.lines[0].saleLineId;
    session.draft!.lines = [];
    expect(() => captureSalesDraft(session)).toThrow(FeatureDraftSnapshotError);
  });

  it("requires a baseline for existing documents and rejects invented server lines for new documents", () => {
    expect(() => decodeFeatureDraft(changed(captureSalesDraft(salesSession()), "baseline", null))).toThrow(FeatureDraftSnapshotError);
    const session = newReceipt();
    session.draft!.lines = [{ clientLineId: "new", receiptLineId: "1", productId: null, quantity: "1.0000", unitCost: "0.0000" }];
    expect(() => captureGoodsReceiptDraft(session)).toThrow(FeatureDraftSnapshotError);
  });

  it("rejects foreign feature buffer keys and prototype-looking keys", () => {
    const receipt = captureGoodsReceiptDraft(receiptSession());
    expect(() => decodeFeatureDraft(changed(receipt, "rawBuffers.saleDate", { raw: "", composing: false }))).toThrow(FeatureDraftSnapshotError);
    expect(() => decodeFeatureDraft({ ...receipt, rawBuffers: JSON.parse('{"__proto__":{"raw":"private","composing":false}}') })).toThrow(FeatureDraftSnapshotError);
  });

  it.each([
    ["serverId", "1"], ["draft.saleId", "1"], ["draft.expectedVersion", "AAAAAAAAAAI="],
    ["draft.lines.0.saleLineId", "1"], ["draft.lines.0.clientLineId", "foreign-line"],
    ["draft.lines.1.clientLineId", "server:9007199254740993"],
    ["draft.lines.1.saleLineId", "9007199254740993"], ["draft.lines.0.productId", "0104"],
    ["draft.lines.0.qty", "1,2,3"], ["draft.lines.0.unitPrice", 1],
    ["rawBuffers.foreign", { raw: "secret", composing: false }],
    ["rawBuffers.qty:missing-line", { raw: "1", composing: true }],
    ["lookupBuffers.product:missing-line", { selectedId: null, displayText: "", query: "", confirmed: false, composing: false }],
    ["lookupBuffers.note", { selectedId: null, displayText: "", query: "", confirmed: false, composing: false }],
  ])("rejects inconsistent document, line or buffer identity %s", (path, value) => {
    expect(() => decodeFeatureDraft(changed(captureSalesDraft(salesSession()), path, value))).toThrow(FeatureDraftSnapshotError);
  });

  it("allows draft line removal/reordering and new independent client lines", () => {
    const session = salesSession();
    session.draft!.lines = [session.draft!.lines[2], { ...session.draft!.lines[0], clientLineId: "new-local", saleLineId: null }, session.draft!.lines[0]];
    expect(captureSalesDraft(session)!.draft.lines.map(line => line.clientLineId)).toEqual(["server:9223372036854775807", "new-local", "server:9007199254740993"]);
  });

  it("does not impose Receipt duplicate-product Save validation on the editable draft", () => {
    const session = receiptSession();
    session.draft!.lines[1].productId = session.draft!.lines[0].productId;
    expect(captureGoodsReceiptDraft(session)!.draft.lines).toEqual(session.draft!.lines);
    const invalidBaseline = structuredClone(session);
    invalidBaseline.baseline!.saved.lines[1].productId = "7";
    invalidBaseline.baseline!.lines[1].productId = "7";
    invalidBaseline.baseline!.lines[1].product.id = "7";
    expect(() => captureGoodsReceiptDraft(invalidBaseline)).toThrow(FeatureDraftSnapshotError);
  });

  it("retains a new document's initial draft after Create assigns the baseline and server ID", () => {
    const session = salesSession();
    session.initialDraft = newSales().draft!;
    expect(captureSalesDraft(session)!.initialDraft!.saleId).toBeNull();
    expect(() => decodeFeatureDraft(changed(captureSalesDraft(session), "initialDraft.saleId", "1"))).toThrow(FeatureDraftSnapshotError);
  });

  it("preserves terminal acknowledgements, including Receipt's absence of version", () => {
    const sales = salesSession();
    sales.postAcknowledgement = postAcknowledgementSchema.parse(salesPost.data);
    const receipt = receiptSession();
    receipt.postAcknowledgement = receiptPostAcknowledgementSchema.parse(receiptPost.data);
    const salesSnapshot = captureSalesDraft(sales)!;
    const receiptSnapshot = captureGoodsReceiptDraft(receipt)!;
    expect(salesSnapshot.postAcknowledgement).toEqual(salesPost.data);
    expect(receiptSnapshot.postAcknowledgement).toEqual(receiptPost.data);
    expect(() => decodeFeatureDraft(changed(salesSnapshot, "postAcknowledgement.saleId", "1"))).toThrow(FeatureDraftSnapshotError);
    expect(() => decodeFeatureDraft(changed(receiptSnapshot, "postAcknowledgement.version", "AAAAAAAAAAE="))).toThrow(FeatureDraftSnapshotError);
    expect(() => decodeFeatureDraft(changed(receiptSnapshot, "postAcknowledgement.status", "Draft"))).toThrow(FeatureDraftSnapshotError);
  });
});

describe("bounded local resources", () => {
  it.each(["sales", "goods-receipt"] as const)("accepts 200 canonical %s baseline rows", feature => {
    if (feature === "sales") {
      const session = salesSession();
      session.baseline!.lines = Array.from({ length: 200 }, (_, index) => ({ ...session.baseline!.lines[0], clientLineId: `saved-${index}`, saleLineId: String(index + 1) }));
      session.baseline!.saved.lines = session.baseline!.lines.map(({ product: _product, unit: _unit, lineAmount: _amount, costAmount: _cost, postedUnitCost: _unitCost, ...line }) => line);
      session.draft = structuredClone(session.baseline!.saved);
      expect(captureSalesDraft(session)!.baseline!.saved.lines).toHaveLength(200);
    } else {
      const session = receiptSession();
      session.baseline!.lines = Array.from({ length: 200 }, (_, index) => ({ ...session.baseline!.lines[0], clientLineId: `saved-${index}`, receiptLineId: String(index + 1), productId: String(index + 1), lineNumber: index + 1, product: { ...session.baseline!.lines[0].product, id: String(index + 1) } }));
      session.baseline!.saved.lines = session.baseline!.lines.map(({ product: _product, lineNumber: _number, ...line }) => line);
      session.draft = structuredClone(session.baseline!.saved);
      expect(captureGoodsReceiptDraft(session)!.baseline!.saved.lines).toHaveLength(200);
    }
  });

  it("uses UTF-16 bounds for saved notes and keeps overlong editable notes separate", () => {
    const session = salesSession();
    session.baseline!.saved.note = "😀".repeat(500);
    session.draft!.note = session.baseline!.saved.note + "x";
    expect(captureSalesDraft(session)!.draft.note).toHaveLength(1001);
    session.baseline!.saved.note += "x";
    expect(() => captureSalesDraft(session)).toThrow(FeatureDraftSnapshotError);
  });

  it.each(["sales", "goods-receipt"] as const)("accepts 200 %s rows and rejects 201 without mutating RAM", feature => {
    const session = feature === "sales" ? newSales() : newReceipt();
    const line = feature === "sales"
      ? { clientLineId: "", saleLineId: null, productId: null, qty: "0.0000", unitPrice: "0.0000", isGift: false }
      : { clientLineId: "", receiptLineId: null, productId: null, quantity: "0.0000", unitCost: "0.0000" };
    Object.assign(session.draft!, { lines: Array.from({ length: 200 }, (_, index) => ({ ...line, clientLineId: `line-${index}` })) });
    expect(captureFeatureDraft(feature, session)!.draft.lines).toHaveLength(200);
    Object.assign(session.draft!, { lines: [...session.draft!.lines, { ...line, clientLineId: "line-200" }] });
    expect(() => captureFeatureDraft(feature, session)).toThrow(FeatureDraftSnapshotError);
    expect(session.draft!.lines).toHaveLength(201);
  });

  it.each(["raw", "query", "displayText"] as const)("counts %s limits as UTF-16 and never truncates", field => {
    const session = newSales();
    const atLimit = "😀".repeat(8192);
    session.rawBuffers = { note: { raw: field === "raw" ? atLimit : "", composing: true } };
    session.lookupBuffers = { customerId: { selectedId: null, displayText: field === "displayText" ? atLimit : "", query: field === "query" ? atLimit : "", confirmed: false, composing: true } };
    const snapshot = captureSalesDraft(session)!;
    expect(field === "raw" ? snapshot.rawBuffers.note.raw : snapshot.lookupBuffers.customerId[field]).toBe(atLimit);
    if (field === "raw") session.rawBuffers.note.raw += "x";
    else session.lookupBuffers.customerId[field] += "x";
    expect(() => captureSalesDraft(session)).toThrow(FeatureDraftSnapshotError);
    expect(field === "raw" ? session.rawBuffers.note.raw : session.lookupBuffers.customerId[field]).toHaveLength(16385);
  });

  it("reports generic validation failure without echoing rejected private content", () => {
    try { decodeFeatureDraft({ accessToken: "PRIVATE-CONTENT" }); }
    catch (error) {
      expect(error).toBeInstanceOf(FeatureDraftSnapshotError);
      expect(String(error)).not.toContain("PRIVATE-CONTENT");
      return;
    }
    throw new Error("Expected invalid snapshot rejection");
  });
});
