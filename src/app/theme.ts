import { createContext, useContext } from "react";
export type ThemeMode = "light" | "dark";
export const ThemeContext = createContext<{
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
} | null>(null);
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("Theme provider is required");
  return value;
}
