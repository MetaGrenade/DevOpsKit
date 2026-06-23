import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyThemeMode,
  getStoredThemeMode,
  initTheme,
  persistThemeMode,
  resolveTheme,
  type ResolvedTheme,
  type ThemeMode,
} from "../lib/theme";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function useThemeState(): ThemeContextValue {
  const [mode, setMode] = useState<ThemeMode>(() => {
    initTheme();
    return getStoredThemeMode();
  });
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(getStoredThemeMode()));

  useEffect(() => {
    const next = applyThemeMode(mode);
    setResolved(next);
    persistThemeMode(mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const next = applyThemeMode("system");
      setResolved(next);
    };

    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [mode]);

  return useMemo(() => ({ mode, resolved, setMode }), [mode, resolved]);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useThemeState();
  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
