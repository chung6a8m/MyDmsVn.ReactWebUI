import type { SalesPort } from "../../ports/salesPort";
import type { AuthSession } from "./authSession";
import { readBoundary, type HttpTransport } from "./readBoundary";
import { longIdSchema, postAcknowledgementSchema, salesDetailSchema, salesPageSchema } from "./salesWireSchemas";
import { mapSalesDetail, mapSalesPage, mapSaveInput, mapSavedDetail, mapWriteIssues } from "./salesWireMapper";
import { ProtocolError } from "./authApi";
import { writeBoundary } from "./writeBoundary";
import { frozenWriteRequest, type FrozenWriteOptions } from "./frozenWriteRequest";
import { salesSaveOperationRequest, salesPostOperationRequest } from "./web4OperationCodec";
export function createSalesHttpPort(transport: HttpTransport, auth: AuthSession, options: FrozenWriteOptions = {}): SalesPort {
  return {
    list: (query, context) => readBoundary(auth, context, async () => {
      if (!Number.isInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 200) throw new ProtocolError();
      const parameters = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) if (value !== undefined) parameters.set(key, String(value));
      return mapSalesPage(salesPageSchema.parse(await transport.request(`/api/v1/sales-receipts?${parameters}`, { signal: context.signal })));
    }),
    get: (saleId, context) => readBoundary(auth, context, async () => {
      const detail = salesDetailSchema.parse(await transport.request(`/api/v1/sales-receipts/${longIdSchema.parse(saleId)}`, { signal: context.signal }));
      if (detail.saleId !== saleId) throw new ProtocolError();
      return mapSalesDetail(detail);
    }),
    async save(input, context) {
      const snapshot = structuredClone(input);
      const result = await writeBoundary(auth, context, async dispatched => {
        if (options.operation) {
          const outcome = await frozenWriteRequest(transport, auth, context, options.operation, salesSaveOperationRequest(snapshot), dispatched, options.onCommitted, options.onRejected);
          if (outcome.operationKind !== "Sales.Create" && outcome.operationKind !== "Sales.Update") throw new ProtocolError();
          return mapSavedDetail(outcome.value, snapshot);
        }
        const body = mapSaveInput(snapshot);
        const saleId = snapshot.saleId === null ? null : longIdSchema.parse(snapshot.saleId);
        if (saleId && !snapshot.expectedVersion) throw new ProtocolError();
        const path = saleId ? `/api/v1/sales-receipts/${saleId}/draft` : "/api/v1/sales-receipts";
        const data = await transport.request(path, { method: saleId ? "PUT" : "POST", body: JSON.stringify(saleId ? { ...body, expectedVersion: snapshot.expectedVersion } : body), signal: context.signal }, dispatched);
        return mapSavedDetail(salesDetailSchema.parse(data), snapshot);
      });
      return result.kind === "failed" ? { ...result, error: mapWriteIssues(result.error, snapshot) } : result;
    },
    post: (input, context) => writeBoundary(auth, context, async dispatched => {
      if (options.operation) {
        const outcome = await frozenWriteRequest(transport, auth, context, options.operation, salesPostOperationRequest(input), dispatched, options.onCommitted, options.onRejected);
        if (outcome.operationKind !== "Sales.Post") throw new ProtocolError();
        return outcome.value;
      }
      const saleId = longIdSchema.parse(input.saleId);
      if (!input.expectedVersion) throw new ProtocolError();
      const acknowledgement = postAcknowledgementSchema.parse(await transport.request(`/api/v1/sales-receipts/${saleId}/post`, { method: "POST", body: JSON.stringify({ expectedVersion: input.expectedVersion }), signal: context.signal }, dispatched));
      if (acknowledgement.saleId !== saleId) throw new ProtocolError();
      return acknowledgement;
    }),
  };
}
