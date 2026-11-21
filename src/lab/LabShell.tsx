import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { catalogEntries, type CatalogEntry, type CatalogGroup } from "./catalog/catalogEntries";

const groups: readonly { id: CatalogGroup; label: string }[] = [
  { id: "primitives", label: "Primitives" },
  { id: "controls", label: "Controls" },
  { id: "recipes", label: "Recipes" },
];
function CatalogLink({ entry }: { entry: CatalogEntry }) {
  const label = entry.title + (entry.status === "planned" ? " · Planned" : "");
  switch (entry.path) {
    case "filters": return <Link className="block rounded px-2 py-1.5 hover:bg-accent focus-visible:outline-2" to="/lab/recipes/filters">{label}</Link>;
    case "document-edit": return <Link className="block rounded px-2 py-1.5 hover:bg-accent focus-visible:outline-2" to="/lab/recipes/document-edit">{label}</Link>;
    case "receipts": return <Link className="block rounded px-2 py-1.5 hover:bg-accent focus-visible:outline-2" to="/lab/receipts">{label}</Link>;
    case "inventory": return <Link className="block rounded px-2 py-1.5 hover:bg-accent focus-visible:outline-2" to="/lab/inventory">{label}</Link>;
    default: return <Link className="block rounded px-2 py-1.5 hover:bg-accent focus-visible:outline-2" to="/lab/components"
      search={{ scenario: "default", entry: entry.id }}>{label}</Link>;
  }
}
export function LabShell() {
  const path = useLocation({ select: location => location.pathname });
  return <div className="flex min-h-0 flex-1 overflow-hidden" data-testid="lab-shell">
    <aside className="hidden w-64 shrink-0 overflow-auto border-r bg-muted/20 p-3 text-sm lg:block" aria-label="UI Lab catalog">
      <h2 className="mb-3 font-semibold">UI Lab Catalog</h2>
      <nav aria-label="Lab journeys" className="mb-4 space-y-1">
        <Link className="block rounded px-2 py-1 hover:bg-accent" to="/lab/sales" search={{scenario:"default"}}>Sales Lab</Link>
        <Link className="block rounded px-2 py-1 hover:bg-accent" to="/lab/receipts">Receipt Lab</Link>
        <Link className="block rounded px-2 py-1 hover:bg-accent" to="/lab/inventory">Inventory Lab</Link>
        <Link className="block rounded px-2 py-1 hover:bg-accent" to="/lab/components" search={{scenario:"default",entry:"button"}}>Components Lab</Link>
      </nav>
      {groups.map(group => <section key={group.id} className="mb-3" aria-label={group.label}>
        <h3 className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
        {catalogEntries.filter(entry => entry.group === group.id).map(entry =>
          <CatalogLink key={entry.id} entry={entry} />)}
      </section>)}
      <p className="text-xs text-muted-foreground">DEV only · fake runtime và query cache riêng; không phải bằng chứng SQL/HTTP.</p>
    </aside>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <nav aria-label="Lab quick links" className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 border-b px-4 py-2 text-xs lg:hidden">
        <Link to="/lab/sales" search={{scenario:"default"}}>Sales</Link>
        <Link to="/lab/receipts">Receipt</Link>
        <Link to="/lab/inventory">Inventory</Link>
        <Link to="/lab/components" search={{scenario:"default",entry:"button"}}>Catalog</Link>
        <Link to="/lab/recipes/filters">Filter recipe</Link>
        <Link to="/lab/recipes/document-edit">Edit recipe</Link>
      </nav>
      <div className="sr-only" aria-live="polite">Lab: {path}</div>
      <Outlet />
    </div>
  </div>;
}
