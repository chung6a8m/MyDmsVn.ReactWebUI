import type { IDockviewPanelProps } from "dockview";
import { InventoryReadPanel } from "./InventoryReadPanel";
export function StockBalancesPanel(props: Partial<IDockviewPanelProps>) {
  return <InventoryReadPanel card={false} api={props.api} />;
}
