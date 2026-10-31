import type { PortContext, WriteResult } from "../../features/sales/contracts";
import type { AuthSession } from "./authSession";
import { HttpError } from "./authApi";
import { mapReadFailure, sameActor } from "./readBoundary";
import { errorEnvelopeSchema } from "./salesWireSchemas";

export async function writeBoundary<T>(auth: AuthSession, context: PortContext, work: (dispatched: () => void) => Promise<T>): Promise<WriteResult<T>> {
  if (!sameActor(auth, context)) return { kind: "failed", dispatched: false, error: { kind: "unauthorized", code: "Auth.StaleActor", message: "Phiên ghi không còn hiệu lực." } };
  let dispatched = false;
  try {
    const value = await work(() => { dispatched = true; });
    return sameActor(auth, context) ? { kind: "success", value } : { kind: "outcome-unknown" };
  } catch (error) {
    if (!dispatched) return { kind: "failed", dispatched: false, error: mapReadFailure(error) };
    // Only a valid, known business rejection proves this dispatched write did
    // not commit. Invalid success/error bodies and transport loss stay locked.
    if (sameActor(auth, context) && error instanceof HttpError && [400, 403, 404, 409].includes(error.status) && errorEnvelopeSchema.safeParse(error.body).success)
      return { kind: "failed", error: mapReadFailure(error) };
    return { kind: "outcome-unknown" };
  }
}
