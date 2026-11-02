import { createIndexedDbDraftRepository } from "../../../src/infrastructure/drafts/indexedDbDraftRepository";
import { createWeb4OperationRepository, operationKey } from "../../../src/infrastructure/drafts/web4OperationRepository";
import { draftKey, type DraftRecord } from "../../../src/infrastructure/drafts/draftRecord";
import { freezeWeb4Operation } from "../../../src/infrastructure/http/web4OperationCodec";
import { decodeWeb4OperationOutcome } from "../../../src/infrastructure/http/operationStatusPort";
import { salesDetailSchema } from "../../../src/infrastructure/http/salesWireSchemas";
import { receiptDetailSchema } from "../../../src/infrastructure/http/goodsReceiptWireSchemas";
import { mapSalesDetail, mapSavedDetail } from "../../../src/infrastructure/http/salesWireMapper";
import { mapGoodsReceiptDetail, mapSavedGoodsReceiptDetail } from "../../../src/infrastructure/http/goodsReceiptWireMapper";
export { cleanupCleanDrafts } from "../../../src/infrastructure/drafts/logoutDraftCleanup";
export { createIndexedDbDraftRepository, createWeb4OperationRepository, draftKey, operationKey };
export async function prepared(stem = "sales-create", id = "local-1") {
  const fixture = async (name: string) => (await fetch(`/tests/fixtures/web4-v1/corpus/${name}.json`)).json();
  const request = await fixture(`${stem}-intent`), response = await fixture(`${stem}-response`);
  const post = stem.endsWith("post"), create = stem.endsWith("create");
  const baselineResponse = post ? await fixture(`${stem.replace("post", "update")}-response`) : response;
  const frozen = await freezeWeb4Operation(request, { operationId: crypto.randomUUID(), deploymentEpoch: "11111111-2222-4333-8444-555555555555", actorKey: "42" });
  const common = { serverId: request.requestTargetId, rawBuffers: {}, lookupBuffers: {}, dirty: !post, initialDraft: null, postAcknowledgement: null };
  let snapshot: DraftRecord["snapshot"];
  if (stem.startsWith("sales")) {
    const baseline = mapSalesDetail(salesDetailSchema.parse(baselineResponse.data));
    baseline.version = request.body.expectedVersion ?? baseline.version;
    baseline.saved.expectedVersion = baseline.version;
    const draft = structuredClone(baseline.saved);
    if (create) { draft.saleId = null; draft.expectedVersion = null; draft.lines = draft.lines.map(line => ({ ...line, saleLineId: null })); }
    snapshot = { ...common, feature: "sales", baseline: create ? null : baseline, draft };
  } else {
    const baseline = mapGoodsReceiptDetail(receiptDetailSchema.parse(baselineResponse.data));
    baseline.version = request.body.expectedVersion ?? baseline.version;
    baseline.saved.expectedVersion = baseline.version;
    const draft = structuredClone(baseline.saved);
    if (create) { draft.receiptId = null; draft.expectedVersion = null; draft.lines = draft.lines.map(line => ({ ...line, receiptLineId: null })); }
    snapshot = { ...common, feature: "goods-receipt", baseline: create ? null : baseline, draft };
  }
  const draft: DraftRecord = { schemaVersion: 1, deploymentEpoch: frozen.deploymentEpoch, actorKey: frozen.actorKey, feature: snapshot.feature,
    localDocumentId: id, localPersistSequence: 1, editRevision: 7, savedAt: "2026-11-02T00:00:00.000Z", unresolvedOperation: false, operationId: null, snapshot };
  const proof = decodeWeb4OperationOutcome(frozen.request, response.data);
  let settledSnapshot: DraftRecord["snapshot"];
  if (snapshot.feature === "sales") {
    if (proof.operationKind === "Sales.Post") settledSnapshot = { ...snapshot, dirty: false, postAcknowledgement: proof.value };
    else {
      const baseline = mapSavedDetail(salesDetailSchema.parse(response.data), snapshot.draft);
      settledSnapshot = { ...snapshot, serverId: baseline.saleId, baseline, draft: structuredClone(baseline.saved), dirty: false };
    }
  } else {
    if (proof.operationKind === "Receipt.Post") settledSnapshot = { ...snapshot, dirty: false, postAcknowledgement: proof.value };
    else {
      const baseline = mapSavedGoodsReceiptDetail(receiptDetailSchema.parse(response.data), snapshot.draft);
      settledSnapshot = { ...snapshot, serverId: baseline.receiptId, baseline, draft: structuredClone(baseline.saved), dirty: false };
    }
  }
  const settledDraft: DraftRecord = { ...draft, localPersistSequence: 2, savedAt: "2026-11-02T00:00:01.000Z", snapshot: settledSnapshot };
  return { draft, operation: frozen, expectedDraftSequence: null, proof, settledDraft };
}
export function rawOpen(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function rawPut(name: string, store: "drafts" | "operations", key: IDBValidKey, value: unknown) {
  const db = await rawOpen(name);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite"); tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function code(action: () => Promise<unknown>) {
  try { await action(); return "success"; } catch (error) { return (error as { code?: string }).code ?? "invalid-record"; }
}
