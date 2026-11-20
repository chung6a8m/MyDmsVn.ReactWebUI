import { Link } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { Button } from "../../components/ui/button";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { hasModuleCapability } from "../runtime/moduleCapabilities";
import { AccountMenu } from "./AccountMenu";
import { moduleNavigation } from "./moduleNavigation";

export function SidebarNavigation({ collapsed = false, onNavigate }: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const workspace = useWorkspace();
  const auth = useSyncExternalStore(workspace.auth.subscribe, workspace.auth.getSnapshot);
  const panels = useStore(workspace.panelState);
  const layoutBusy = useStore(workspace.layouts.state, (state) => state.busy);
  const closeBusy = useStore(workspace.close.state, (state) => state.busy);
  const allowed = moduleNavigation.filter((item) => hasModuleCapability(auth, workspace.portContext(), item.module, "read"));

  return (
    <nav aria-label="Chức năng" className="flex min-w-0 flex-col gap-4 p-2">
      {(["Bán hàng", "Kho"] as const).map((group) => {
        const items = allowed.filter((item) => item.group === group);
        if (!items.length) return null;
        return <section key={group} aria-label={group}>
          <h2 className={collapsed ? "sr-only" : "px-2 pb-1 text-xs font-semibold text-muted-foreground"}>{group}</h2>
          <div className="flex flex-col gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = panels.activeId != null && panels.panels[panels.activeId]?.module === item.module;
              return (
                <Button key={item.module} variant={active ? "secondary" : "ghost"} size="sm"
                  aria-label={item.label} title={item.label}
                  aria-current={active ? "page" : undefined} disabled={layoutBusy || closeBusy}
                  className={collapsed ? "w-full justify-center px-0" : "w-full justify-start"}
                  onClick={() => {
                    // UI hints are never an authorization boundary.
                    if (!hasModuleCapability(workspace.auth.getSnapshot(), workspace.portContext(), item.module, "read")) return;
                    void workspace.openPanel(item.module);
                    onNavigate?.();
                  }}>
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                </Button>
              );
            })}
          </div>
        </section>;
      })}
      {allowed.length === 0 && !collapsed && <p className="px-2 text-xs text-muted-foreground">Chưa có danh sách được cấp quyền.</p>}
    </nav>
  );
}

export function ProductSidebar({ collapsed, displayName, busy, onLogout }: {
  collapsed: boolean;
  displayName: string;
  busy: boolean;
  onLogout: () => void;
}) {
  return (
    <aside data-testid="product-sidebar" aria-label="Sidebar ứng dụng"
      className={`hidden shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-150 md:flex ${collapsed ? "w-16" : "w-60"}`}>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground" aria-hidden="true">M</span>
        {collapsed ? <span className="sr-only">MyDmsVn</span> : <span className="min-w-0 truncate font-semibold">MyDmsVn</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto"><SidebarNavigation collapsed={collapsed} /></div>
      {import.meta.env.DEV && (
        <div className="border-t border-sidebar-border p-2">
          <Link className={`flex min-h-8 items-center gap-2 rounded-md px-2 text-xs hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-ring ${collapsed ? "justify-center" : ""}`}
            to="/lab/sales" search={{ scenario: "default" }} title="Sales Lab" aria-label="Sales Lab">
            <FlaskConical className="size-4 shrink-0" aria-hidden="true" />
            {collapsed ? <span className="sr-only">Sales Lab</span> : "Sales Lab"}
          </Link>
        </div>
      )}
      <AccountMenu collapsed={collapsed} displayName={displayName} busy={busy} onLogout={onLogout} />
    </aside>
  );
}
