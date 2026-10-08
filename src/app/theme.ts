import { useCallback, useEffect } from "react";

import { patchState } from "../appstate";
import type { Theme } from "../viewparams";

/** Переключатель темы: тема живёт в `html[data-theme]`, правка уходит в состояние окна. */
export function useThemeToggle(theme: Theme, setTheme: (theme: Theme) => void): () => void {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    void patchState({ theme: next });
  }, [theme, setTheme]);
}
