import { createContext, ReactElement, ReactNode, useContext, useEffect, useState } from "react";
import Link from "next/link";
import InstallApp from "./InstallApp";
import { useRouter } from "next/router";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import { Backdrop, Icon } from "./ui";
import { logout } from "@/lib/api";
import { readJSON } from "@/lib/browser";
import { STAGES, StudioProvider, completion, nextStageHref, stageStatuses, useStudio } from "./studio";

type Creator = { displayName?: string; handle?: string; googleLinked?: boolean };

type Meta = { title?: string; accent?: string; accent2?: string; accent3?: string; wide?: boolean };

const WORKSPACE = [
  { href: "/home", label: "Overview", icon: "home" },
  { href: "/dashboard/twins", label: "My Twins", icon: "twins" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "chart" },
  { href: "/dashboard/create-video", label: "Video Studio", icon: "film", badge: "AI" },
  { href: "/dashboard/agent", label: "Agent Build", icon: "bot" },
];

const STUDIO_PATHS = STAGES.map((s) => s.href);

const FrameContext = createContext<((m: Meta) => void) | null>(null);

/**
 * The persistent signed-in frame: sidebar, top bar and cinematic backdrop.
 * It's mounted ONCE via `getLayout` (see withAppFrame) and stays put while
 * the creator moves around the product — only the page content changes,
 * and the backdrop glides to each page's accent colors.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <StudioProvider>
      <FrameInner>{children}</FrameInner>
    </StudioProvider>
  );
}

function FrameInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { state: studio } = useStudio();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [meta, setMeta] = useState<Meta>({});

  useEffect(() => {
    try {
      setCreator(readJSON<Creator>("youtwin_creator"));
    } catch {
      /* ignore */
    }
    setDrawer(false);
  }, [router.asPath]);

  async function signOut() {
    await logout();
    router.push("/login");
  }

  const name = creator?.displayName || "Creator";
  const initial = name.trim()[0]?.toUpperCase() ?? "C";
  const inStudio = STUDIO_PATHS.includes(router.pathname);
  const statuses = stageStatuses(studio, router.pathname);
  const done = completion(studio);
  const pct = Math.round((done / STAGES.length) * 100);

  // On short screens (phones, landscape) the whole sidebar scrolls as one
  // column so no nav item ends up hidden behind the footer card; on tall
  // screens only the nav list scrolls, as before.
  const sidebar = (
    <div className="flex h-full flex-col overflow-y-auto overscroll-contain [@media(min-height:760px)]:overflow-y-visible">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/home" className="rounded-lg">
          <Logo />
        </Link>
        <button onClick={() => setDrawer(false)} className="btn btn-ghost btn-icon btn-sm lg:hidden" aria-label="Close menu">
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* Workspace identity */}
      <div className="mx-3 mb-5 flex items-center gap-3 rounded-xl border border-tint/[0.07] bg-tint/[0.03] p-2.5">
        <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-coral-400 via-rec-500 to-cited-500 font-display text-sm font-semibold text-white shadow-glow">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{name}</p>
          <p className="truncate text-xs text-fg/45">{creator?.handle ? `@${creator.handle}` : "Creator workspace"}</p>
        </div>
      </div>

      <nav className="flex-1 px-3 [@media(min-height:760px)]:min-h-0 [@media(min-height:760px)]:overflow-y-auto">
        {/* Twin Studio — one destination, not a numbered checklist */}
        <Link
          href={inStudio ? router.pathname : nextStageHref(studio)}
          className={`group relative mb-1 flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm transition-all duration-300 ${
            inStudio
              ? "bg-gradient-to-r from-rec-500/[0.14] via-coral-400/[0.06] to-transparent text-fg ring-1 ring-rec-400/20"
              : "text-fg/70 hover:bg-tint/[0.04] hover:text-fg"
          }`}
        >
          {inStudio && <span className="absolute -left-3 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-coral-400 to-rec-500 shadow-[0_0_12px_rgba(242,96,63,0.8)]" />}
          <MiniRing pct={pct} />
          <span className="flex-1">
            <span className="block font-medium">Twin Studio</span>
            <span className="block text-[11px] text-fg/45">{done === STAGES.length ? "Twin is live" : `${done} of ${STAGES.length} configured`}</span>
          </span>
          <Icon name="chevron-right" size={14} className="text-fg/30 transition-transform group-hover:translate-x-0.5" />
        </Link>

        {/* Stage shortcuts — only while inside the studio */}
        <div className={`grid transition-all duration-500 ease-out-expo ${inStudio ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <ul className="overflow-hidden pl-[1.35rem]">
            {STAGES.map((s) => {
              const st = statuses[s.key];
              return (
                <li key={s.key} className="relative border-l border-tint/[0.08] pl-3">
                  <Link
                    href={st === "locked" ? "#" : s.href}
                    scroll={false}
                    aria-disabled={st === "locked"}
                    onClick={(e) => st === "locked" && e.preventDefault()}
                    className={`my-0.5 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors ${
                      st === "active" ? "bg-tint/[0.06] text-fg" : st === "locked" ? "cursor-not-allowed text-fg/25" : "text-fg/55 hover:text-fg"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${
                        st === "active" ? "bg-coral-400 shadow-[0_0_8px_#FF8266]" : st === "done" ? "bg-verified-500" : "bg-fg/20"
                      }`}
                    />
                    {s.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="px-2.5 pb-2 pt-6 font-mono-timecode text-[10px] uppercase tracking-[0.16em] text-fg/35">Workspace</p>
        <ul className="space-y-0.5">
          {WORKSPACE.map((item) => {
            const active = router.pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-all duration-200 ${
                    active ? "bg-tint/[0.07] text-fg" : "text-fg/60 hover:bg-tint/[0.04] hover:text-fg"
                  }`}
                >
                  {active && <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-coral-400 to-rec-500 shadow-[0_0_12px_rgba(242,96,63,0.8)]" />}
                  <Icon name={item.icon} size={17} className={active ? "text-coral-400" : "text-fg/45 group-hover:text-fg/80"} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="rounded-md bg-gradient-to-r from-coral-400/20 to-cited-400/20 px-1.5 py-0.5 font-mono-timecode text-[9px] font-medium text-cited-300 ring-1 ring-cited-400/25">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-3">
        <div className="relative overflow-hidden rounded-xl border border-tint/[0.08] bg-gradient-to-b from-tint/[0.05] to-transparent p-3.5">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-verified-500/20 blur-2xl" />
          <div className="relative flex items-center gap-2 text-xs font-medium text-fg/80">
            <Icon name="shield" size={14} className="text-verified-400" />
            Grounded · Cited · Guarded
          </div>
          <p className="relative mt-1.5 text-[11px] leading-relaxed text-fg/45">Ingestion → Stylometry → Embeddings → RAG → Serving</p>
        </div>
        <div className="mt-2">
          <InstallApp variant="row" />
        </div>
        <div className="mt-1 flex items-center gap-1">
          <Link href="/help" className="btn btn-ghost btn-sm flex-1 justify-start">
            <Icon name="help" size={15} /> Help
          </Link>
          <button onClick={signOut} className="btn btn-ghost btn-sm flex-1 justify-start">
            <Icon name="logout" size={15} /> Log out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <FrameContext.Provider value={setMeta}>
      <div className="relative isolate min-h-screen overflow-x-clip text-fg">
        <Backdrop accent={meta.accent} accent2={meta.accent2} accent3={meta.accent3} intensity={0.8} />

        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-tint/[0.06] bg-night-950/60 backdrop-blur-xl lg:block">
          {sidebar}
        </aside>

        <div className={`fixed inset-0 z-50 lg:hidden ${drawer ? "" : "pointer-events-none"}`}>
          <div
            onClick={() => setDrawer(false)}
            className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${drawer ? "opacity-100" : "opacity-0"}`}
          />
          <aside
            className={`absolute inset-y-0 left-0 w-72 border-r border-tint/10 bg-night-900 shadow-lift transition-transform duration-300 ease-out-expo ${
              drawer ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {sidebar}
          </aside>
        </div>

        <div className="lg:pl-64">
          <header className="glass-nav sticky top-0 z-20 border-b border-tint/[0.06]">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-10">
              <button onClick={() => setDrawer(true)} className="btn btn-ghost btn-icon lg:hidden" aria-label="Open menu">
                <Icon name="menu" size={18} />
              </button>
              <Link href="/home" className="-m-1.5 p-1.5 lg:hidden" aria-label="YouTwin home">
                <Logo withWordmark={false} size={28} />
              </Link>
              <div className="hidden items-center gap-2 text-sm sm:flex">
                <span className="text-fg/40">{inStudio ? "Twin Studio" : "Studio"}</span>
                <Icon name="chevron-right" size={14} className="text-fg/25" />
                <span key={meta.title} className="font-medium text-fg/90 animate-fade-up">{meta.title ?? "Dashboard"}</span>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("youtwin_twinId");
                    router.push(`/dashboard/train?fresh=${Date.now()}`);
                  }}
                  className="btn btn-primary btn-sm hidden sm:inline-flex"
                >
                  <Icon name="plus" size={15} strokeWidth={2.25} />
                  New twin
                </button>
                <button
                  onClick={signOut}
                  title="Log out"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-coral-400 via-rec-500 to-cited-500 p-[1.5px] transition-transform hover:scale-105"
                >
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-night-900 text-xs font-semibold text-fg">{initial}</span>
                </button>
              </div>
            </div>
          </header>

          <main className={`mx-auto w-full px-4 pb-16 pt-8 transition-[max-width] duration-500 sm:px-6 lg:px-10 lg:pt-10 ${meta.wide || inStudio ? "max-w-[1400px]" : "max-w-6xl"}`}>
            {children}
          </main>
        </div>
      </div>
    </FrameContext.Provider>
  );
}

function MiniRing({ pct }: { pct: number }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center">
      <svg width="32" height="32" viewBox="0 0 32 32" className="-rotate-90">
        <circle cx="16" cy="16" r={r} fill="none" strokeWidth="2.5" style={{ stroke: "rgb(var(--tint) / 0.1)" }} />
        <circle
          cx="16"
          cy="16"
          r={r}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          stroke={pct === 100 ? "#10B981" : "#FF8266"}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <Icon name="sparkles" size={13} className={`absolute ${pct === 100 ? "text-verified-400" : "text-coral-400"}`} />
    </span>
  );
}

/**
 * Pages call <AppShell title accent …> as before. Inside the persistent
 * frame it just hands its settings to the frame (title, accent colors)
 * and renders the page; outside one it renders a frame of its own, so a
 * page without getLayout still works.
 */
export default function AppShell({
  children,
  accent,
  accent2,
  accent3,
  title,
  wide = false,
}: {
  children: ReactNode;
  accent?: string;
  accent2?: string;
  accent3?: string;
  setupStep?: number;
  title?: string;
  wide?: boolean;
}) {
  const setMeta = useContext(FrameContext);
  useEffect(() => {
    setMeta?.({ title, accent, accent2, accent3, wide });
  }, [setMeta, title, accent, accent2, accent3, wide]);

  if (!setMeta) {
    return (
      <AppFrame>
        <AppShell title={title} accent={accent} accent2={accent2} accent3={accent3} wide={wide}>
          {children}
        </AppShell>
      </AppFrame>
    );
  }
  return <>{children}</>;
}

/** getLayout helper for every signed-in page. */
export function withAppFrame(page: ReactElement) {
  return <AppFrame>{page}</AppFrame>;
}
