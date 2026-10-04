/**
 * YouTwin's single, global theme system.
 *
 * - The theme lives on <html data-theme="dark|light">. Every color in the
 *   app resolves through CSS variables keyed off that attribute (see
 *   styles/globals.css + tailwind.config.js), so no page or component
 *   carries its own theme logic.
 * - THEME_INIT_SCRIPT runs before first paint (injected in _app) so the
 *   page never flashes the wrong theme on load or refresh.
 * - <ThemeProvider> (mounted once in _app) exposes { theme, setTheme,
 *   toggleTheme } to any component via useTheme(), and persists the
 *   choice to localStorage.
 */
import { createContext, createElement, ReactNode, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "youtwin_theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    return t === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** Applies a theme with a brief cross-fade so the switch feels smooth
 * instead of snapping (the .theme-switching class enables color
 * transitions on everything for ~400ms, then removes itself so normal
 * interactions aren't slowed down). */
/** Browser/OS chrome colour (Android status bar, installed-app title
 * bar) follows the app theme, not just the system setting. */
const THEME_COLORS: Record<Theme, string> = { dark: "#08080A", light: "#F8F5EF" };
function syncThemeColor(theme: Theme): void {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[theme]);
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("theme-switching");
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  syncThemeColor(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* private mode — theme still applies for this session */
  }
  window.setTimeout(() => root.classList.remove("theme-switching"), 450);
}

/** Inline script string, injected before first paint (see _app.tsx) so
 * the page never flashes the wrong theme — this has to run synchronously
 * before React hydrates, not inside a useEffect. */
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var t = localStorage.getItem('${STORAGE_KEY}') === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t;
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'light' ? '#F8F5EF' : '#08080A');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  // Sync React state with whatever the pre-paint script already applied.
  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    setThemeState(attr === "light" ? "light" : getStoredTheme());

    // Keep multiple open tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const next: Theme = e.newValue === "light" ? "light" : "dark";
        applyTheme(next);
        setThemeState(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    applyTheme(t);
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((cur) => {
      const next: Theme = cur === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, []);

  return createElement(ThemeContext.Provider, { value: { theme, setTheme, toggleTheme } }, children);
}

export function useTheme() {
  return useContext(ThemeContext);
}
