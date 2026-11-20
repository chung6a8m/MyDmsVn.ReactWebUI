import { CircleUserRound, LogOut } from "lucide-react";
import { Button } from "../../components/ui/button";

export function AccountMenu({ displayName, busy, onLogout, collapsed = false }: {
  displayName: string;
  busy: boolean;
  onLogout: () => void;
  collapsed?: boolean;
}) {
  return (
    <div role="group" aria-label="Tài khoản" className="flex shrink-0 flex-col gap-2 border-t border-sidebar-border p-2">
      <div className="flex min-w-0 items-center gap-2 px-1 py-1.5" title={displayName}>
        <CircleUserRound className="size-4 shrink-0" aria-hidden="true" />
        {collapsed ? <span className="sr-only">{displayName}</span> :
          <span className="min-w-0 truncate text-sm font-medium">{displayName}</span>}
      </div>
      <Button variant="ghost" size={collapsed ? "icon" : "sm"}
        title="Đăng xuất" aria-label="Đăng xuất" disabled={busy}
        onClick={onLogout} className={collapsed ? "self-center" : "w-full justify-start"}>
        <LogOut aria-hidden="true" />
        {!collapsed && <span>Đăng xuất</span>}
      </Button>
    </div>
  );
}
