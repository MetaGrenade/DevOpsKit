import { useEffect, useState } from "react";
import {
  applyThemeMode,
  getStoredThemeMode,
  initTheme,
  persistThemeMode,
  resolveTheme,
  type ResolvedTheme,
  type ThemeMode,
} from "../lib/theme";

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => {
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

  return {
    mode,
    resolved,
    setMode: setModeState,
  };
}
