"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Palette, ThemeName, themes, lightPalette } from "./themes";

interface ThemeContextValue {
  theme: ThemeName;
  palette: Palette;
  setTheme: (name: ThemeName) => void;
}

const STORAGE_KEY = "addex-theme";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  palette: lightPalette,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>("light");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeName | null;
      if (saved && themes[saved]) {
        setThemeState(saved);
        return;
      }
      // No saved preference — fall back to the OS-level dark/light setting.
      // Only two palettes to choose from here (legacy/highContrast are
      // explicit opt-ins), so pick light vs dark based on the media query.
      if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
        setThemeState("dark");
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  const setTheme = (name: ThemeName) => {
    setThemeState(name);
    try {
      window.localStorage.setItem(STORAGE_KEY, name);
    } catch {
      /* ignore */
    }
  };

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, palette: themes[theme], setTheme }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  return useContext(ThemeContext);
}

// Convenience: returns just the active palette, keeping the same shape as
// `import colors from "...styles/colors"` so migration is a one-line swap.
export function useTheme(): Palette {
  return useContext(ThemeContext).palette;
}
