import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { App } from "./App";
import { ApplicationEntry } from "./runtime/ApplicationEntry";
const root = createRootRoute({
  component: App,
  notFoundComponent: () => <p className="p-4">Không tìm thấy trang.</p>,
});
const home = createRoute({ getParentRoute: () => root, path: "/", component: ApplicationEntry });
// Vite removes this branch and its entire module graph in production builds.
// HTTP/auth composition belongs to WEB2-07–09, never a fake fallback.
const labRoutes = import.meta.env.DEV
  ? (await import("../lab/routes")).createLabRoutes(root)
  : [];
export const router = createRouter({ routeTree: root.addChildren([home, ...labRoutes]) });
declare module "@tanstack/react-router" {
  interface Register { router: typeof router; }
}
