import type { ManualResendClaim, ManualResendReceipt } from "../../src/infrastructure/drafts/web6ManualResendRepository";
import type { DurableOperationRecord } from "../../src/infrastructure/drafts/web4OperationRepository";
import { createHash } from "node:crypto";

type ProtectedState = {
  operation: DurableOperationRecord | undefined;
  receipt: ManualResendReceipt | undefined;
  claim: ManualResendClaim | undefined;
};

export type ProtectedCutoverBaseline = {
  deploymentEpoch: string;
  actorKey: string;
  operationId: string;
  operationKind: string;
  method: string;
  routeScope: string;
  requestTargetId: string | null;
  requestFingerprint: string;
  frozenJson: string;
  receiptCandidateId: string;
  receiptFeature: string;
  receiptLocalDocumentId: string;
  receiptSourceDraftSequence: number;
  receiptSourceOperationSequence: number;
  receiptEditRevision: number;
  receiptIssuedAtUtc: string;
  receiptEligibleUntilUtc: string;
  receiptSha256: string;
};

function fail(): never { throw Error("Invalid protected cutover state."); }

export function captureProtectedCutoverState(operation: DurableOperationRecord, receipt: ManualResendReceipt): ProtectedCutoverBaseline {
  if (operation.state !== "DISPATCHED" || operation.settlement !== null ||
      receipt.frozen.operationId !== operation.operationId || receipt.frozen.deploymentEpoch !== operation.deploymentEpoch ||
      receipt.frozen.actorKey !== operation.actorKey || receipt.frozen.requestFingerprint !== operation.frozen.requestFingerprint ||
      JSON.stringify(receipt.frozen) !== JSON.stringify(operation.frozen)) fail();
  return {
    deploymentEpoch: operation.deploymentEpoch, actorKey: operation.actorKey, operationId: operation.operationId,
    operationKind: operation.frozen.request.operationKind, method: operation.frozen.request.method,
    routeScope: operation.frozen.request.routeScope, requestTargetId: operation.frozen.request.requestTargetId,
    requestFingerprint: operation.frozen.requestFingerprint, frozenJson: JSON.stringify(operation.frozen),
    receiptCandidateId: receipt.candidateId, receiptFeature: receipt.feature, receiptLocalDocumentId: receipt.localDocumentId,
    receiptSourceDraftSequence: receipt.sourceDraftSequence, receiptSourceOperationSequence: receipt.sourceOperationSequence,
    receiptEditRevision: receipt.editRevision, receiptIssuedAtUtc: receipt.issuedAtUtc, receiptEligibleUntilUtc: receipt.eligibleUntilUtc,
    receiptSha256: createHash("sha256").update(receipt.receipt, "utf8").digest("hex"),
  };
}

export async function verifyProtectedCutoverState(baseline: ProtectedCutoverBaseline, state: ProtectedState): Promise<void> {
  const operation = state.operation, receipt = state.receipt;
  if (!operation || !receipt || state.claim !== undefined || operation.state !== "DISPATCHED" || operation.settlement !== null ||
      operation.deploymentEpoch !== baseline.deploymentEpoch || operation.actorKey !== baseline.actorKey || operation.operationId !== baseline.operationId ||
      operation.frozen.request.operationKind !== baseline.operationKind || operation.frozen.request.method !== baseline.method ||
      operation.frozen.request.routeScope !== baseline.routeScope || operation.frozen.request.requestTargetId !== baseline.requestTargetId ||
      operation.frozen.requestFingerprint !== baseline.requestFingerprint || JSON.stringify(operation.frozen) !== baseline.frozenJson ||
      receipt.candidateId !== baseline.receiptCandidateId || receipt.feature !== baseline.receiptFeature || receipt.localDocumentId !== baseline.receiptLocalDocumentId ||
      receipt.sourceDraftSequence !== baseline.receiptSourceDraftSequence || receipt.sourceOperationSequence !== baseline.receiptSourceOperationSequence ||
      receipt.editRevision !== baseline.receiptEditRevision || receipt.issuedAtUtc !== baseline.receiptIssuedAtUtc ||
      receipt.eligibleUntilUtc !== baseline.receiptEligibleUntilUtc || createHash("sha256").update(receipt.receipt, "utf8").digest("hex") !== baseline.receiptSha256 ||
      JSON.stringify(receipt.frozen) !== baseline.frozenJson) fail();
}
