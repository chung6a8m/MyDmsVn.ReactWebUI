import { decodeDraftRecord, draftKey, type DraftRecord } from "../../../src/infrastructure/drafts/draftRecord";

export const databaseName = "mydmsvn-drafts-v1";
export const deploymentEpoch = "11111111-2222-4333-8444-555555555555";
export function localRecord(feature: "sales" | "goods-receipt", id: string, count = 1, composing = false): DraftRecord {
  const common = { serverId: null, baseline: null, initialDraft: null, dirty: true, postAcknowledgement: null,
    rawBuffers: { note: { raw: "Nội dung cục bộ ệ  ", composing } }, lookupBuffers: {} };
  const record: DraftRecord = {
    schemaVersion: 1, deploymentEpoch, actorKey: "42", feature, localDocumentId: id,
    editRevision: 3, localPersistSequence: 1, savedAt: "2026-11-02T00:00:00.000Z", unresolvedOperation: false, operationId: null,
    snapshot: feature === "sales" ? { ...common, feature,
      draft: { saleId: null, expectedVersion: null, saleDate: "2026-11-02", customerId: "101", warehouseId: "102", employeeId: "103", note: "",
        lines: Array.from({ length: count }, (_, i) => ({ clientLineId: `sales-line-${i}`, saleLineId: null, productId: "104", qty: "1.2500", unitPrice: "2.0000", isGift: i % 2 === 1 })) } }
      : { ...common, feature,
        draft: { receiptId: null, expectedVersion: null, receiptDate: "2026-11-02", warehouseId: "102", employeeId: "103", note: "",
          lines: Array.from({ length: count }, (_, i) => ({ clientLineId: `receipt-line-${i}`, receiptLineId: null, productId: String(104 + i), quantity: "1.2500", unitCost: "2.0000" })) } },
  };
  return decodeDraftRecord(record);
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      for (const name of ["drafts", "operations"]) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
export async function allRecords(): Promise<DraftRecord[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("drafts"), request = transaction.objectStore("drafts").getAll();
      request.onsuccess = () => resolve(request.result as DraftRecord[]);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export async function seed(record: DraftRecord): Promise<void> {
  const validated = decodeDraftRecord(record), db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("drafts", "readwrite");
      transaction.objectStore("drafts").put(validated, draftKey(validated));
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
export async function compete(id: string): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("drafts", "readwrite"), store = transaction.objectStore("drafts"), read = store.getAll();
      read.onsuccess = () => {
        const record = (read.result as DraftRecord[]).find(value => value.localDocumentId === id);
        if (!record) { transaction.abort(); return; }
        record.localPersistSequence++;
        record.snapshot.rawBuffers.note = { raw: "Bản đã lưu ở tab khác", composing: false };
        store.put(decodeDraftRecord(record), draftKey(record));
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
