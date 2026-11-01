import { decodeFeatureDraft, type FeatureDraftSnapshot } from "./featureDraftSnapshot";

export interface DraftNamespace { deploymentEpoch: string; actorKey: string }
export interface DraftKey extends DraftNamespace { feature: "sales" | "goods-receipt"; localDocumentId: string }
export interface DraftRecord extends DraftKey {
  schemaVersion: 1;
  snapshot: FeatureDraftSnapshot;
  editRevision: number;
  localPersistSequence: number;
  savedAt: string;
  unresolvedOperation: boolean;
  operationId: string | null;
}
export type DraftRepositoryErrorCode = "unavailable" | "blocked" | "versionchange" | "quota" | "transaction-aborted" | "conflict" | "protected" | "invalid-record" | "closed";
export type DraftQuarantineReason = "unsupported-version" | "invalid-shape" | "scope-mismatch" | "invalid-snapshot" | "too-large";
export class DraftRepositoryError extends Error {
  constructor(public readonly code: DraftRepositoryErrorCode, public readonly reason?: DraftQuarantineReason) {
    super(`Local draft storage: ${code}${reason ? ` (${reason})` : ""}`);
    this.name = "DraftRepositoryError";
  }
}
export function draftKey(key: DraftKey): [string, string, string, string] {
  return [key.deploymentEpoch, key.actorKey, key.feature, key.localDocumentId];
}
const epochPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const operationPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const envelopeFields = new Set(["schemaVersion", "deploymentEpoch", "actorKey", "feature", "localDocumentId", "snapshot", "editRevision", "localPersistSequence", "savedAt", "unresolvedOperation", "operationId"]);
function invalid(reason: DraftQuarantineReason = "invalid-shape"): never {
  throw new DraftRepositoryError("invalid-record", reason);
}
export function validateDraftNamespace(value: DraftNamespace): void {
  if (typeof value?.deploymentEpoch !== "string" || !epochPattern.test(value.deploymentEpoch) || value.deploymentEpoch === "00000000-0000-0000-0000-000000000000" ||
    typeof value.actorKey !== "string" || !/^[1-9]\d{0,9}$/.test(value.actorKey) || Number(value.actorKey) > 2147483647) invalid();
}
export function validateDraftKey(value: DraftKey): void {
  validateDraftNamespace(value);
  if ((value.feature !== "sales" && value.feature !== "goods-receipt") || typeof value.localDocumentId !== "string" ||
    value.localDocumentId.length < 1 || value.localDocumentId.length > 200 || /[\u0000-\u001f\u007f]/.test(value.localDocumentId)) invalid();
}
export function decodeDraftRecord(value: unknown, expectedKey?: DraftKey): DraftRecord {
  // Bound serialized bytes before allowing any feature data to reach a preview.
  let serialized: string | undefined;
  try { serialized = JSON.stringify(value); } catch { invalid(); }
  if (!serialized) invalid();
  if (new TextEncoder().encode(serialized).byteLength > 2 * 1024 * 1024) invalid("too-large");
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const input = value as Record<string, unknown>;
  if (input.schemaVersion !== 1) invalid("unsupported-version");
  if (Object.keys(input).length !== envelopeFields.size || Object.keys(input).some(key => !envelopeFields.has(key))) invalid();
  const key: DraftKey = { deploymentEpoch: input.deploymentEpoch as string, actorKey: input.actorKey as string, feature: input.feature as DraftKey["feature"], localDocumentId: input.localDocumentId as string };
  validateDraftKey(key);
  if (expectedKey && draftKey(key).some((part, index) => part !== draftKey(expectedKey)[index])) invalid("scope-mismatch");
  if (!Number.isSafeInteger(input.editRevision) || (input.editRevision as number) < 0 ||
    !Number.isSafeInteger(input.localPersistSequence) || (input.localPersistSequence as number) < 1 ||
    typeof input.savedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.savedAt) ||
    !Number.isFinite(Date.parse(input.savedAt)) || new Date(input.savedAt).toISOString() !== input.savedAt ||
    typeof input.unresolvedOperation !== "boolean" ||
    !(input.operationId === null || typeof input.operationId === "string" && operationPattern.test(input.operationId)) ||
    (!input.unresolvedOperation && input.operationId !== null)) invalid();
  let snapshot: FeatureDraftSnapshot;
  try { snapshot = decodeFeatureDraft(input.snapshot); } catch { invalid("invalid-snapshot"); }
  if (snapshot.feature !== key.feature) invalid("scope-mismatch");
  return {
    ...key, schemaVersion: 1, snapshot, editRevision: input.editRevision as number,
    localPersistSequence: input.localPersistSequence as number, savedAt: input.savedAt,
    unresolvedOperation: input.unresolvedOperation, operationId: input.operationId as string | null,
  };
}
