import type { DurableOperationRecord } from "./web4OperationRepository";

// A session-local capability, never serialized. Exact record equality prevents
// an admission being transferred to another operation or altered certificate.
export interface NegativeLineageAdmission {
  admit(record: DurableOperationRecord, isCurrent: () => boolean): void;
  allows(record: DurableOperationRecord): boolean;
  revoke(record: DurableOperationRecord): void;
  clear(): void;
}
export function createNegativeLineageAdmission(): NegativeLineageAdmission {
  const admitted = new Map<string, { bytes: string; isCurrent: () => boolean }>();
  const key = (record: DurableOperationRecord) => JSON.stringify([record.deploymentEpoch, record.actorKey, record.operationId]);
  return {
    admit(record, isCurrent) {
      if (record.state !== "NOT_EXECUTED" || !isCurrent()) return;
      admitted.set(key(record), { bytes: JSON.stringify(record), isCurrent });
    },
    allows(record) {
      const value = admitted.get(key(record));
      if (!value || record.state !== "NOT_EXECUTED" || value.bytes !== JSON.stringify(record)) return false;
      if (!value.isCurrent()) { admitted.delete(key(record)); return false; }
      return true;
    },
    revoke(record) { admitted.delete(key(record)); },
    clear() { admitted.clear(); },
  };
}
