import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { App } from "./App";
import { FoundationWorkspace } from "../features/sales/FoundationWorkspace";
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
  component: FoundationWorkspace,
});
const validateSearch = (search: Record<string, unknown>) => ({
  scenario: parseScenario(search.scenario),
});
const sales = createRoute({
  getParentRoute: () => root,
  path: "/lab/sales",
  validateSearch,
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
