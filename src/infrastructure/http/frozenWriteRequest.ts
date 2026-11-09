import type { PortContext } from "../../ports/portContracts";
import type { AuthSession } from "./authSession";
import { ProtocolError } from "./authApi";
import { sameActor, type HttpTransport } from "./readBoundary";
import { canonicalizeWeb4Request, decodeFrozenWeb4Operation, type FrozenWeb4Operation, type Web4WireIntent } from "./web4OperationCodec";
import type { Web4CommittedResult } from "./operationStatusPort";
import type { Web4DirectRejection } from "./directWriteRejection";
import { manualResendRequest } from "./manualResendRequest";

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
  return manualResendRequest(transport, auth, context, frozen, dispatched, onCommitted, onRejected);
}
