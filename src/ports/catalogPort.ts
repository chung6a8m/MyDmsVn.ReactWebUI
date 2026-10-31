import type {
  CatalogQuery,
  LookupOption,
  PortContext,
  ReadResult,
} from "../features/sales/contracts";

export interface CatalogPort {
  search(
    query: CatalogQuery,
    context: PortContext,
  ): Promise<ReadResult<readonly LookupOption[]>>;
}
