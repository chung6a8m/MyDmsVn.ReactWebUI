import { useContext } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "../components/ui/button";
import { ThemeContext } from "./theme";

// Only unauthenticated entry, Lab, and not-found pages use this header.
// Authenticated Product uses ProductShell and keeps exactly one workspace.
export function AppHeader() {
  const theme = useContext(ThemeContext);
  // Isolated auth component tests intentionally mount without RouterProvider.
  const router = useRouter({ warn: false });
  return (
    <header className="flex flex-wrap items-center gap-4 border-b px-4 py-3">
      <h1 className="text-xl font-semibold">MyDmsVn</h1>
      <nav aria-label="Điều hướng chính" className="flex flex-wrap gap-4">
        {router && <Link to="/">Ứng dụng</Link>}
        {router && import.meta.env.DEV && <>
          <Link to="/lab/sales" search={{ scenario: "default" }}>Sales Lab</Link>
          <Link to="/lab/components" search={{ scenario: "default" }}>Components Lab</Link>
        </>}
      </nav>
      {theme && (
        <div className="ml-auto flex gap-2" aria-label="Giao diện">
          <Button variant="outline" aria-pressed={theme.mode === "light"} onClick={() => theme.setMode("light")}>Light</Button>
          <Button variant="outline" aria-pressed={theme.mode === "dark"} onClick={() => theme.setMode("dark")}>Dark</Button>
        </div>
      )}
    </header>
  );
}
