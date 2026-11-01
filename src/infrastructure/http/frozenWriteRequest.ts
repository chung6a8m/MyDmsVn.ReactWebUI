import type { PortContext } from "../../ports/portContracts";
import type { AuthSession } from "./authSession";
import { ProtocolError } from "./authApi";
import { sameActor, type HttpTransport } from "./readBoundary";
import { canonicalizeWeb4Request, decodeFrozenWeb4Operation, web4OperationPath, type FrozenWeb4Operation, type Web4WireIntent } from "./web4OperationCodec";
import { decodeWeb4OperationOutcome, type Web4CommittedResult } from "./operationStatusPort";
import { decodeDirectWriteRejection, type Web4DirectRejection } from "./directWriteRejection";

export interface FrozenWriteOptions { operation?: FrozenWeb4Operation; onCommitted?: (result: Web4CommittedResult) => void; onRejected?: (result: Web4DirectRejection) => void; }
export async function frozenWriteRequest(
  transport: HttpTransport, auth: AuthSession, context: PortContext, operation: FrozenWeb4Operation,
  expected: Web4WireIntent, dispatched: () => void, onCommitted?: (result: Web4CommittedResult) => void,
  onRejected?: (result: Web4DirectRejection) => void,
) {
  // Rehash persisted intent, then recheck the actor after the asynchronous hash.
  // Canonical equality permits B01 equivalent decimal spellings; only the
  // original frozen body is ever sent, never the newly built UI request.
  const frozen = await decodeFrozenWeb4Operation(operation);
  if (!sameActor(auth, context) || frozen.actorKey !== context.actorKey || frozen.deploymentEpoch !== context.deploymentEpoch ||
    canonicalizeWeb4Request(frozen.request) !== canonicalizeWeb4Request(expected)) throw new ProtocolError();
  let sent = false;
  let data: unknown;
  try { data = await transport.request(web4OperationPath(frozen.request), {
    method: frozen.request.method, body: JSON.stringify(frozen.request.body), signal: context.signal,
    strictResponse: true, expectedStatus: 200,
    headers: { "Idempotency-Key": frozen.operationId, "X-MyDmsVn-Deployment-Epoch": frozen.deploymentEpoch },
  }, () => { sent = true; dispatched(); }); }
  catch (error) {
    if (sent && sameActor(auth, context)) {
      const proof = decodeDirectWriteRejection(error, frozen.request.operationKind);
      if (proof) onRejected?.(proof);
    }
    throw error;
  }
  const outcome = decodeWeb4OperationOutcome(frozen.request, data);
  if (!sameActor(auth, context)) throw new ProtocolError();
  onCommitted?.(outcome);
  return outcome;
}
