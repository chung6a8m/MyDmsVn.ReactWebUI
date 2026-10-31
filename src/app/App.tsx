import { Link, Outlet } from "@tanstack/react-router";
import { Button } from "../components/ui/button";
import { useTheme } from "./theme";
export function App() {
  const { mode, setMode } = useTheme();
  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-4 border-b p-4">
        <h1 className="text-xl font-semibold">MyDmsVn</h1>
        <nav aria-label="Điều hướng chính" className="flex flex-wrap gap-4">
          <Link to="/">Ứng dụng</Link>
          <Link to="/lab/sales" search={{ scenario: "default" }}>
            Sales Lab
          </Link>
          <Link to="/lab/components" search={{ scenario: "default" }}>
            Components Lab
          </Link>
        </nav>
        <div className="ml-auto flex gap-2" aria-label="Giao diện">
          <Button
            variant="outline"
            aria-pressed={mode === "light"}
            onClick={() => setMode("light")}
          >
            Light
          </Button>
          <Button
            variant="outline"
            aria-pressed={mode === "dark"}
            onClick={() => setMode("dark")}
          >
            Dark
          </Button>
        </div>
      </header>
      <p className="px-4 py-2 text-muted-foreground">
        Nền giao diện · Dữ liệu giả lập · Chưa có API thật
      </p>
      <Outlet />
    </main>
  );
}
