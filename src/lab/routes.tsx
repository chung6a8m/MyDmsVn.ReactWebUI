import { createRoute, type AnyRootRoute } from "@tanstack/react-router";
import { LabProvider } from "./runtime/LabProvider";
import { SalesLab } from "./SalesLab";
import { ComponentsLab } from "./ComponentsLab";
import { parseScenario } from "../infrastructure/fake/fakeCatalogPort";
export function createLabRoutes(root: AnyRootRoute) {
  const lab = createRoute({ getParentRoute: () => root, path: "/lab", component: LabProvider });
  const sales = createRoute({
    getParentRoute: () => lab, path: "/sales",
    validateSearch: (search: Record<string, unknown>) => ({
      scenario: (["success", "known-failure", "forbidden", "version-conflict",
        "reference-conflict", "delay", "commit-then-response-lost", "eventual-commit"] as const)
        .find((mode) => mode === search.scenario) ?? ("default" as const),
    }),
    component: SalesLab,
  });
  const components = createRoute({
    getParentRoute: () => lab, path: "/components",
    validateSearch: (search: Record<string, unknown>) => ({ scenario: parseScenario(search.scenario) }),
    component: ComponentsLab,
  });
  return [lab.addChildren([sales, components])];
}
