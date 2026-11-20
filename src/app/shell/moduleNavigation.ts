import { ShoppingCart, ClipboardList, Boxes, BookOpenText, type LucideIcon } from "lucide-react";
import type { ModuleKey } from "../workspace/documentContracts";

export interface ModuleNavigationItem {
  module: ModuleKey;
  label: string;
  group: "Bán hàng" | "Kho";
  icon: LucideIcon;
}

export const moduleNavigation: readonly ModuleNavigationItem[] = [
  { module: "sales", label: "Bán hàng", group: "Bán hàng", icon: ShoppingCart },
  { module: "goods-receipt", label: "Phiếu nhập", group: "Kho", icon: ClipboardList },
  { module: "inventory-balances", label: "Tồn kho", group: "Kho", icon: Boxes },
  { module: "inventory-stock-card", label: "Thẻ kho", group: "Kho", icon: BookOpenText },
];

export function moduleLabel(module: ModuleKey | undefined) {
  return moduleNavigation.find((item) => item.module === module)?.label ?? "Workspace";
}
