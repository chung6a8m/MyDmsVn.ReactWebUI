import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeDurableOperationRecord } from "../../../src/infrastructure/drafts/web4OperationRepository";
import { freezeWeb4Operation } from "../../../src/infrastructure/http/web4OperationCodec";
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/web4-v1/corpus/${name}.json`, import.meta.url), "utf8"));
const key = { operationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", deploymentEpoch: "11111111-2222-4333-8444-555555555555", actorKey: "42" };
async function record(stem = "sales-create") {
  return { schemaVersion: 1, ...key, feature: stem.startsWith("sales") ? "sales" : "goods-receipt", localDocumentId: "local-1",
    localPersistSequence: 1, draftCheckpointSequence: 3, draftCheckpointEditRevision: 8, createdAt: "2026-11-02T00:00:00.000Z",
    frozen: await freezeWeb4Operation(fixture(`${stem}-intent`), key), state: "DISPATCHED", settlement: null };
}
describe("durable immutable operation record", () => {
  it("rehashes a retained dispatched intent and preserves checkpoint identity", async () => {
    const decoded = await decodeDurableOperationRecord(await record(), key);
    expect(decoded.state).toBe("DISPATCHED");
    expect(decoded.draftCheckpointSequence).toBe(3);
    expect(decoded.draftCheckpointEditRevision).toBe(8);
    expect(decoded.frozen.requestFingerprint).toBe("3329e3500edf5e8a851ad303d88d1938853421c5c8f4526ef1e1a68ec6050b78");
  });
  it.each(["future", "credential", "fingerprint", "scope", "feature", "sequence", "revision", "missing-payload", "partial-settlement"])("fails closed for corrupt %s", async mutation => {
    const value = structuredClone(await record()) as any;
    if (mutation === "future") value.schemaVersion = 2;
    if (mutation === "credential") value.accessToken = "private";
    if (mutation === "fingerprint") value.frozen.requestFingerprint = "0".repeat(64);
    if (mutation === "scope") value.actorKey = "43";
    if (mutation === "feature") value.feature = "goods-receipt";
    if (mutation === "sequence") value.localPersistSequence = 0;
    if (mutation === "revision") value.draftCheckpointEditRevision = -1;
    if (mutation === "missing-payload") delete value.frozen.request.body;
    if (mutation === "partial-settlement") value.state = "SETTLED";
    await expect(decodeDurableOperationRecord(value, key)).rejects.toThrow();
  });
  it.each(["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"])("retains bounded authoritative settled metadata for %s", async stem => {
    const value = await record(stem), result = fixture(`${stem}-response`).data;
    const settlement = { draftSequence: 4, settledAt: "2026-11-02T00:00:01.000Z", resultDocumentId: result.saleId ?? result.receiptId, status: result.status,
      ...(stem === "receipt-post" ? {} : { version: result.version }) };
    const settled = { ...value, state: "SETTLED", localPersistSequence: 2, settlement };
    expect((await decodeDurableOperationRecord(settled, key)).settlement).toEqual(settlement);
    await expect(decodeDurableOperationRecord({ ...settled, settlement: { ...settlement, response: result } }, key)).rejects.toThrow();
    await expect(decodeDurableOperationRecord({ ...settled, settlement: { ...settlement, version: stem === "receipt-post" ? "AAAAAAAAAAE=" : undefined } }, key)).rejects.toThrow();
  });

  it.each([
    ["sales-create", 400, "ValidationError"], ["sales-update", 409, "SalesReceipt.ConcurrencyConflict"],
    ["sales-post", 404, "SalesReceipt.NotFound"], ["receipt-create", 400, "ValidationError"],
    ["receipt-update", 409, "GoodsReceipt.ConcurrencyConflict"], ["receipt-post", 409, "GoodsReceipt.AlreadyPosted"],
  ])("retains a bounded direct business rejection for %s", async (stem, httpStatus, code) => {
    const value = await record(stem as string);
    const rejection = { httpStatus, code, draftSequence: 4, rejectedAt: "2026-11-02T00:00:01.000Z" };
    const rejected = { ...value, state: "REJECTED", localPersistSequence: 2, rejection };
    expect((await decodeDurableOperationRecord(rejected, key)).state).toBe("REJECTED");
    await expect(decodeDurableOperationRecord({ ...rejected, rejection: { ...rejection, message: "private response text" } }, key)).rejects.toThrow();
  });

  it.each(["Operation.NotObserved", "Idempotency.KeyConflict", "Deployment.EpochMismatch", "Auth.Forbidden", "GoodsReceipt.AlreadyPosted"])("does not mislabel an ambiguous or foreign-kind error as a settled rejection: %s", async code => {
    const value = await record("sales-update");
    await expect(decodeDurableOperationRecord({ ...value, state: "REJECTED", localPersistSequence: 2,
      rejection: { httpStatus: 409, code, draftSequence: 4, rejectedAt: "2026-11-02T00:00:01.000Z" } }, key)).rejects.toThrow();
  });
});
