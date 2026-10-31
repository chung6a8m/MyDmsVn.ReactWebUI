import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { App } from "./App";
import { SalesWorkspace } from "../features/sales/SalesWorkspace";
import { SalesLab } from "../lab/SalesLab";
import { ComponentsLab } from "../lab/ComponentsLab";
import { parseScenario } from "../infrastructure/fake/fakeCatalogPort";
const root = createRootRoute({
  component: App,
  notFoundComponent: () => <p className="p-4">Không tìm thấy trang.</p>,
});
const home = createRoute({
  getParentRoute: () => root,
  path: "/",
  component: SalesWorkspace,
});
const validateSearch = (search: Record<string, unknown>) => ({
  scenario: parseScenario(search.scenario),
});
const sales = createRoute({
  getParentRoute: () => root,
  path: "/lab/sales",
  validateSearch: (search: Record<string, unknown>) => ({
    scenario:
      (
        [
          "success",
          "known-failure",
          "forbidden",
          "version-conflict",
          "reference-conflict",
          "delay",
          "commit-then-response-lost",
          "eventual-commit",
        ] as const
      ).find((mode) => mode === search.scenario) ?? ("default" as const),
  }),
  component: SalesLab,
});
const components = createRoute({
  getParentRoute: () => root,
  path: "/lab/components",
  validateSearch,
  component: ComponentsLab,
});
export const router = createRouter({
  routeTree: root.addChildren([home, sales, components]),
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
