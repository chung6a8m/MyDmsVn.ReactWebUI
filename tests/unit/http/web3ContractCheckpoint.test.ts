import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import manifest from "../../fixtures/web3-v1/manifest.json";
import provenance from "../../fixtures/web3-v1/provenance.json";
import vectors from "../../fixtures/web3-v1/corpus-vectors.json";
import draft from "../../fixtures/web3-v1/receipt-get-draft-response.json";
import balances from "../../fixtures/web3-v1/balances-response.json";
import zeroBalances from "../../fixtures/web3-v1/balances-zero-response.json";
import stockCard from "../../fixtures/web3-v1/stock-card-response.json";
import emptyList from "../../fixtures/web3-v1/receipt-list-empty-response.json";
import fieldError from "../../fixtures/web3-v1/error-400-fields.json";
import valuationError from "../../fixtures/web3-v1/error-400-valuation-post.json";
import { HttpError, readData } from "../../../src/infrastructure/http/authApi";
import { mapReadFailure } from "../../../src/infrastructure/http/readBoundary";
import {
  amountSchema,
  errorEnvelopeSchema,
  intIdSchema,
  longIdSchema,
  priceSchema,
  profitSchema,
  quantitySchema,
  saleDateSchema,
  unitCostSchema,
  utcSchema,
} from "../../../src/infrastructure/http/salesWireSchemas";
import { lineAmount } from "../../../src/features/sales/decimal";

const corpus = new URL("../../fixtures/web3-v1/", import.meta.url);
const scalarSchemas = {
  "int64-positive": longIdSchema,
  int32: intIdSchema,
  quantity: quantitySchema,
  "unit-price": priceSchema,
  amount: amountSchema,
  "signed-amount": profitSchema,
  "average-unit-cost": unitCostSchema,
  date: saleDateSchema,
  utc: utcSchema,
};

// Existing primitives are not WEB3 codecs. The canonical validator still checks
// every vector, including count-zero, signed quantity, rowversion, negative zero
// and datetime2 precision. The latter two require additional F03 boundary rules.
const compatibleScalars = vectors.scalarVectors.filter(vector =>
  Object.hasOwn(scalarSchemas, vector.scalar) &&
  !(vector.scalar === "signed-amount" && vector.value === "-0") &&
  !(vector.scalar === "utc" && vector.value === "2026-11-01T00:00:00.12345678Z"),
);

describe("WEB3 canonical corpus and existing boundary compatibility", () => {
  it("validates the complete pinned corpus without replacing its backend oracle", () => {
    for (const file of provenance.files) {
      const bytes = readFileSync(new URL(file.file, corpus));
      expect(createHash("sha256").update(bytes).digest("hex"), file.file).toBe(file.sha256);
    }
    const result = JSON.parse(execFileSync(process.execPath, [
      fileURLToPath(new URL("validate-corpus.mjs", corpus)),
      fileURLToPath(corpus),
    ], { encoding: "utf8" }));
    expect(result).toMatchObject({
      fixtures: manifest.fixtures.length,
      positiveCases: vectors.cases.filter(vector => vector.valid).length,
      negativeCases: vectors.cases.filter(vector => !vector.valid).length,
      scalarCases: vectors.scalarVectors.length,
      roundingCases: vectors.roundingVectors.length,
    });
    expect(result.positiveCases).toBeGreaterThan(0);
    expect(result.negativeCases).toBeGreaterThan(0);
  });

  it.each(compatibleScalars)("existing primitive honors $name", vector => {
    const schema = scalarSchemas[vector.scalar as keyof typeof scalarSchemas];
    expect(schema.safeParse(vector.value).success).toBe(vector.valid);
    if (vector.valid) expect(schema.parse(vector.value)).toBe(vector.value);
  });

  it("keeps four-place receipt unit cost separate from eight-place average cost", () => {
    const receiptCost = draft.data.lines[1].unitCost;
    const average = balances.data.items[0].averageUnitCost;
    expect(priceSchema.parse(receiptCost)).toBe("12.3456");
    expect(unitCostSchema.parse(average)).toBe("15.00000000");
    expect(priceSchema.safeParse(average).success).toBe(false);
    expect(priceSchema.safeParse(Number(receiptCost)).success).toBe(false);
  });

  it.each(vectors.roundingVectors)("receipt preview matches canonical $name", vector => {
    expect(lineAmount(vector.quantity, vector.unitCost)).toBe(vector.expectedLineAmount);
  });

  it("preserves int64 references and signed inventory movement through the shared envelope reader", async () => {
    const data = await readData(new Response(JSON.stringify(stockCard)));
    expect(data).toMatchObject({
      items: [
        { ledgerId: "9007199254740993", documentId: "9007199254740993", quantityChange: "20.0000", valueChange: "300.0000" },
        { ledgerId: "9223372036854775807", documentId: "9223372036854775807", quantityChange: "-4.0000", valueChange: "-60.0000", postedAtUtc: "2026-11-01T02:03:05.1234567Z" },
      ],
    });
    expect(profitSchema.parse(stockCard.data.items[1].valueChange)).toBe("-60.0000");
    expect(amountSchema.safeParse(stockCard.data.items[1].valueChange).success).toBe(false);
    expect(utcSchema.parse(stockCard.data.items[1].postedAtUtc)).toBe("2026-11-01T02:03:05.1234567Z");
  });

  it("preserves zero stock null average and string-zero page counts without inventing values", async () => {
    expect(await readData(new Response(JSON.stringify(zeroBalances)))).toMatchObject({
      items: [{ quantity: "0.0000", inventoryValue: "0.0000", averageUnitCost: null }],
    });
    expect(await readData(new Response(JSON.stringify(emptyList)))).toEqual({
      items: [], pageNumber: 1, pageSize: 25, totalCount: "0",
    });
  });

  it.each(manifest.fixtures.filter(fixture => fixture.kind === "error"))(
    "maps canonical $file through the existing shared error boundary",
    fixture => {
      const payload: unknown = JSON.parse(readFileSync(new URL(fixture.file, corpus), "utf8"));
      const envelope = errorEnvelopeSchema.parse(payload);
      const mapped = mapReadFailure(new HttpError(fixture.status!, payload));
      const expectedKinds: Record<number, string> = {
        400: "validation", 401: "unauthorized", 403: "forbidden",
        404: "not-found", 409: "conflict", 429: "unavailable", 500: "unavailable",
      };
      expect(mapped).toMatchObject({
        kind: expectedKinds[fixture.status!],
        code: envelope.error.code,
        message: envelope.error.message,
        issues: envelope.error.details?.map(issue => ({ ...issue, field: issue.field ?? "" })),
      });
    },
  );

  it("retains receipt server field paths until a feature-owned snapshot mapper exists", () => {
    const mapped = mapReadFailure(new HttpError(400, fieldError));
    expect(mapped.issues?.map(issue => issue.field)).toEqual([
      "lines[0].quantity", "lines[1].unitCost",
    ]);
    expect(mapped.correlationId).toBe("WEB3_FIXTURE_ONLY");
  });

  it("keeps a fieldless Post valuation failure at document level", () => {
    const mapped = mapReadFailure(new HttpError(400, valuationError));
    expect(mapped.issues).toEqual([
      expect.objectContaining({ code: "GoodsReceipt.ValuationOutOfRange", field: "" }),
    ]);
  });
});
