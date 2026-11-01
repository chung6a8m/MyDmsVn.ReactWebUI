import { decodeDraftRecord, type DraftRecord } from "../../../src/infrastructure/drafts/draftRecord";
import { mapSalesDetail } from "../../../src/infrastructure/http/salesWireMapper";
import { mapGoodsReceiptDetail } from "../../../src/infrastructure/http/goodsReceiptWireMapper";
import { salesDetailSchema } from "../../../src/infrastructure/http/salesWireSchemas";
import { receiptDetailSchema } from "../../../src/infrastructure/http/goodsReceiptWireSchemas";
import type { DurableOperationRecord } from "../../../src/infrastructure/drafts/web4OperationRepository";
import type { Web4WireIntent } from "../../../src/infrastructure/http/web4OperationCodec";
import { databaseName, deploymentEpoch, seed } from "./durableDraftWorkspaceHarness";

export async function seedIntent(stem: string, intent: Web4WireIntent, baselineWire: unknown): Promise<DraftRecord> {
  const common = { schemaVersion: 1, deploymentEpoch, actorKey: "42", localDocumentId: stem, editRevision: 1, localPersistSequence: 1,
    savedAt: "2026-11-02T00:00:00.000Z", unresolvedOperation: false, operationId: null };
  const snapshot = { rawBuffers: {}, lookupBuffers: {}, dirty: !stem.endsWith("post"), postAcknowledgement: null };
  let record: DraftRecord;
  if (stem.startsWith("sales")) {
    const baseline = mapSalesDetail(salesDetailSchema.parse(baselineWire));
    baseline.saved.lines.forEach((line, i) => { line.clientLineId = `retained-${i}`; }); baseline.lines.forEach((line, i) => { line.clientLineId = `retained-${i}`; });
    const draft = structuredClone(baseline.saved); draft.saleId = intent.requestTargetId;
    draft.expectedVersion = "expectedVersion" in intent.body ? intent.body.expectedVersion : null;
    if (intent.operationKind === "Sales.Create" || intent.operationKind === "Sales.Update") draft.lines.forEach((line, i) => {
      const lines = intent.body as { lines: { saleLineId: string }[] }; line.saleLineId = lines.lines[i].saleLineId === "0" ? null : lines.lines[i].saleLineId;
    });
    if (draft.expectedVersion) { baseline.version = draft.expectedVersion; baseline.saved = structuredClone(draft); }
    record = decodeDraftRecord({ ...common, feature: "sales", snapshot: { ...snapshot, feature: "sales", serverId: draft.saleId, draft,
      baseline: draft.saleId ? baseline : null, initialDraft: draft.saleId ? null : structuredClone(draft) } });
  } else {
    const baseline = mapGoodsReceiptDetail(receiptDetailSchema.parse(baselineWire));
    baseline.saved.lines.forEach((line, i) => { line.clientLineId = `retained-${i}`; }); baseline.lines.forEach((line, i) => { line.clientLineId = `retained-${i}`; });
    const draft = structuredClone(baseline.saved); draft.receiptId = intent.requestTargetId;
    draft.expectedVersion = "expectedVersion" in intent.body ? intent.body.expectedVersion : null;
    if (!draft.receiptId) draft.lines.forEach(line => { line.receiptLineId = null; });
    if (draft.expectedVersion) { baseline.version = draft.expectedVersion; baseline.saved = structuredClone(draft); }
    record = decodeDraftRecord({ ...common, feature: "goods-receipt", snapshot: { ...snapshot, feature: "goods-receipt", serverId: draft.receiptId, draft,
      baseline: draft.receiptId ? baseline : null, initialDraft: draft.receiptId ? null : structuredClone(draft) } });
  }
  await seed(record); return record;
}
export async function operations(): Promise<DurableOperationRecord[]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  try { return await new Promise((resolve, reject) => {
    const transaction = db.transaction("operations"), read = transaction.objectStore("operations").getAll();
    read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error);
  }); } finally { db.close(); }
}
