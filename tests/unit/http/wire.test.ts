import { describe, expect, it } from "vitest";
import draft from "../../fixtures/web2-v1/sales-get-draft-response.json";
import posted from "../../fixtures/web2-v1/sales-get-posted-response.json";
import list from "../../fixtures/web2-v1/sales-list-response.json";
import numeric from "../../fixtures/web2-v1/numeric-vectors.json";
import expansion from "../../fixtures/web2-v1/sales-200-lines-expansion.json";
import created from "../../fixtures/web2-v1/sales-create-response.json";
import { salesDetailSchema, salesPageSchema, longIdSchema, quantitySchema, priceSchema, amountSchema, profitSchema, unitCostSchema } from "../../../src/infrastructure/http/salesWireSchemas";
import { mapSalesDetail } from "../../../src/infrastructure/http/salesWireMapper";

describe("WEB2 exact Sales response boundary", () => {
  it.each(["bad", "", "-1", "1e2", "1.0", "9".repeat(10000)])("safely rejects invalid long lexeme %s", value => {
    expect(longIdSchema.safeParse(value).success).toBe(false);
  });
  it("retains int64 identities, signed profit, eight-place cost and historical labels", () => {
    const document = mapSalesDetail(salesDetailSchema.parse(posted.data));
    expect(document.saleId).toBe("9223372036854775807");
    expect(document.lines[0].saleLineId).toBe("9007199254740993");
    expect(document.lines[0].postedUnitCost).toBe("1.00000001");
    expect(document.grossProfit).toBe("-0.7500");
    expect(document.references.customer).toEqual({ id: "101", code: "", name: "KH101 - Khách hàng cũ", isActive: false });
    expect(document.lines[0].clientLineId).not.toBe(document.lines[1].clientLineId);
  });
  it("normalizes omitted Draft costs and page cursors without inventing zero", () => {
    const document = mapSalesDetail(salesDetailSchema.parse(draft.data));
    expect(document.totalCost).toBeNull();
    expect(document.lines[0].postedUnitCost).toBeNull();
    expect(salesPageSchema.parse(list.data).nextCursor ?? null).toBeNull();
  });
  it.each([
    ["numeric long", { saleId: 9007199254740993 }],
    ["overflow long", { saleId: "9223372036854775808" }],
    ["leading zero long", { saleId: "01" }],
    ["numeric amount", { totalAmount: 2.5 }],
    ["amount overflow", { totalAmount: "1000000000000000000000000" }],
    ["amount scale", { totalAmount: "1.00001" }],
    ["non-leap date", { saleDate: "2023-02-29" }],
    ["default date", { saleDate: "0001-01-01" }],
    ["timestamp date", { saleDate: "2024-02-29T00:00:00Z" }],
    ["int32 overflow", { customerId: 2147483648 }],
    ["string int32", { customerId: "101" }],
    ["missing Posted cost", { totalCost: undefined }],
    ["null Posted cost", { totalCost: null }],
  ])("rejects %s", (_, change) => {
    expect(salesDetailSchema.safeParse({ ...posted.data, ...change }).success).toBe(false);
  });
  it.each(["1.000000001", "100000000000000000000", "", 1])("rejects invalid posted unit cost %s", value => {
    const data = structuredClone(posted.data);
    Object.assign(data.lines[0], { postedUnitCost: value });
    expect(salesDetailSchema.safeParse(data).success).toBe(false);
  });
  it("rejects duplicate identities and noncontiguous server line order", () => {
    const data = structuredClone(posted.data);
    data.lines[1].saleLineId = data.lines[0].saleLineId;
    expect(salesDetailSchema.safeParse(data).success).toBe(false);
    data.lines[1].saleLineId = "9007199254740994";
    data.lines[1].lineNo = 3;
    expect(salesDetailSchema.safeParse(data).success).toBe(false);
  });
  it("accepts independent canonical numeric caps without numeric coercion", () => {
    const schemas = { qty: quantitySchema, unitPrice: priceSchema, lineAmount: amountSchema, postedUnitCost: unitCostSchema, grossProfit: profitSchema, totalCost: amountSchema };
    for (const vector of numeric.decimals) {
      const schema = schemas[vector.field as keyof typeof schemas];
      expect(schema.parse(vector.value)).toBe(vector.value);
      expect(schema.safeParse(Number(vector.value)).success).toBe(false);
    }
    expect(quantitySchema.safeParse("0").success).toBe(false);
    expect(amountSchema.safeParse("0".repeat(10000) + "1000000000000000000000000").success).toBe(false);
    expect(amountSchema.parse("0001.0")).toBe("0001.0");
  });
  it("accepts canonical expansion into200 independently persisted duplicate-product rows", () => {
    const data = structuredClone(created.data);
    const template = data.lines[expansion.lineTemplateIndex];
    data.lines = Array.from({ length: expansion.count }, (_, index) => ({ ...template, saleLineId: String(BigInt(expansion.firstSaleLineId) + BigInt(index)), lineNo: index + 1, productId: expansion.productId, qty: expansion.qty, unitPrice: expansion.unitPrice, isGift: expansion.isGift, lineAmount: "0.0001" }));
    data.totalAmount = expansion.expectedTotalAmount;
    const document = mapSalesDetail(salesDetailSchema.parse(data));
    expect(document.lines).toHaveLength(200);
    expect(new Set(document.lines.map(line => line.clientLineId)).size).toBe(200);
    expect(document.totalAmount).toBe("0.0200");
    expect(document.lines[199].saleLineId).toBe("9007199254741192");
  });
});
