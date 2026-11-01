import type { Web4OperationKind } from "./web4OperationCodec";
import { HttpError } from "./authApi";
import { web3ErrorEnvelopeSchema } from "./web3WireSchemas";
export interface Web4DirectRejection { operationKind: Web4OperationKind; httpStatus: number; code: string }
export function validateDirectRejection(value: unknown, operationKind: Web4OperationKind): Web4DirectRejection {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid direct rejection");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).sort().join(",") !== "code,httpStatus,operationKind" || input.operationKind !== operationKind ||
    !["Sales.Create", "Sales.Update", "Sales.Post", "Receipt.Create", "Receipt.Update", "Receipt.Post"].includes(operationKind)) throw new Error("Invalid direct rejection");
  const prefix = operationKind.startsWith("Sales.") ? "SalesReceipt" : "GoodsReceipt";
  const allowed = input.httpStatus === 400 && input.code === "ValidationError" ||
    !operationKind.endsWith(".Create") && (input.httpStatus === 404 && input.code === `${prefix}.NotFound` ||
      input.httpStatus === 409 && [
        `${prefix}.ConcurrencyConflict`, `${prefix}.AlreadyPosted`,
      ].includes(input.code as string));
  if (!allowed) throw new Error("Invalid direct rejection");
  return { operationKind, httpStatus: input.httpStatus as number, code: input.code as string };
}
// Only a still-live coordinator that won a new atomic first-dispatch claim may
// consume this proof. Negative status reads and older unresolved attempts never do.
export function decodeDirectWriteRejection(error: unknown, operationKind: Web4OperationKind): Web4DirectRejection | undefined {
  if (!(error instanceof HttpError)) return;
  const envelope = web3ErrorEnvelopeSchema.safeParse(error.body);
  if (!envelope.success) return;
  try { return validateDirectRejection({ operationKind, httpStatus: error.status, code: envelope.data.error.code }, operationKind); }
  catch { return; }
}
