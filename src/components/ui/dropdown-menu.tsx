import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "cn";

// Nova tokens + the pinned Base UI menu. The library owns focus, Escape,
// dismissal, position and keyboard interaction; callers supply only actions.
function DropdownMenu(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root {...props} />;
}
function DropdownMenuTrigger(props: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}
function DropdownMenuPortal(props: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal {...props} />;
}
function DropdownMenuPositioner({ className, ...props }: MenuPrimitive.Positioner.Props) {
  return <MenuPrimitive.Positioner data-slot="dropdown-menu-positioner" className={cn("z-50", className)} {...props} />;
}
function DropdownMenuContent({ className, ...props }: MenuPrimitive.Popup.Props) {
  return <MenuPrimitive.Popup data-slot="dropdown-menu-content"
    className={cn("min-w-44 rounded-lg border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg outline-none", className)} {...props} />;
}
function DropdownMenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return <MenuPrimitive.Item data-slot="dropdown-menu-item"
    className={cn("flex min-h-8 cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className)} {...props} />;
}
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuPositioner, DropdownMenuContent, DropdownMenuItem };
