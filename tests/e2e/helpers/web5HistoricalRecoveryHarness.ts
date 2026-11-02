import { code, createIndexedDbDraftRepository, createNegativeLineageAdmission, createWeb4OperationRepository, negativeCertificate, prepared } from "./web4OperationRepositoryHarness";
import type { DraftRecord } from "../../../src/infrastructure/drafts/draftRecord";

// Trusted fixture setup only: native production repositories perform every
// draft/operation transition. This supplies no backend or SQL proof.
export async function seedHistoricalNegative(historicalStem: string, currentStem: string, id: string) {
  const negativeAdmission = createNegativeLineageAdmission();
  const operations = createWeb4OperationRepository({ negativeAdmission }), drafts = createIndexedDbDraftRepository({ negativeAdmission });
  try {
    const first = await prepared(historicalStem, id);
    first.draft.snapshot.rawBuffers.note = { raw: "Nội dung lịch sử được giữ nguyên ệ  ", composing: false };
    const begun = await operations.begin(first);
    const historical = await operations.resolveNegative!({ operationKey: first.operation, expectedOperationSequence: 1, expectedDraftSequence: 1,
      resolvedDraft: { ...begun.draft, localPersistSequence: 2, unresolvedOperation: false, operationId: null },
      certificate: negativeCertificate(first.operation), isCurrent: () => true });
    // Model the separately authorized baseline review, then a distinct new
    // intent. Admission is ephemeral and is destroyed before the app reloads.
    negativeAdmission.admit(historical.operation, () => true);
    const next = await prepared(currentStem, id);
    const reviewed = await drafts.write({ ...next.draft, localPersistSequence: 3, editRevision: 8 }, 2);
    const current = await operations.begin({ ...next, draft: { ...reviewed, localPersistSequence: 4 }, expectedDraftSequence: 3 });
    return { historical, current };
  } finally { negativeAdmission.clear(); operations.close(); drafts.close(); }
}

export async function probeHistoricalProtection(key: DraftRecord) {
  const drafts = createIndexedDbDraftRepository();
  try {
    const read = await drafts.read(key);
    if (read.kind !== "available") throw Error("Expected the retained current draft");
    const record = read.record;
    const write = await code(() => drafts.write({ ...record, localPersistSequence: record.localPersistSequence + 1 }, record.localPersistSequence));
    const deletion = await code(() => drafts.delete(record, record.localPersistSequence));
    return { write, deletion, retained: await drafts.read(record) };
  } finally { drafts.close(); }
}
