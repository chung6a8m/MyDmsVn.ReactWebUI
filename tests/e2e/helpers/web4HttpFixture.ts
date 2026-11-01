import type { Request } from "@playwright/test";
import { fingerprintWeb4Request, type Web4WireIntent } from "../../../src/infrastructure/http/web4OperationCodec";
export const web4Epoch = "11111111-2222-4333-8444-555555555555";
export const web4Context = (actorUserId: number) => ({ data: { deploymentEpoch: web4Epoch, actorUserId, contractVersion: "web4-v1" } });
// Browser error-injection fixture only. B01 vector tests and actual TestServer
// integration separately verify the canonical hash; this is not a server oracle.
export async function protectedStatusFixture(request: Request, outcome: unknown) {
  const path = new URL(request.url()).pathname, parts = path.split("/");
  const module = parts[3] === "sales-receipts" ? "Sales" : "Receipt";
  const create = parts.length === 4, post = parts.at(-1) === "post";
  const parameter = module === "Sales" ? "saleId" : "receiptId";
  const intent = { operationKind: `${module}.${create ? "Create" : post ? "Post" : "Update"}`,
    method: request.method(), routeScope: create ? path : `/api/v1/${parts[3]}/{${parameter}}/${post ? "post" : "draft"}`,
    requestTargetId: create ? null : parts[4], body: request.postDataJSON() } as Web4WireIntent;
  return { data: { deploymentEpoch: web4Epoch, operationId: request.headers()["idempotency-key"], requestFingerprint: await fingerprintWeb4Request(intent),
    operationKind: intent.operationKind, method: intent.method, routeScope: intent.routeScope, requestTargetId: intent.requestTargetId, state: "COMMITTED", outcome: { data: structuredClone(outcome) } } };
}
