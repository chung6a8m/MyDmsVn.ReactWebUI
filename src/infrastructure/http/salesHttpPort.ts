import type { SalesPort } from "../../ports/salesPort";
import type { AuthSession } from "./authSession";
import { readBoundary, type HttpTransport } from "./readBoundary";
import { longIdSchema, salesDetailSchema, salesPageSchema } from "./salesWireSchemas";
import { mapSalesDetail, mapSalesPage } from "./salesWireMapper";
import { ProtocolError } from "./authApi";
export function createSalesHttpPort(transport: HttpTransport, auth: AuthSession): SalesPort {
  const disconnected = async () => ({ kind: "failed" as const, error: { kind: "unavailable" as const, code: "Sales.WriteNotConnected", message: "Ghi Sales chưa được kết nối (WEB2-09)." } });
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
    save: disconnected, post: disconnected,
  };
}
