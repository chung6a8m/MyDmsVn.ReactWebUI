import { createRoute, type AnyRootRoute } from "@tanstack/react-router";
import { LabProvider } from "./runtime/LabProvider";
import { SalesLab } from "./SalesLab";
import { ComponentsLab } from "./ComponentsLab";
import { GoodsReceiptLab } from "./GoodsReceiptLab";
import { InventoryLab } from "./InventoryLab";
import { FilterResultsRecipe } from "./recipes/FilterResultsRecipe";
import { DocumentEditRecipe } from "./recipes/DocumentEditRecipe";
import { parseScenario } from "../infrastructure/fake/fakeCatalogPort";
import { findCatalogEntry, parseCatalogEntry } from "./catalog/catalogEntries";

export function createLabRoutes(root: AnyRootRoute) {
  const lab = createRoute({ getParentRoute: () => root, path: "/lab", component: LabProvider });
  const sales = createRoute({
    getParentRoute: () => lab, path: "/sales",
    validateSearch: (search: Record<string, unknown>) => ({
      scenario: (["success", "known-failure", "forbidden", "version-conflict",
        "reference-conflict", "delay", "commit-then-response-lost", "eventual-commit"] as const)
        .find(mode => mode === search.scenario) ?? ("default" as const),
    }),
    component: SalesLab,
  });
  const components = createRoute({
    getParentRoute: () => lab, path: "/components",
    validateSearch: (search: Record<string, unknown>) => ({
      scenario: parseScenario(search.scenario),
      ...(typeof search.entry === "string" ? {
        entry: parseCatalogEntry(search.entry),
        invalidEntry: !findCatalogEntry(search.entry),
      } : {}),
    }),
    component: ComponentsLab,
  });
  const receipts = createRoute({ getParentRoute: () => lab, path: "/receipts", component: GoodsReceiptLab });
  const inventory = createRoute({ getParentRoute: () => lab, path: "/inventory", component: InventoryLab });
  const filters = createRoute({ getParentRoute: () => lab, path: "/recipes/filters", component: FilterResultsRecipe });
  const documentEdit = createRoute({ getParentRoute: () => lab, path: "/recipes/document-edit", component: DocumentEditRecipe });
  return [lab.addChildren([sales, components, receipts, inventory, filters, documentEdit])];
}
