import { describe, expect, it } from "vitest";
import { decodeDraftRecord, draftKey, DraftRepositoryError, type DraftRecord } from "../../../src/infrastructure/drafts/draftRecord";

const key = { deploymentEpoch: "00112233-4455-6677-8899-aabbccddeeff", actorKey: "7", feature: "sales" as const, localDocumentId: "local-sale-1" };
function record() {
  return {
    ...key, schemaVersion: 1, editRevision: 2, localPersistSequence: 1,
    savedAt: "2026-11-02T00:00:00.000Z", unresolvedOperation: false, operationId: null,
    snapshot: {
      feature: "sales", serverId: null,
      draft: { saleId: null, expectedVersion: null, saleDate: "", customerId: "", warehouseId: "", employeeId: "", note: "", lines: [] },
      baseline: null, initialDraft: null, rawBuffers: {}, lookupBuffers: {}, dirty: false, postAcknowledgement: null,
    },
  };
}

describe("durable draft envelope", () => {
  it("round trips a new invalid business draft without normalizing its text", () => {
    const input = record();
    input.snapshot.rawBuffers = { saleDate: { raw: " chưa xong ", composing: true } };
    input.snapshot.draft.note = "Nội dung còn gõ  ";
    const decoded = decodeDraftRecord(input, key);
    expect(decoded.snapshot.draft.note).toBe("Nội dung còn gõ  ");
    expect(decoded.snapshot.rawBuffers.saleDate).toEqual({ raw: " chưa xong ", composing: true });
    expect(draftKey(decoded)).toEqual(["00112233-4455-6677-8899-aabbccddeeff", "7", "sales", "local-sale-1"]);
  });

  it.each([
    ["future schema", { schemaVersion: 2 }],
    ["credential addition", { accessToken: "private" }],
    ["missing operation protection", { unresolvedOperation: undefined }],
    ["sequence zero", { localPersistSequence: 0 }],
    ["unsafe sequence", { localPersistSequence: Number.MAX_SAFE_INTEGER + 1 }],
    ["negative revision", { editRevision: -1 }],
    ["noncanonical actor", { actorKey: "07" }],
    ["out of range actor", { actorKey: "2147483648" }],
    ["nil epoch", { deploymentEpoch: "00000000-0000-0000-0000-000000000000" }],
    ["noncanonical epoch", { deploymentEpoch: "00112233-4455-6677-8899-AABBCCDDEEFF" }],
    ["invalid time", { savedAt: "yesterday" }],
    ["operation ID without protection", { operationId: "11111111-1111-4111-8111-111111111111" }],
    ["non-v4 operation", { unresolvedOperation: true, operationId: "11111111-1111-1111-8111-111111111111" }],
  ])("rejects %s before preview", (_name, patch) => {
    expect(() => decodeDraftRecord({ ...record(), ...patch })).toThrow(DraftRepositoryError);
  });

  it("quarantines valid content stored under a different primary key", () => {
    expect(() => decodeDraftRecord(record(), { ...key, actorKey: "8" })).toThrow(DraftRepositoryError);
    expect(() => decodeDraftRecord(record(), { ...key, localDocumentId: "other" })).toThrow(DraftRepositoryError);
    expect(() => decodeDraftRecord({ ...record(), feature: "goods-receipt" })).toThrow(DraftRepositoryError);
  });

  it("retains an unresolved marker without an operation payload for fail-closed review", () => {
    expect(decodeDraftRecord({ ...record(), unresolvedOperation: true }).unresolvedOperation).toBe(true);
    expect(decodeDraftRecord({ ...record(), unresolvedOperation: true }).operationId).toBeNull();
  });

  it("rejects an oversized UTF-8 envelope without trimming user text", () => {
    const input = { ...record(), excess: "ệ".repeat(700_000) };
    try { decodeDraftRecord(input); throw new Error("accepted oversized data"); }
    catch (error) { expect(error).toMatchObject({ code: "invalid-record", reason: "too-large" }); }
    expect(input.excess.length).toBe(700_000);
  });

  it("allows exactly 2 MiB with 200 stable lines and rejects the next UTF-8 byte", () => {
    const input = record() as DraftRecord;
    if (input.snapshot.feature !== "sales") throw new Error("test fixture");
    input.snapshot.draft.lines = Array.from({ length: 200 }, (_, index) => ({ clientLineId: `line-${index}`, saleLineId: null, productId: null, qty: "0", unitPrice: "0", isGift: false }));
    input.snapshot.rawBuffers = Object.fromEntries(input.snapshot.draft.lines.flatMap(line => ["qty", "unitPrice"].map(field => [`${field}:${line.clientLineId}`, { raw: "", composing: true }])));
    let remaining = 2 * 1024 * 1024 - new TextEncoder().encode(JSON.stringify(input)).byteLength;
    for (const buffer of Object.values(input.snapshot.rawBuffers)) {
      const count = Math.min(16_384, remaining); buffer.raw = "x".repeat(count); remaining -= count;
    }
    expect(remaining).toBe(0);
    expect(decodeDraftRecord(input).snapshot.draft.lines).toHaveLength(200);
    input.snapshot.draft.note = "x";
    expect(() => decodeDraftRecord(input)).toThrow(expect.objectContaining({ code: "invalid-record", reason: "too-large" }));
  });
});
