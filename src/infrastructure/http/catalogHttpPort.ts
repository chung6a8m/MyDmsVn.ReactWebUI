import type { CatalogPort } from "../../ports/catalogPort";
import type { AuthSession } from "./authSession";
import { readBoundary, type HttpTransport } from "./readBoundary";
import { catalogSchema } from "./salesWireSchemas";
const routes = { product: "products", customer: "customers", warehouse: "warehouses", employee: "employees" };
export function createCatalogHttpPort(transport: HttpTransport, auth: AuthSession): CatalogPort {
  return { search: (query, context) => readBoundary(auth, context, async () => {
    if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 200) throw new Error("Invalid lookup limit");
    const parameters = new URLSearchParams({ search: query.search, limit: String(query.limit) });
    return catalogSchema.parse(await transport.request(`/api/v1/catalog/${routes[query.kind]}/lookup?${parameters}`, { signal: context.signal })).map(row => ({ ...row, id: String(row.id) }));
  }) };
}
