import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { z } from "../../../src/infrastructure/http/cspZod";
import { parseStrictJson } from "../../../src/infrastructure/http/strictJson";
import { web3LongId, web3Count, web3IntId, web3Quantity, web3UnitCost, web3Amount, web3SignedAmount, web3Average, web3SignedQuantity, web3Date, web3Utc, web3Version, web3ErrorEnvelopeSchema } from "../../../src/infrastructure/http/web3WireSchemas";
import { receiptCreateSchema, receiptUpdateSchema, receiptPostInputSchema, receiptDetailSchema, receiptPageSchema, receiptPostAcknowledgementSchema, receiptListQuerySchema } from "../../../src/infrastructure/http/goodsReceiptWireSchemas";
import { balancesPageSchema, stockCardPageSchema, balancesQuerySchema, stockCardQuerySchema } from "../../../src/infrastructure/http/inventoryWireSchemas";

// Test routing only: every entry is the same scalar schema used by feature codecs.
const web3ScalarSchemas = {
  "int64-positive": web3LongId, "int64-count": web3Count, int32: web3IntId,
  quantity: web3Quantity, "unit-price": web3UnitCost, amount: web3Amount,
  "signed-amount": web3SignedAmount, "average-unit-cost": web3Average,
  "signed-quantity": web3SignedQuantity, date: web3Date, utc: web3Utc, version: web3Version,
};
const directory = new URL("../../fixtures/web3-v1/", import.meta.url);
const fixture = (name: string) => JSON.parse(readFileSync(new URL(name, directory), "utf8"));
const schemas: Record<string, z.ZodType> = {
  "receipt-create-request": receiptCreateSchema, "receipt-update-request": receiptUpdateSchema,
  "receipt-post-request": receiptPostInputSchema, "receipt-detail": z.object({ data: receiptDetailSchema }).strict(),
  "receipt-post-response": z.object({ data: receiptPostAcknowledgementSchema }).strict(),
  "receipt-list-page": z.object({ data: receiptPageSchema }).strict(), "balances-page": z.object({ data: balancesPageSchema }).strict(),
  "stock-card-page": z.object({ data: stockCardPageSchema }).strict(), error: web3ErrorEnvelopeSchema,
  "receipt-list-query": receiptListQuerySchema, "balances-query": balancesQuerySchema, "stock-card-query": stockCardQuerySchema,
};
const controls = fixture("corpus-vectors.json");
for (const vector of controls.scalarVectors) {
  it(`production scalar: ${vector.name}`, () => {
    expect(web3ScalarSchemas[vector.scalar as keyof typeof web3ScalarSchemas].safeParse(vector.value).success).toBe(vector.valid);
  });
}
for (const golden of fixture("manifest.json").fixtures.filter((entry: {kind: string}) => schemas[entry.kind])) {
  it(`production golden: ${golden.file}`, () => {
    expect(schemas[golden.kind].safeParse(fixture(golden.file)).success).toBe(true);
  });
}
for (const scenario of controls.cases.filter((entry: {kind: string; rawQuery?: string}) => schemas[entry.kind] && entry.rawQuery === undefined)) {
  it(`production corpus: ${scenario.name}`, () => {
    const payload = scenario.base ? structuredClone(fixture(scenario.base)) : structuredClone(scenario.value);
    if (scenario.expandLines) {
      const target = scenario.kind === "receipt-detail" ? payload.data : payload;
      target.lines = Array.from({ length: scenario.expandLines }, (_, index) => ({ ...target.lines[0], productId: index + 1, ...(scenario.kind === "receipt-detail" ? { receiptLineId: (9007199254741000n + BigInt(index)).toString(), lineNumber: index + 1 } : {}) }));
    }
    for (const change of scenario.changes ?? []) {
      let owner = payload;
      for (const key of change.path.slice(0, -1)) owner = owner[key];
      const key = change.path.at(-1); if (change.remove) delete owner[key]; else owner[key] = structuredClone(change.value);
    }
    const run = () => schemas[scenario.kind].parse(scenario.rawJson !== undefined ? parseStrictJson(scenario.rawJson) : payload);
    if (scenario.valid) expect(run).not.toThrow(); else expect(run).toThrow();
  });
}
it.each(["int64-positive", "int64-count", "quantity", "unit-price", "date", "utc"] as const)("numeric/date scalar %s rejects terminal newline without throwing", scalar => {
  const value = scalar === "date" ? "2024-02-29\n" : scalar === "utc" ? "2026-11-01T00:00:00Z\n" : "1\n";
  expect(web3ScalarSchemas[scalar].safeParse(value).success).toBe(false);
});
it("malformed numeric stock projection is a schema rejection rather than BigInt exception", () => {
  const body = fixture("balances-response.json"); body.data.items[0].quantity = "1\n";
  expect(balancesPageSchema.safeParse(body.data).success).toBe(false);
});
