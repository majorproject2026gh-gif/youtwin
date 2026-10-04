import { useTheme } from "@/lib/theme";
import { Icon } from "./ui";

/** The one theme switch — reads/writes the global theme context, so it
 * behaves identically wherever it's placed. */
export default function ThemeToggle({ className = "" }: { className?: string; theme?: unknown; onToggle?: unknown }) {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={`group relative flex h-8 w-[52px] flex-shrink-0 items-center rounded-full border border-tint/10 bg-tint/[0.05] p-0.5 transition-colors hover:border-tint/20 ${className}`}
    >
      <span className="pointer-events-none absolute inset-0 flex items-center justify-between px-2 text-fg/35">
        <Icon name="moon" size={12} />
        <Icon name="sun" size={12} />
      </span>
      <span
        className={`relative flex h-[26px] w-[26px] items-center justify-center rounded-full bg-gradient-to-b from-night-700 to-night-800 text-fg shadow-card ring-1 ring-tint/10 transition-transform duration-500 ease-out-expo ${
          theme === "light" ? "translate-x-[20px]" : "translate-x-0"
        }`}
      >
        <Icon name={theme === "dark" ? "moon" : "sun"} size={13} className="text-coral-400 transition-transform duration-500 group-hover:rotate-12" />
      </span>
    </button>
  );
}
