import { decodeDraftRecord, validateDraftNamespace, type DraftNamespace } from "./draftRecord";
import type { DraftRepository } from "./indexedDbDraftRepository";
// Called only after an admitted explicit logout. It uses a fresh local connection,
// no token and no UI publication of record contents; auth invalidation never waits.
export async function cleanupCleanDrafts(namespace: DraftNamespace, createRepository: () => DraftRepository): Promise<boolean> {
  let repository: DraftRepository | undefined;
  try {
    validateDraftNamespace(namespace); repository = createRepository();
    const result = await repository.list(namespace);
    let complete = result.quarantined.length === 0;
    for (const input of result.records) {
      const record = decodeDraftRecord(input, { ...input, ...namespace });
      const snapshot = record.snapshot;
      if (record.unresolvedOperation || snapshot.dirty || !snapshot.baseline || Object.keys(snapshot.rawBuffers).length || Object.keys(snapshot.lookupBuffers).length ||
        JSON.stringify(snapshot.draft) !== JSON.stringify(snapshot.baseline.saved)) continue;
      try { await repository.delete(record, record.localPersistSequence); } catch { complete = false; }
    }
    return complete;
  } catch { return false; }
  finally { repository?.close(); }
}
