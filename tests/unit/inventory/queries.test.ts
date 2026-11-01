import { describe, expect, it } from "vitest";
import {
  inventoryKeys,
  stockCardIssue,
  sourceModule,
  balanceRowId,
} from "../../../src/features/inventory/inventoryQueries";
describe("inventory query boundaries", () => {
  it("separates actor generations and filters", () => {
    const q = { pageNumber: 1, pageSize: 25 };
    expect(
      inventoryKeys.balances({ actorKey: "a", actorGeneration: 2 }, q),
    ).toEqual(["inventory", "a", 2, "balances", q]);
    expect(
      inventoryKeys.stockCard(
        { actorKey: "a", actorGeneration: 3 },
        { ...q, warehouseId: "1", productId: "2" },
      )[3],
    ).toBe("stock-card");
  });
  it("requires both keys and rejects rounded or reversed UTC ranges", () => {
    expect(stockCardIssue({ warehouseId: "", productId: "2" })).toBeTruthy();
    expect(
      stockCardIssue({
        warehouseId: "1",
        productId: "2",
        fromUtc: "2026-11-01T00:00:00.0000002Z",
        toUtc: "2026-11-01T00:00:00.0000001Z",
      }),
    ).toBeTruthy();
    expect(
      stockCardIssue({
        warehouseId: "1",
        productId: "2",
        fromUtc: "2026-11-01T00:00:00.12345678Z",
      }),
    ).toBeTruthy();
    expect(
      stockCardIssue({
        warehouseId: "1",
        productId: "2",
        fromUtc: "2026-11-01T00:00:00.1000000Z",
        toUtc: "2026-11-01T00:00:00.1Z",
      }),
    ).toBeUndefined();
  });
  it("routes only known source types and uses both balance keys", () => {
    expect(sourceModule("GoodsReceipt")).toBe("goods-receipt");
    expect(sourceModule("SalesReceipt")).toBe("sales");
    expect(sourceModule("Other")).toBeUndefined();
    expect(balanceRowId({ warehouseId: "1", productId: "23" })).not.toBe(
      balanceRowId({ warehouseId: "12", productId: "3" }),
    );
  });
});
