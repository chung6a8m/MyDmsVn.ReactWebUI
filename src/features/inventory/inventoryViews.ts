import { createStore, type StoreApi } from "zustand/vanilla";
import { emptyLookup, type LookupValue } from "../../shared/lookup/lookupTypes";
import type { StockBalancesQuery } from "./contracts";
type Filters = Readonly<Record<string, string | number>> | undefined;
export interface InventoryView {
  local: StockBalancesQuery & { fromUtc?: string; toUtc?: string };
  warehouse: LookupValue;
  product: LookupValue;
}
const lookup = (id: string | number | undefined): LookupValue => typeof id === "string"
  ? { selectedId: id, query: `ID ${id}`, displayText: `ID ${id}`, confirmed: true, composing: false }
  : { ...emptyLookup };
// Ephemeral feature state: panel identity survives renderer detach; layout storage never receives it.
export function createInventoryViews() {
  const entries = new Map<string, { filters: Filters; store: StoreApi<InventoryView> }>();
  return {
    panel(id: string, filters: Filters) {
      let entry = entries.get(id);
      if (!entry || entry.filters !== filters) {
        entry = { filters, store: createStore<InventoryView>(() => ({ local: { pageNumber: 1, pageSize: 25 }, warehouse: lookup(filters?.warehouseId), product: lookup(filters?.productId) })) };
        entries.set(id, entry);
      }
      return entry.store;
    },
    retain(ids: readonly string[]) {
      const live = new Set(ids);
      for (const id of entries.keys()) if (!live.has(id)) entries.delete(id);
    },
    clear() { entries.clear(); },
  };
}
