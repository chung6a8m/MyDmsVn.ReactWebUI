import { useState, type ReactNode } from "react";
import { ProductSidebar } from "./ProductSidebar";
import { ProductHeader } from "./ProductHeader";

// A shell is chrome only: it receives the one retained production workspace
// as children. Collapsing, theme or mobile drawer never create another runtime.
export function ProductShell({ children, displayName, busy, onLogout, error }: {
  children: ReactNode;
  displayName: string;
  busy: boolean;
  onLogout: () => void;
  error?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div data-testid="product-shell" className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background text-foreground">
      <div id="product-sidebar-navigation" className="contents">
        <ProductSidebar collapsed={collapsed} displayName={displayName} busy={busy} onLogout={onLogout} />
      </div>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" aria-label="Ứng dụng MyDmsVn">
        <ProductHeader collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)}
          displayName={displayName} busy={busy} onLogout={onLogout} />
        {error && <p role="alert" className="border-b px-3 py-2 text-sm text-destructive">{error}</p>}
        <div data-testid="product-workspace" inert={busy} aria-busy={busy}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </section>
    </div>
  );
}
