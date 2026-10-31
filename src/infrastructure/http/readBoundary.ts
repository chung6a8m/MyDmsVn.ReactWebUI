import { ZodError } from "zod";
import type { PortContext, ReadResult, UiFailure } from "../../features/sales/contracts";
import type { AuthSession } from "./authSession";
import { HttpError, ProtocolError } from "./authApi";
import { errorEnvelopeSchema } from "./salesWireSchemas";
export interface HttpTransport {
  // Called immediately before fetch, after token/scope/abort preflight.
  request(path: string, init?: RequestInit, onDispatch?: () => void): Promise<unknown>;
}
export function sameActor(auth: AuthSession, context: PortContext) {
  const current = auth.getSnapshot();
  return current.status === "authenticated" && current.actorKey === context.actorKey && current.actorGeneration === context.actorGeneration && !context.signal.aborted;
}
export function mapReadFailure(error: unknown): UiFailure {
  if (error instanceof HttpError) {
    const parsed = errorEnvelopeSchema.safeParse(error.body);
    const kind = error.status === 401 ? "unauthorized" : error.status === 403 ? "forbidden" : error.status === 404 ? "not-found" : error.status === 409 ? "conflict" : error.status === 400 ? "validation" : "unavailable";
    if (!parsed.success) return { kind: error.status === 401 ? "unauthorized" : "protocol", code: "Protocol.InvalidError", message: "Phản hồi lỗi không đúng hợp đồng." };
    const value = parsed.data.error;
    return { kind, code: value.code, message: value.message, correlationId: value.correlationId, issues: value.details?.map(issue => ({ ...issue, field: issue.field ?? "" })) };
  }
  if (error instanceof ZodError || error instanceof ProtocolError) return { kind: "protocol", code: "Protocol.InvalidResponse", message: "Phản hồi máy chủ không đúng hợp đồng." };
  return { kind: "unavailable", code: "Transport.Unavailable", message: "Không thể đọc dữ liệu máy chủ." };
}
export async function readBoundary<T>(auth: AuthSession, context: PortContext, work: () => Promise<T>): Promise<ReadResult<T>> {
  const stale = (): ReadResult<T> => ({ kind: "failed", error: { kind: "unauthorized", code: "Auth.StaleActor", message: "Phiên đọc không còn hiệu lực." } });
  if (!sameActor(auth, context)) return stale();
  try {
    const value = await work();
    return sameActor(auth, context) ? { kind: "success", value } : stale();
  } catch (error) { return sameActor(auth, context) ? { kind: "failed", error: mapReadFailure(error) } : stale(); }
}
