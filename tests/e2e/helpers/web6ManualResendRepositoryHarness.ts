import { createWeb4OperationRepository } from "../../../src/infrastructure/drafts/web4OperationRepository";
import { createWeb6ManualResendRepository } from "../../../src/infrastructure/drafts/web6ManualResendRepository";
import { negativeCertificate, prepared } from "./web4OperationRepositoryHarness";

export { createWeb4OperationRepository, createWeb6ManualResendRepository, negativeCertificate, prepared };

export async function seeded(databaseName: string) {
  const input = await prepared("sales-create");
  const operations = createWeb4OperationRepository({ databaseName });
  const checkpoint = await operations.begin(input);
  operations.close();
  const receipt = {
    schemaVersion: 1 as const,
    candidateId: "candidate-1",
    frozen: checkpoint.operation.frozen,
    feature: "sales" as const,
    localDocumentId: input.draft.localDocumentId,
    sourceDraftSequence: 1,
    sourceOperationSequence: 1,
    editRevision: input.draft.editRevision,
    issuedAtUtc: "2026-11-09T00:00:00.0000000Z",
    eligibleUntilUtc: "2026-11-16T00:00:00.0000000Z",
    receipt: "opaque.signed.receipt",
  };
  const claims = createWeb6ManualResendRepository({ databaseName });
  await claims.storeManualResendReceipt(receipt);
  claims.close();
  return { input, checkpoint, receipt };
}

export function claimInput(seed: Awaited<ReturnType<typeof seeded>>, overrides: Record<string, unknown> = {}) {
  return {
    operationKey: {
      deploymentEpoch: seed.checkpoint.operation.deploymentEpoch,
      actorKey: seed.checkpoint.operation.actorKey,
      operationId: seed.checkpoint.operation.operationId,
    },
    expectedDraft: seed.checkpoint.draft,
    expectedOperation: seed.checkpoint.operation,
    generation: 3,
    consentId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
    claimedAt: "2026-11-10T00:00:00.000Z",
    ...overrides,
  };
}

export async function code(action: () => Promise<unknown>) {
  try { await action(); return "success"; }
  catch (error) { return (error as { code?: string }).code ?? "invalid-record"; }
}

export function openVersion1(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("drafts");
      request.result.createObjectStore("operations");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function rawPut(name: string, store: "operations" | "manualResendReceipts" | "manualResendClaims", key: IDBValidKey, value: unknown) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite"); tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
