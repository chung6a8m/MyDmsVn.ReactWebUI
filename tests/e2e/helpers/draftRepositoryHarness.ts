import { createIndexedDbDraftRepository } from "../../../src/infrastructure/drafts/indexedDbDraftRepository";
import type { DraftRecord } from "../../../src/infrastructure/drafts/draftRecord";
import { mapSalesDetail } from "../../../src/infrastructure/http/salesWireMapper";
import { salesDetailSchema } from "../../../src/infrastructure/http/salesWireSchemas";
import salesResponse from "../../fixtures/web4-v1/corpus/sales-create-response.json";
export { createIndexedDbDraftRepository };
export function record(localDocumentId = "local-sale-1"): DraftRecord {
  return {
    schemaVersion: 1, deploymentEpoch: "00112233-4455-6677-8899-aabbccddeeff", actorKey: "7", feature: "sales", localDocumentId,
    editRevision: 2, localPersistSequence: 1, savedAt: "2026-11-02T00:00:00.000Z", unresolvedOperation: false, operationId: null,
    snapshot: { feature: "sales", serverId: null, draft: { saleId: null, expectedVersion: null, saleDate: "", customerId: "", warehouseId: "", employeeId: "", note: "", lines: [] }, baseline: null, initialDraft: null, rawBuffers: {}, lookupBuffers: {}, dirty: true, postAcknowledgement: null },
  };
}
export function key(value: DraftRecord): [string, string, string, string] {
  return [value.deploymentEpoch, value.actorKey, value.feature, value.localDocumentId];
}
export function existingRecord(localDocumentId: string): DraftRecord {
  const value = record(localDocumentId);
  const baseline = mapSalesDetail(salesDetailSchema.parse(salesResponse.data));
  value.snapshot = { ...value.snapshot, feature: "sales", serverId: baseline.saleId, draft: structuredClone(baseline.saved), baseline, initialDraft: null, postAcknowledgement: null };
  return value;
}
export function openRaw(name: string, version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function seed(name: string, value: unknown, primaryKey: IDBValidKey): Promise<void> {
  const db = await openRaw(name);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("drafts", "readwrite");
      tx.objectStore("drafts").put(value, primaryKey);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function errorCode(action: () => Promise<unknown>): Promise<string> {
  try { await action(); return "unexpected-success"; }
  catch (error) { return (error as { code: string }).code; }
}
