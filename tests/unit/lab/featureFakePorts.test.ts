import { describe, expect, it } from "vitest";
import {
  createFakeGoodsReceiptPort, createFakeInventoryPort, createLabReceiptCatalog, createLabReadScenarios,
} from "../../../src/infrastructure/fake/fakeReceiptInventoryPorts";

const context = () => ({ actorKey: "lab", actorGeneration: 1, signal: new AbortController().signal });

describe("WEB7-08 deterministic feature fake ports", () => {
  it("provides valid canonical Receipt drafts and in-memory write/Post responses", async () => {
    const read = createLabReadScenarios();
    const receipts = createFakeGoodsReceiptPort(read);
    const sample = await receipts.get("1501", context());
    expect(sample.kind).toBe("success");
    if (sample.kind !== "success") return;
    expect(sample.value.saved.receiptId).toBe("1501");
    expect(sample.value.saved.expectedVersion).toBe(sample.value.version);
    const saved = await receipts.save({ ...sample.value.saved, note: "Tiếng Việt cập nhật" }, context());
    expect(saved.kind).toBe("success");
    if (saved.kind !== "success") return;
    const posted = await receipts.post({ receiptId: saved.value.receiptId, expectedVersion: saved.value.version }, context());
    expect(posted.kind).toBe("success");
    if (posted.kind !== "success") return;
    expect(posted.value.status).toBe("Posted");
    const after = await receipts.get(saved.value.receiptId, context());
    expect(after.kind === "success" && after.value.status).toBe("Posted");
    const invalid = await receipts.save({ ...sample.value.saved, receiptDate: "2026-02-30" }, context());
    expect(invalid.kind).toBe("failed");
  });
  it("returns deterministic read errors/empty/forbidden and exact Inventory strings", async () => {
    const modes = createLabReadScenarios();
    const receipts = createFakeGoodsReceiptPort(modes);
    const inventory = createFakeInventoryPort(modes);
    const query = { pageNumber: 1, pageSize: 25 };
    const balances = await inventory.balances(query, context());
    expect(balances.kind).toBe("success");
    if (balances.kind === "success") expect(balances.value.items[0].quantity).toBe("120.0000");
    modes.setMode("empty");
    const empty = await receipts.list(query, context());
    expect(empty.kind === "success" && empty.value.totalCount).toBe("0");
    modes.setMode("error");
    const error = await inventory.balances(query, context());
    expect(error.kind === "failed" && error.error.kind).toBe("unavailable");
    modes.setMode("forbidden");
    const denied = await inventory.stockCard({ ...query, warehouseId: "201", productId: "401" }, context());
    expect(denied.kind === "failed" && denied.error.kind).toBe("forbidden");
    modes.setMode("ready");
    const card = await inventory.stockCard({ ...query, warehouseId: "201", productId: "401" }, context());
    expect(card.kind === "success" && card.value.items[0].postedAtUtc).toBe("2026-11-20T08:30:00.1234567Z");
  });
  it("uses receipt-valid catalog IDs without changing Sales Lab legacy fixtures", async () => {
    const result = await createLabReceiptCatalog().search({ kind: "product", search: "Cà", limit: 25 }, context());
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.value.map(option => option.id)).toContain("401");
      expect(result.value.every(option => Number(option.id) < 2147483647)).toBe(true);
    }
  });
});
