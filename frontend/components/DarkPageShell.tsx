import { ReactNode } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Logo from "./Logo";
import { logout } from "@/lib/api";

/**
 * The same full-bleed dark ink-950 + animated glow-orb + glass system
 * used by the creator wizard (connect/train/review/share), lifted out
 * into a shared shell so every page in the product — not just the
 * 4-step wizard — shares one bespoke design language instead of two
 * (the wizard's dark glass vs. the old flat "YouTube Studio" template).
 */
export default function DarkPageShell({
  eyebrow,
  title,
  subtitle,
  accent,
  accent2 = "#D9A441",
  centerpiece,
  quickLinks,
  maxWidth = "max-w-lg",
  children,
  footer,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  accent: string;
  accent2?: string;
  centerpiece?: ReactNode;
  quickLinks?: { href: string; label: string; active?: boolean }[];
  maxWidth?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="min-h-screen relative overflow-hidden bg-ink-950 flex flex-col">
      <div
        className="bg-orb-a pointer-events-none absolute -left-32 top-[12%] h-[520px] w-[520px] rounded-full opacity-40 blur-[120px]"
        style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }}
      />
      <div
        className="bg-orb-b pointer-events-none absolute right-[-18%] bottom-[8%] h-[480px] w-[480px] rounded-full opacity-30 blur-[120px]"
        style={{ background: `radial-gradient(circle, ${accent2} 0%, transparent 70%)` }}
      />
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <nav className="relative flex items-center justify-between px-8 py-6">
        <Link href="/home"><Logo dark /></Link>
        <div className="flex items-center gap-2">
          {quickLinks?.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`glass-pill rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                l.active
                  ? "border-white/25 bg-white/10 text-paper-100"
                  : "border-white/10 text-paper-300 hover:bg-white/10 hover:text-paper-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <button
            onClick={async () => { await logout(); router.push("/login"); }}
            className="glass-pill rounded-full border border-white/15 px-4 py-2 text-xs text-paper-300 hover:bg-white/10 transition-colors"
          >
            Log out
          </button>
        </div>
      </nav>

      <div className="relative flex-1 flex flex-col items-center px-6 py-10 text-center">
        <span className="font-mono-timecode text-xs tracking-[0.25em] text-paper-300 mb-4">{eyebrow}</span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-paper-100 mb-3">{title}</h1>
        {subtitle && <p className="text-lg text-paper-300 mb-10 max-w-md">{subtitle}</p>}

        {centerpiece && <div className="relative flex items-center justify-center mb-10">{centerpiece}</div>}

        {children && <div className={`w-full ${maxWidth}`}>{children}</div>}

        {footer && <div className="mt-10 flex items-center gap-4">{footer}</div>}
      </div>
    </div>
  );
}
