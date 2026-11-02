import { expect, it, vi } from "vitest";
import { cleanupCleanDrafts } from "../../../src/infrastructure/drafts/logoutDraftCleanup";
import { captureSalesDraft } from "../../../src/infrastructure/drafts/featureDraftSnapshot";
import { mapSalesDetail } from "../../../src/infrastructure/http/salesWireMapper";
import { salesDetailSchema } from "../../../src/infrastructure/http/salesWireSchemas";
import response from "../../fixtures/web4-v1/corpus/sales-create-response.json";
import type { SalesSession } from "../../../src/features/sales/salesSessionStore";
import type { DraftRecord } from "../../../src/infrastructure/drafts/draftRecord";
const namespace = { deploymentEpoch: "11111111-2222-4333-8444-555555555555", actorKey: "1" };
function setup() {
  const baseline = mapSalesDetail(salesDetailSchema.parse(response.data));
  const session = { baseline, saleId: baseline.saleId, draft: structuredClone(baseline.saved), rawBuffers: {}, lookupBuffers: {}, dirty: false } as SalesSession;
  const record: DraftRecord = { ...namespace, feature: "sales", schemaVersion: 1, localDocumentId: "clean", editRevision: 1, localPersistSequence: 2,
    savedAt: "2026-11-02T00:00:00.000Z", unresolvedOperation: false, operationId: null, snapshot: captureSalesDraft(session)! };
  const records = [record];
  const repository = { list: vi.fn(async () => ({ records, quarantined: [], conflicts: [] })), read: vi.fn(), write: vi.fn(), delete: vi.fn(async () => {}), close: vi.fn() };
  return { record, records, repository };
}
it("cleans only known clean durable snapshots under the captured logout namespace and CAS", async () => {
  const f = setup();
  f.records.push({ ...structuredClone(f.record), localDocumentId: "protected", unresolvedOperation: true });
  const dirty = { ...structuredClone(f.record), localDocumentId: "dirty" }; dirty.snapshot.rawBuffers.note = { raw: "keep", composing: true }; f.records.push(dirty);
  expect(await cleanupCleanDrafts(namespace, () => f.repository)).toBe(true);
  expect(f.repository.delete).toHaveBeenCalledTimes(1); expect(f.repository.delete).toHaveBeenCalledWith(f.record, 2); expect(f.repository.close).toHaveBeenCalledOnce();
});
it("reports incomplete cleanup when storage or CAS fails and still closes its connection", async () => {
  const f = setup(); f.repository.delete.mockRejectedValueOnce(new Error("CAS"));
  expect(await cleanupCleanDrafts(namespace, () => f.repository)).toBe(false); expect(f.repository.close).toHaveBeenCalledOnce();
});
it("never trusts a clean flag when the draft differs from its authoritative saved baseline", async () => {
  const f = setup(); f.record.snapshot.draft.note = "changed";
  expect(await cleanupCleanDrafts(namespace, () => f.repository)).toBe(true); expect(f.repository.delete).not.toHaveBeenCalled();
});
