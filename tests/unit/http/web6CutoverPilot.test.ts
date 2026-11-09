import { describe, expect, it } from "vitest";
import { captureProtectedCutoverState, verifyProtectedCutoverState } from "../../pilot/web6-cutover-helpers";

const epoch = "11111111-2222-4333-8444-555555555555";
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
