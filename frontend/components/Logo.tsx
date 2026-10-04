import { useId } from "react";

/**
 * The YouTwin mark: two mirrored chevrons — the creator (paper) and their
 * twin (REC red) — meeting at a single point. Rendered on a lit, glassy
 * tile so it holds up at favicon size and as a hero-scale mark alike.
 */
export default function Logo({
  size = 30,
  withWordmark = true,
  dark = true,
}: {
  size?: number;
  withWordmark?: boolean;
  dark?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <defs>
          <linearGradient id={`lg-bg-${id}`} x1="0" y1="0" x2="0" y2="40">
            <stop offset="0" stopColor="#26262D" />
            <stop offset="1" stopColor="#0B0B0E" />
          </linearGradient>
          <linearGradient id={`lg-edge-${id}`} x1="0" y1="0" x2="40" y2="40">
            <stop offset="0" stopColor="#FF8266" stopOpacity="0.9" />
            <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.08" />
            <stop offset="1" stopColor="#E0AE4E" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id={`lg-red-${id}`} x1="20" y1="12" x2="28" y2="28">
            <stop offset="0" stopColor="#FF8266" />
            <stop offset="1" stopColor="#C8302B" />
          </linearGradient>
          <radialGradient id={`lg-glow-${id}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#E0483F" stopOpacity="0.55" />
            <stop offset="1" stopColor="#E0483F" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0.5" y="0.5" width="39" height="39" rx="11" fill={`url(#lg-bg-${id})`} stroke={`url(#lg-edge-${id})`} />
        <circle cx="20" cy="20" r="12" fill={`url(#lg-glow-${id})`} />
        <path d="M12 12L20 20L12 28" stroke="#F7F1E4" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M28 12L20 20L28 28" stroke={`url(#lg-red-${id})`} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {withWordmark && (
        <span className={`font-display text-[17px] font-semibold tracking-[-0.03em] ${dark ? "text-fg" : "text-ink-900"}`}>
          YouTwin
        </span>
      )}
    </span>
  );
}
