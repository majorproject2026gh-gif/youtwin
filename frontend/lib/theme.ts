export type Theme = "dark" | "light";

const STORAGE_KEY = "youtwin_theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem(STORAGE_KEY) as Theme) || "dark";
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

/** Inline script string, injected before first paint (see _app.tsx) so
 * the page never flashes the wrong theme on load — this has to run
 * synchronously before React hydrates, not inside a useEffect. */
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var t = localStorage.getItem('${STORAGE_KEY}') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
`;
