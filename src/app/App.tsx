import { Outlet, useLocation } from "@tanstack/react-router";
import { AppHeader } from "./AppHeader";

// Product owns its authenticated chrome. Lab and unknown routes retain the
// lightweight navigation header; no second Product header is mounted.
export function App() {
  const path = useLocation({ select: (location) => location.pathname });
  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden">
      {path !== "/" && <AppHeader />}
      <Outlet />
    </main>
  );
}
