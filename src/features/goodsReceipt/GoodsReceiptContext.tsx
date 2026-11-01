import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { createGoodsReceiptWorkspaceAdapter } from "./goodsReceiptWorkspaceAdapter";
export type GoodsReceiptRuntime = ReturnType<typeof createGoodsReceiptWorkspaceAdapter>;
const Context = createContext<GoodsReceiptRuntime | null>(null);
export function GoodsReceiptProvider({ runtime, children }: { runtime: GoodsReceiptRuntime; children: ReactNode }) {
  useEffect(() => runtime.connectAuth(), [runtime]);
  return <Context.Provider value={runtime}>{children}</Context.Provider>;
}
export function useGoodsReceipt() {
  const runtime = useContext(Context);
  if (!runtime) throw Error("GoodsReceiptProvider is required");
  return runtime;
}
