/**
 * YouTwin UI primitives — the shared building blocks every page is
 * composed from, so the whole product reads as one designed system:
 * icons, the cinematic backdrop, page headers, stat cards, charts,
 * gauges, steppers, empty/loading states.
 */
import { MouseEvent, ReactNode, useId, useMemo, useState } from "react";

/* ------------------------------------------------------------------ */
/* Icons — a single stroke-icon set (1.75px, round joins) instead of   */
/* emoji, which never looks premium and renders differently per OS.   */
/* ------------------------------------------------------------------ */

const PATHS: Record<string, ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></>,
  twins: <><rect x="3" y="4" width="13" height="13" rx="3" /><path d="M8 20h10a3 3 0 0 0 3-3V7" /></>,
  chart: <><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 6-6" /></>,
  video: <><rect x="2.5" y="5.5" width="14" height="13" rx="2.5" /><path d="m16.5 10 5-3v10l-5-3" /></>,
  sparkles: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><path d="m12 8 1.2 2.8L16 12l-2.8 1.2L12 16l-1.2-2.8L8 12l2.8-1.2z" /></>,
  bot: <><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 4v4M9 13h.01M15 13h.01M9 17h6" /></>,
  link: <><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  "check-circle": <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5-6" /></>,
  "arrow-right": <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  "arrow-left": <><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>,
  "arrow-up-right": <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  play: <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.5-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z" fill="currentColor" stroke="none" />,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  send: <><path d="M5 12h13" /><path d="m12 5 7 7-7 7" /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="m10 17-5-5 5-5M5 12h11" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z" /><path d="m9 12 2 2 4-4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  bolt: <path d="M13 3 4 14h7l-1 7 9-11h-7z" />,
  wave: <path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  trash: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /><path d="M9 7V4h6v3" /></>,
  download: <><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></>,
  puzzle: <path d="M9 4h4v2a2 2 0 1 0 4 0V4h3v6h-2a2 2 0 1 0 0 4h2v6h-6v-2a2 2 0 1 0-4 0v2H4v-6h2a2 2 0 1 0 0-4H4V4h5z" />,
  refresh: <><path d="M20 11a8 8 0 0 0-14.9-3.9L4 9" /><path d="M4 4v5h5" /><path d="M4 13a8 8 0 0 0 14.9 3.9L20 15" /><path d="M20 20v-5h-5" /></>,
  youtube: <><rect x="2.5" y="5" width="19" height="14" rx="4" /><path d="m10 9 5 3-5 3z" fill="currentColor" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  quote: <path d="M9 7H6a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v1a3 3 0 0 1-3 3M19 7h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v1a3 3 0 0 1-3 3" />,
  cpu: <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" /></>,
  database: <><ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" /><path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13" /><path d="M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 13.6a6.5 6.5 0 0 1 3.5 6.4" /></>,
  phone: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  alert: <><path d="M12 3 2.5 20h19z" /><path d="M12 10v4M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7z" />,
  message: <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z" />,
  film: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  gauge: <><path d="M4 18a9 9 0 1 1 16 0" /><path d="m12 13 4-5" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" /></>,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M15 8l2 2" /></>,
  eye: <><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="3" /></>,
  "eye-off": <><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3 3.9M6.6 6.6A17 17 0 0 0 2.5 12S6 19 12 19a9.6 9.6 0 0 0 4.4-1.1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  wand: <><path d="m15 4 5 5L9 20H4v-5z" /><path d="m13 6 5 5" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  graduation: <><path d="m12 4 10 5-10 5L2 9z" /><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" /></>,
};

export function Icon({
  name,
  size = 18,
  className = "",
  strokeWidth = 1.75,
}: {
  name: keyof typeof PATHS | string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-shrink-0 ${className}`}
    >
      {PATHS[name] ?? PATHS.sparkles}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Cinematic backdrop                                                  */
/* ------------------------------------------------------------------ */

/**
 * Fixed, full-viewport atmosphere: two or three slow-drifting aurora
 * lights in the page's accent colors, a faded grid, film grain and a
 * vignette. Pure CSS — no image request, so it's fast on first paint.
 */
export function Backdrop({
  accent = "#C8302B",
  accent2 = "#E0AE4E",
  accent3,
  intensity = 1,
  grid = true,
}: {
  accent?: string;
  accent2?: string;
  accent3?: string;
  intensity?: number;
  grid?: boolean;
}) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
      <div className="backdrop-orbs absolute inset-0">
      <div
        className="bg-orb-a absolute -left-[12%] -top-[18%] h-[720px] w-[720px] rounded-full blur-[140px] transition-[background] duration-1000"
        style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 65%)`, opacity: 0.28 * intensity }}
      />
      <div
        className="bg-orb-b absolute -right-[14%] top-[22%] h-[640px] w-[640px] rounded-full blur-[150px] transition-[background] duration-1000"
        style={{ background: `radial-gradient(circle, ${accent2} 0%, transparent 65%)`, opacity: 0.18 * intensity }}
      />
      {accent3 && (
        <div
          className="bg-orb-a absolute bottom-[-25%] left-[25%] h-[600px] w-[600px] rounded-full blur-[150px]"
          style={{ background: `radial-gradient(circle, ${accent3} 0%, transparent 65%)`, opacity: 0.14 * intensity }}
        />
      )}
      </div>
      {grid && <div className="bg-grid absolute inset-0" />}
      <div className="bg-vignette absolute inset-0" />
      <div className="bg-noise absolute inset-0" />
    </div>
  );
}

/** Mouse-follow spotlight for `.spotlight` cards. */
export function spotlight(e: MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
}

/* ------------------------------------------------------------------ */
/* Layout pieces                                                       */
/* ------------------------------------------------------------------ */

export function Eyebrow({
  children,
  tone = "rec",
  className = "",
}: {
  children: ReactNode;
  tone?: "rec" | "gold" | "green" | "teal" | "muted";
  className?: string;
}) {
  const dot = {
    rec: "text-rec-400",
    gold: "text-cited-400",
    green: "text-verified-500",
    teal: "text-signal-400",
    muted: "text-fg/40",
  }[tone];
  return (
    <span className={`eyebrow ${className}`}>
      <span className={`live-dot !h-1.5 !w-1.5 ${dot}`} />
      {children}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  eyebrowTone,
  title,
  description,
  actions,
  compact = false,
}: {
  eyebrow?: ReactNode;
  eyebrowTone?: "rec" | "gold" | "green" | "teal" | "muted";
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between animate-fade-up">
      <div className="min-w-0">
        {eyebrow && <Eyebrow tone={eyebrowTone} className="mb-4">{eyebrow}</Eyebrow>}
        <h2 className={`font-display font-semibold leading-[1.05] text-fg ${compact ? "text-2xl sm:text-[1.9rem]" : "text-3xl sm:text-[2.5rem]"}`}>{title}</h2>
        {description && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-fg/60">{description}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-label="Loading">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21.5 12A9.5 9.5 0 0 0 12 2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function EmptyState({
  icon = "sparkles",
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center px-8 py-14 text-center">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-2xl bg-rec-500/30 blur-xl" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-tint/10 bg-gradient-to-b from-tint/10 to-tint/[0.02] text-fg shadow-card">
          <Icon name={icon} size={24} />
        </div>
      </div>
      <p className="font-display text-lg font-semibold text-fg">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-fg/55">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "info" | "success"; children: ReactNode }) {
  const styles = {
    error: "border-rec-500/30 bg-rec-500/10 text-rec-300",
    info: "border-cited-500/30 bg-cited-500/10 text-cited-300",
    success: "border-verified-500/30 bg-verified-500/10 text-verified-400",
  }[tone];
  const icon = tone === "error" ? "alert" : tone === "success" ? "check-circle" : "info";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-relaxed animate-scale-in ${styles}`}>
      <Icon name={icon} size={16} className="mt-0.5" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stepper                                                             */
/* ------------------------------------------------------------------ */

export const SETUP_STEPS = ["Connect", "Train", "Review", "Share"];

export function Stepper({
  steps,
  current,
  className = "",
}: {
  steps: string[];
  current: number; // 1-based
  className?: string;
}) {
  return (
    <ol className={`flex items-center gap-2 ${className}`}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-7 items-center gap-2 rounded-full pl-1 pr-3 text-xs font-medium transition-all duration-500 ${
                active
                  ? "bg-tint/[0.08] text-fg ring-1 ring-tint/15"
                  : done
                  ? "text-fg/70"
                  : "text-fg/35"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full font-mono-timecode text-[10px] transition-all duration-500 ${
                  active
                    ? "bg-gradient-to-b from-rec-400 to-rec-600 text-white shadow-[0_0_14px_rgba(224,72,63,0.6)]"
                    : done
                    ? "bg-verified-500/15 text-verified-400 ring-1 ring-verified-500/40"
                    : "ring-1 ring-tint/15"
                }`}
              >
                {done ? <Icon name="check" size={11} strokeWidth={2.5} /> : n}
              </span>
              <span className={active ? "" : "hidden sm:inline"}>{label}</span>
            </span>
            {i < steps.length - 1 && (
              <span className={`h-px w-4 sm:w-8 transition-colors duration-500 ${done ? "bg-verified-500/50" : "bg-tint/10"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Data visualisation                                                  */
/* ------------------------------------------------------------------ */

export function StatCard({
  label,
  value,
  unit,
  icon,
  tone = "neutral",
  hint,
  spark,
  meter,
  meterLabel,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  icon?: string;
  tone?: "neutral" | "green" | "red" | "gold";
  hint?: ReactNode;
  spark?: number[];
  /** 0-1: drawn as a segmented bar along the bottom of the card. */
  meter?: number;
  meterLabel?: string;
}) {
  const color = { neutral: "#FF8266", green: "#10B981", red: "#E0483F", gold: "#E0AE4E" }[tone];
  const iconBg = {
    neutral: "bg-tint/[0.06] text-fg/70",
    green: "bg-verified-500/10 text-verified-400",
    red: "bg-rec-500/10 text-rec-300",
    gold: "bg-cited-500/10 text-cited-300",
  }[tone];
  return (
    <div onMouseMove={spotlight} className="surface surface-interactive spotlight overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-fg/55">{label}</p>
        {icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
            <Icon name={icon} size={16} />
          </span>
        )}
      </div>
      <p className="mt-3 flex items-baseline gap-1 font-display text-[2rem] font-semibold leading-none text-fg tabular-nums">
        {value}
        {unit && <span className="text-sm font-normal text-fg/45">{unit}</span>}
      </p>
      {hint && <p className="mt-2 text-xs text-fg/45">{hint}</p>}
      {spark && spark.length > 1 && (
        <div className="-mx-5 -mb-5 mt-4 h-10 opacity-80">
          <Sparkline data={spark} color={color} />
        </div>
      )}
      {typeof meter === "number" && <SegmentMeter value={meter} color={color} label={meterLabel ?? label} />}
    </div>
  );
}

/** 20-segment bar, filled left to right (stat cards). */
export function SegmentMeter({ value, color, label }: { value: number; color: string; label: string }) {
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const filled = Math.round(v * 20);
  return (
    <div className="mt-4 flex h-6 items-end gap-[3px]" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      {Array.from({ length: 20 }, (_, i) => (
        <span
          key={i}
          className="flex-1 rounded-[2px] transition-all duration-700"
          style={{
            height: `${40 + (i / 19) * 60}%`,
            background: i < filled ? color : "rgb(var(--tint) / 0.08)",
            opacity: i < filled ? 0.55 + 0.45 * (i / Math.max(1, filled - 1)) : 1,
            transitionDelay: `${i * 25}ms`,
          }}
        />
      ))}
    </div>
  );
}

function smoothPath(points: [number, number][]) {
  if (points.length < 2) return "";
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }
  return d;
}

export function Sparkline({ data, color = "#10B981" }: { data: number[]; color?: string }) {
  const id = useId().replace(/:/g, "");
  const max = Math.max(1, ...data);
  const w = 100;
  const h = 40;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 4 - (v / max) * (h - 10)] as [number, number]);
  const line = smoothPath(pts);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id={`sp-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L ${w} ${h} L 0 ${h} Z`} fill={`url(#sp-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * Real, interactive area chart (no chart library — keeps the bundle
 * small). Smooth curve, gradient fill, gridlines, and a hover crosshair
 * with a tooltip for the exact day.
 */
export function AreaChart({
  data,
  color = "#10B981",
  height = 220,
  formatLabel = (s: string) => s,
  unit = "",
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  formatLabel?: (s: string) => string;
  unit?: string;
}) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const W = 800;
  const H = height;
  const padT = 16;
  const padB = 28;
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = Math.max(4, Math.ceil(max * 1.2));
  const pts = useMemo(
    () =>
      data.map(
        (d, i) =>
          [data.length === 1 ? W / 2 : (i / (data.length - 1)) * W, padT + (1 - d.value / niceMax) * (H - padT - padB)] as [
            number,
            number,
          ],
      ),
    [data, niceMax, H],
  );
  const line = smoothPath(pts);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  function onMove(e: MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    pts.forEach((p, i) => {
      if (Math.abs(p[0] - x) < Math.abs(pts[best][0] - x)) best = i;
    });
    setHover(best);
  }

  const hp = hover !== null ? pts[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full overflow-visible"
        style={{ height: H }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`ac-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="70%" stopColor={color} stopOpacity="0.04" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id={`glow-${id}`} x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {ticks.map((t) => (
          <line
            key={t}
            x1="0"
            x2={W}
            y1={padT + t * (H - padT - padB)}
            y2={padT + t * (H - padT - padB)}
            style={{ stroke: "rgb(var(--tint) / 0.07)" }}
            strokeDasharray={t === 1 ? undefined : "3 5"}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {pts.length > 1 && <path d={`${line} L ${W} ${H - padB} L 0 ${H - padB} Z`} fill={`url(#ac-${id})`} />}
        {pts.length > 1 && (
          <path d={line} fill="none" stroke={color} strokeWidth="2.25" vectorEffect="non-scaling-stroke" filter={`url(#glow-${id})`} />
        )}
        {hp && (
          <line x1={hp[0]} x2={hp[0]} y1={padT} y2={H - padB} style={{ stroke: "rgb(var(--tint) / 0.25)" }} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {/* Points + tooltip rendered in HTML so they don't stretch with the SVG */}
      {hp && hover !== null && (
        <>
          <span
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-canvas"
            style={{ left: `${(hp[0] / W) * 100}%`, top: hp[1], background: color, boxShadow: `0 0 0 4px ${color}33, 0 0 16px ${color}` }}
          />
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+14px)] whitespace-nowrap rounded-lg border border-tint/10 bg-night-800/95 px-3 py-2 text-xs shadow-lift backdrop-blur"
            style={{ left: `${Math.min(92, Math.max(8, (hp[0] / W) * 100))}%`, top: hp[1] }}
          >
            <p className="text-fg/50">{formatLabel(data[hover].label)}</p>
            <p className="mt-0.5 font-semibold text-fg tabular-nums">
              {data[hover].value}
              {unit && <span className="ml-1 font-normal text-fg/50">{unit}</span>}
            </p>
          </div>
        </>
      )}
      <div className="mt-1 flex justify-between px-0.5 text-[11px] text-fg/35 font-mono-timecode">
        {data
          .filter((_, i) => i === 0 || i === data.length - 1 || i === Math.floor((data.length - 1) / 2))
          .map((d) => (
            <span key={d.label}>{formatLabel(d.label)}</span>
          ))}
      </div>
    </div>
  );
}

/** Circular gauge with a glowing progress arc and optional rotating halo. */
export function RadialGauge({
  value,
  color = "#10B981",
  size = 200,
  stroke = 12,
  halo = false,
  indeterminate = false,
  children,
}: {
  value: number; // 0-100
  color?: string;
  size?: number;
  stroke?: number;
  halo?: boolean;
  indeterminate?: boolean;
  children?: ReactNode;
}) {
  const id = useId().replace(/:/g, "");
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="absolute inset-[8%] rounded-full blur-[50px] opacity-40 transition-colors duration-700" style={{ background: color }} />
      {halo && (
        <div className="absolute inset-[-6%] rounded-full opacity-70 conic-halo" style={{ ["--halo" as string]: color }} />
      )}
      <div className="absolute inset-[6%] rounded-full bg-gradient-to-b from-night-800 to-night-950 shadow-lift" />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative">
        <defs>
          <linearGradient id={`rg-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: "rgb(var(--tint) / 0.07)" }} strokeWidth={stroke} />
        {/* tick ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r - stroke - 6}
          fill="none"
          style={{ stroke: "rgb(var(--tint) / 0.1)" }}
          strokeWidth="1"
          strokeDasharray="1 6"
        />
        {indeterminate ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#rg-${id})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * 0.22} ${c * 0.78}`}
            className="animate-spin"
            style={{ transformOrigin: "50% 50%", animationDuration: "1.4s" }}
          />
        ) : (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#rg-${id})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct / 100)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1), stroke 0.5s ease", filter: `drop-shadow(0 0 8px ${color})` }}
          />
        )}
      </svg>
      <div className="absolute flex flex-col items-center text-center">{children}</div>
    </div>
  );
}

/** Animated audio waveform bars (decorative). */
export function Waveform({ bars = 36, className = "", color = "bg-fg/70" }: { bars?: number; className?: string; color?: string }) {
  return (
    <div className={`flex h-full items-center justify-center gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`waveform-bar w-[3px] rounded-full ${color}`}
          style={{
            // Rounded so server and client render byte-identical strings —
            // raw floats (61.47704096689189% vs 61.477%) caused a React
            // hydration mismatch warning on every page load.
            height: `${(18 + Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.18)) * 82).toFixed(2)}%`,
            animationDelay: `${((i % 14) * 0.07).toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  );
}
