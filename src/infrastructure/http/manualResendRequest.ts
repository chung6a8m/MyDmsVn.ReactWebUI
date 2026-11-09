import type { PortContext } from "../../ports/portContracts";
import type { AuthSession } from "./authSession";
import { ProtocolError } from "./authApi";
import { decodeDirectWriteRejection, type Web4DirectRejection } from "./directWriteRejection";
import { sameActor, type HttpTransport } from "./readBoundary";
import { decodeFrozenWeb4Operation, web4OperationPath, type FrozenWeb4Operation } from "./web4OperationCodec";
import { decodeWeb4OperationOutcome, type Web4CommittedResult } from "./operationStatusPort";

export async function manualResendRequest(transport: HttpTransport, auth: AuthSession, context: PortContext, input: FrozenWeb4Operation,
  dispatched: () => void, onCommitted?: (result: Web4CommittedResult) => void, onRejected?: (result: Web4DirectRejection) => void) {
  const frozen = await decodeFrozenWeb4Operation(input);
  if (!sameActor(auth, context) || frozen.actorKey !== context.actorKey || frozen.deploymentEpoch !== context.deploymentEpoch) throw new ProtocolError();
  let sent = false, data: unknown;
  try {
    data = await transport.request(web4OperationPath(frozen.request), { method: frozen.request.method, body: JSON.stringify(frozen.request.body), signal: context.signal,
      strictResponse: true, expectedStatus: 200, headers: { "Idempotency-Key": frozen.operationId, "X-MyDmsVn-Deployment-Epoch": frozen.deploymentEpoch } },
    () => { sent = true; dispatched(); });
  } catch (error) {
    if (sent && sameActor(auth, context)) { const rejection = decodeDirectWriteRejection(error, frozen.request.operationKind); if (rejection) onRejected?.(rejection); }
    throw error;
  }
  const result = decodeWeb4OperationOutcome(frozen.request, data);
  if (!sameActor(auth, context)) throw new ProtocolError();
  onCommitted?.(result); return result;
}
