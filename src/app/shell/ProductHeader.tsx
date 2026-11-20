import { useContext, useState, useSyncExternalStore } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, FlaskConical, Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { useStore } from "zustand";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuPositioner, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { hasModuleCapability } from "../runtime/moduleCapabilities";
import { ThemeContext } from "../theme";
import { AccountMenu } from "./AccountMenu";
import { SidebarNavigation } from "./ProductSidebar";
import { moduleLabel } from "./moduleNavigation";
import type { DocumentModule } from "../workspace/documentContracts";

function MobileNavigation({ displayName, busy, onLogout }: {
  displayName: string; busy: boolean; onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter({ warn: false });
  return (
    <div className="md:hidden">
      <Dialog open={open} onOpenChange={(nextOpen) => setOpen(nextOpen)}>
        <DialogTrigger render={<Button variant="ghost" size="icon" aria-label="Mở điều hướng" disabled={busy} />}>
          <MenuIcon aria-hidden="true" />
        </DialogTrigger>
        <DialogContent showCloseButton={false}
          className="top-0 left-0 h-dvh max-h-dvh w-[min(20rem,90vw)] max-w-[min(20rem,90vw)] -translate-x-0 -translate-y-0 gap-0 rounded-none border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <DialogHeader className="flex-row items-center justify-between border-b border-sidebar-border p-3">
            <DialogTitle>Điều hướng</DialogTitle>
            <DialogClose render={<Button variant="ghost" size="sm" />}>Đóng menu</DialogClose>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarNavigation busy={busy} onNavigate={() => setOpen(false)} />
            {router && import.meta.env.DEV && (
              <Link to="/lab/sales" search={{ scenario: "default" }}
                className="mx-3 flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-sidebar-accent"
                aria-disabled={busy || undefined} tabIndex={busy ? -1 : undefined}
                onClick={event => { if (busy) { event.preventDefault(); return; } setOpen(false); }}>
                <FlaskConical className="size-4" aria-hidden="true" />Sales Lab</Link>
            )}
            {router && import.meta.env.DEV && (
              <Link to="/lab/components" search={{ scenario: "default" }}
                className="mx-3 flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-sidebar-accent"
                aria-disabled={busy || undefined} tabIndex={busy ? -1 : undefined}
                onClick={event => { if (busy) { event.preventDefault(); return; } setOpen(false); }}>
                <FlaskConical className="size-4" aria-hidden="true" />Components Lab</Link>
            )}
          </div>
          <AccountMenu displayName={displayName} busy={busy} onLogout={() => { setOpen(false); onLogout(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ProductHeader({ collapsed, onToggle, displayName, busy, onLogout }: {
  collapsed: boolean;
  onToggle: () => void;
  displayName: string;
  busy: boolean;
  onLogout: () => void;
}) {
  const workspace = useWorkspace();
  const state = useStore(workspace.panelState);
  const layoutBusy = useStore(workspace.layouts.state, (value) => value.busy);
  const closeBusy = useStore(workspace.close.state, (value) => value.busy);
  const auth = useSyncExternalStore(workspace.auth.subscribe, workspace.auth.getSnapshot);
  const theme = useContext(ThemeContext);
  const active = state.activeId ? state.panels[state.activeId] : undefined;
  const canCreate = (module: DocumentModule) => hasModuleCapability(auth, workspace.portContext(), module, "write");
  const canSales = canCreate("sales"), canReceipt = canCreate("goods-receipt");
  const commandBusy = layoutBusy || closeBusy || busy;
  const create = (module: DocumentModule) => {
    // Recheck right before the command; never infer module from the active tab.
    if (commandBusy || !hasModuleCapability(workspace.auth.getSnapshot(), workspace.portContext(), module, "write")) return;
    void workspace.openDocument(module, null);
  };
  return (
    <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b bg-background px-3 py-2" aria-label="Thanh ứng dụng">
      <div className="hidden md:block">
        <Button variant="ghost" size="icon" onClick={onToggle}
          aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          aria-expanded={!collapsed} aria-controls="product-sidebar-navigation">
          {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
        </Button>
      </div>
      <MobileNavigation displayName={displayName} busy={busy} onLogout={onLogout} />
      <div aria-label="Đường dẫn" className="flex min-w-0 items-center gap-1 text-sm">
        <span className="text-muted-foreground">Workspace</span>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{moduleLabel(active?.module)}</span>
        {active && <><ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="max-w-40 truncate font-medium" title={active.title}>{active.title}</span></>}
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <Button variant="outline" size="sm" disabled={commandBusy || (!canSales && !canReceipt)}
              aria-label="Tạo chứng từ" />
          }>
            <Plus aria-hidden="true" /> Tạo chứng từ <ChevronDown aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuPositioner sideOffset={5} align="end">
              <DropdownMenuContent>
                <DropdownMenuItem disabled={!canSales} onClick={() => create("sales")}>Sales mới</DropdownMenuItem>
                <DropdownMenuItem disabled={!canReceipt} onClick={() => create("goods-receipt")}>Phiếu nhập mới</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPositioner>
          </DropdownMenuPortal>
        </DropdownMenu>
        {theme && <div role="group" aria-label="Giao diện" className="flex items-center gap-1">
          <Button variant="ghost" size="sm" aria-pressed={theme.mode === "light"} onClick={() => theme.setMode("light")}>Light</Button>
          <Button variant="ghost" size="sm" aria-pressed={theme.mode === "dark"} onClick={() => theme.setMode("dark")}>Dark</Button>
        </div>}
      </div>
    </header>
  );
}
