import { createContext, useContext, type ReactNode } from "react";
import type { InventoryPort } from "../../ports/inventoryPort";
import type { CatalogPort } from "../../ports/catalogPort";
export interface InventoryRuntime {
  port: InventoryPort;
  catalog: CatalogPort;
}
const Context = createContext<InventoryRuntime | null>(null);
export function InventoryProvider({
  runtime,
  children,
}: {
  runtime: InventoryRuntime;
  children: ReactNode;
}) {
  return <Context.Provider value={runtime}>{children}</Context.Provider>;
}
export function useInventory() {
  const value = useContext(Context);
  if (!value) throw Error("InventoryProvider is required");
  return value;
}
