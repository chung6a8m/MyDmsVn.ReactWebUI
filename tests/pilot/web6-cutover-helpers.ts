import type { ManualResendClaim, ManualResendReceipt } from "../../src/infrastructure/drafts/web6ManualResendRepository";
import type { DurableOperationRecord } from "../../src/infrastructure/drafts/web4OperationRepository";
import { createHash } from "node:crypto";
import { fingerprintWeb4Request, web4OperationPath } from "../../src/infrastructure/http/web4OperationCodec";

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

export type CommittedCutoverWire = {
  status: number;
  operationId: string | undefined;
  deploymentEpoch: string | undefined;
  method: string;
  pathname: string;
  body: unknown;
};

export async function verifyAuthenticCommittedCutoverSetup(operation: DurableOperationRecord, wire: CommittedCutoverWire) {
  try {
    const transmitted = { ...operation.frozen.request, body: wire.body };
    if (wire.status !== 200 || operation.state !== "DISPATCHED" || operation.settlement !== null ||
        wire.operationId !== operation.operationId || wire.deploymentEpoch !== operation.deploymentEpoch ||
        wire.method !== operation.frozen.request.method || wire.pathname !== web4OperationPath(operation.frozen.request) ||
        await fingerprintWeb4Request(transmitted) !== operation.frozen.requestFingerprint) throw Error();
  } catch {
    throw Error("Invalid authentic committed cutover setup.");
  }
  return {
    operationId: operation.operationId,
    operationKind: operation.frozen.request.operationKind,
    requestFingerprint: operation.frozen.requestFingerprint,
    authorizedBusinessEffects: 1 as const,
    checkId: "web6-cutover-authentic-committed-setup" as const,
  };
}

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
