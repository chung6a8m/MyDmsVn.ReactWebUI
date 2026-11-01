import type { IDockviewPanelProps } from "dockview";
import { InventoryReadPanel } from "./InventoryReadPanel";
export function StockCardPanel(props: Partial<IDockviewPanelProps>) {
  return <InventoryReadPanel card api={props.api} />;
}
