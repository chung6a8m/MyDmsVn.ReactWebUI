import { describe, expect, it } from "vitest";
import { fingerprintWeb4Request } from "../../../src/infrastructure/http/web4OperationCodec";
import { captureProtectedCutoverState, verifyAuthenticCommittedCutoverSetup, verifyProtectedCutoverState } from "../../pilot/web6-cutover-helpers";

const epoch = "11111111-2222-4333-8444-555555555555";
const committedRequest = {
  operationKind: "Sales.Create", method: "POST", routeScope: "/api/v1/sales-receipts", requestTargetId: null,
  body: { saleDate: "2024-02-29", customerId: 1, warehouseId: 2, employeeId: 3, note: null,
    lines: [{ saleLineId: "0", productId: 4, qty: "1.0000", unitPrice: "25.0000", isGift: false }] },
} as const;
const operation = {
  schemaVersion: 1, deploymentEpoch: epoch, actorKey: "42", operationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  feature: "sales", localDocumentId: "local-1", localPersistSequence: 1, draftCheckpointSequence: 1,
  draftCheckpointEditRevision: 0, createdAt: "2026-11-10T00:00:00.000Z", state: "DISPATCHED", settlement: null,
  frozen: { schemaVersion: 1, deploymentEpoch: epoch, actorKey: "42", operationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    requestFingerprint: "8".repeat(64), request: { operationKind: "Sales.Create", method: "POST", routeScope: "collection", requestTargetId: null, body: { saleDate: "2024-02-29" } } },
} as any;
const receipt = {
  schemaVersion: 1, candidateId: "candidate-a", frozen: operation.frozen, feature: "sales", localDocumentId: "local-1",
  sourceDraftSequence: 1, sourceOperationSequence: 1, editRevision: 0,
  issuedAtUtc: "2026-11-10T00:00:00.0000000Z", eligibleUntilUtc: "2026-11-10T00:05:00.0000000Z", receipt: "private-receipt",
} as any;

describe("WEB6 cutover protected browser state", () => {
  it("binds one authentic committed-response-lost setup effect to its frozen request", async () => {
    const frozen = { ...operation.frozen, request: committedRequest, requestFingerprint: await fingerprintWeb4Request(committedRequest) };
    const committedOperation = { ...operation, frozen };
    await expect(verifyAuthenticCommittedCutoverSetup(committedOperation, {
      status: 200,
      operationId: committedOperation.operationId,
      deploymentEpoch: committedOperation.deploymentEpoch,
      method: committedOperation.frozen.request.method,
      pathname: "/api/v1/sales-receipts",
      body: committedOperation.frozen.request.body,
    })).resolves.toEqual({
      operationId: committedOperation.operationId,
      requestFingerprint: frozen.requestFingerprint,
      authorizedBusinessEffects: 1,
    });
  });

  it("rejects a committed setup whose transmitted body drifts", async () => {
    const frozen = { ...operation.frozen, request: committedRequest, requestFingerprint: await fingerprintWeb4Request(committedRequest) };
    const committedOperation = { ...operation, frozen };
    await expect(verifyAuthenticCommittedCutoverSetup(committedOperation, {
      status: 200, operationId: committedOperation.operationId, deploymentEpoch: committedOperation.deploymentEpoch,
      method: committedOperation.frozen.request.method, pathname: "/api/v1/sales-receipts", body: { saleDate: "2024-03-01" },
    })).rejects.toThrow(/committed cutover setup/);
  });

  it("requires the exact dispatched operation and receipt with no claim", async () => {
    const baseline = captureProtectedCutoverState(operation, receipt);
    await expect(verifyProtectedCutoverState(baseline, { operation, receipt, claim: undefined })).resolves.toBeUndefined();
  });

  it.each([
    ["missing operation", { operation: undefined, receipt, claim: undefined }],
    ["missing receipt", { operation, receipt: undefined, claim: undefined }],
    ["settled operation", { operation: { ...operation, state: "SETTLED" }, receipt, claim: undefined }],
    ["changed epoch", { operation: { ...operation, deploymentEpoch: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" }, receipt, claim: undefined }],
    ["changed frozen body", { operation: { ...operation, frozen: { ...operation.frozen, request: { ...operation.frozen.request, body: { saleDate: "2024-03-01" } } } }, receipt, claim: undefined }],
    ["changed receipt identity", { operation, receipt: { ...receipt, receipt: "different-private-receipt" }, claim: undefined }],
    ["claim appeared", { operation, receipt, claim: { state: "CLAIMED" } }],
  ])("rejects %s", async (_name, state) => {
    const baseline = captureProtectedCutoverState(operation, receipt);
    await expect(verifyProtectedCutoverState(baseline, state as any)).rejects.toThrow(/protected cutover state/);
  });
});
