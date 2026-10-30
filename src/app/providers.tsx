import { useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeContext, type ThemeMode } from "./theme";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
  );
  const [mode, setMode] = useState<ThemeMode>("light");
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
    document.documentElement.dataset.agThemeMode = mode;
    document.documentElement.style.colorScheme = mode;
  }, [mode]);
  const theme = useMemo(() => ({ mode, setMode }), [mode]);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </QueryClientProvider>
  );
}
