import type { InventoryPort } from "../../ports/inventoryPort";
import type { AuthSession } from "./authSession";
import { readBoundary, type HttpTransport } from "./readBoundary";
import { balancesPageSchema, balancesQuerySchema, stockCardPageSchema, stockCardQuerySchema } from "./inventoryWireSchemas";
import { mapStockBalances, mapStockCard } from "./inventoryWireMapper";
import { serializeWeb3Query, web3ErrorEnvelopeSchema } from "./web3WireSchemas";
export function createInventoryHttpPort(transport: HttpTransport, auth: AuthSession): InventoryPort {
  return {
    balances: (query, context) => readBoundary(auth, context, async () => {
      const parameters = serializeWeb3Query(balancesQuerySchema, query);
      return mapStockBalances(balancesPageSchema.parse(await transport.request(`/api/v1/inventory/balances?${parameters}`, { signal: context.signal, strictResponse: true })));
    }, web3ErrorEnvelopeSchema),
    stockCard: (query, context) => readBoundary(auth, context, async () => {
      const parameters = serializeWeb3Query(stockCardQuerySchema, query);
      return mapStockCard(stockCardPageSchema.parse(await transport.request(`/api/v1/inventory/stock-card?${parameters}`, { signal: context.signal, strictResponse: true })));
    }, web3ErrorEnvelopeSchema),
  };
}
