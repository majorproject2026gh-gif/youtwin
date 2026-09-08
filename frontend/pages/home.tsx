import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Footer from "@/components/Footer";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";
import CookieBanner from "@/components/CookieBanner";
import ThemeToggle from "@/components/ThemeToggle";
import { Theme, applyTheme, getStoredTheme } from "@/lib/theme";
import { logout as apiLogout } from "@/lib/api";

const FEATURES = [
  { icon: "🎙️", title: "Trained on your real videos", body: "Every response is built from your actual captions, transcripts, and speaking style.", stat: "Real transcripts" },
  { icon: "⏱️", title: "Timestamp-cited answers", body: "Every reply traces back to the exact second in the exact video it came from.", stat: "Cited to the second" },
  { icon: "🛡️", title: "Zero-hallucination guardrail", body: "If nothing backs up an answer, the twin says so instead of guessing.", stat: "Confidence-gated" },
  { icon: "⚡", title: "Built to scale", body: "Redis-backed state and response caching keep a popular twin fast under real load.", stat: "Production-ready" },
];

const TIMELINE = [
  { time: "00:00", title: "Connect your channel", body: "Sign in, no coding. YouTwin pulls your video library and starts learning." },
  { time: "00:24", title: "It learns your voice", body: "Captions, transcripts, and speaking patterns become a persona — not a generic chatbot." },
  { time: "01:10", title: "Viewers ask, it answers", body: "Every reply is grounded in a real moment from a real video, cited down to the second." },
  { time: "02:45", title: "It says \u201cI don\u2019t know\u201d out loud", body: "If nothing in your library backs up an answer, the twin refuses instead of guessing." },
];

const SIDEBAR_ITEMS = [
  { label: "Home", href: "/home", icon: "home" },
  { label: "My Twin", href: "/dashboard/connect", icon: "twin" },
  { label: "Analytics", href: "/dashboard/analytics", icon: "chart" },
  { label: "Agent", href: "/dashboard/create-video", icon: "agent" },
];

const MIRROR_ANSWER = "Four of us — Sadiyanureen, Virender, Harvinder, and me.";

function SidebarIcon({ type, theme }: { type: string; theme: Theme }) {
  const stroke = theme === "dark" ? "#C9CBD1" : "#5C5443";
  const fill = theme === "dark" ? "#F5F5F0" : "#241E17";
  if (type === "home") return <svg width="20" height="20" viewBox="0 0 24 24" fill={fill}><path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3z" /></svg>;
  if (type === "twin") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 2v4M15 2v4" /></svg>;
  if (type === "chart") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8"><path d="M3 3v18h18M7 15l4-4 3 3 5-6" /></svg>;
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8"><rect x="3" y="6" width="12" height="12" rx="2" /><path d="M15 10l6-3v10l-6-3" /></svg>;
}

export default function Home() {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("dark");
  const [signedIn, setSignedIn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [typedLength, setTypedLength] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSignedIn(!!localStorage.getItem("youtwin_session"));
    setTheme(getStoredTheme());
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  useEffect(() => {
    let idx = 0;
    let timeoutId: ReturnType<typeof setTimeout>;
    function tick() {
      idx++;
      setTypedLength(idx);
      if (idx < MIRROR_ANSWER.length) {
        timeoutId = setTimeout(tick, 45);
      } else {
        timeoutId = setTimeout(() => { idx = 0; setTypedLength(0); timeoutId = setTimeout(tick, 45); }, 2400);
      }
    }
    timeoutId = setTimeout(tick, 700);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    const glow = glowRef.current;
    if (!hero || !glow) return;
    function handleMove(e: MouseEvent) {
      const rect = hero!.getBoundingClientRect();
      glow!.style.left = `${e.clientX - rect.left}px`;
      glow!.style.top = `${e.clientY - rect.top}px`;
    }
    hero.addEventListener("mousemove", handleMove);
    return () => hero.removeEventListener("mousemove", handleMove);
  }, []);

  async function logout() {
    await apiLogout();
    setSignedIn(false);
    router.push("/login");
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  }

  const ctaHref = signedIn ? "/dashboard/connect" : "/login";

  return (
    <div ref={heroRef} className={`theme-aware relative min-h-screen overflow-hidden transition-colors duration-300 ${theme === "dark" ? "bg-ink-950 text-paper-100" : "bg-paper-50 text-ink-900"}`}>
      {/* Living, colorful backdrop — same system as every other page now,
          so Home no longer feels like a different product. */}
      <div className="bg-orb-a pointer-events-none absolute -left-40 top-[5%] h-[560px] w-[560px] rounded-full opacity-30 blur-[130px]" style={{ background: "radial-gradient(circle, #C22A2A 0%, transparent 70%)" }} />
      <div className="bg-orb-b pointer-events-none absolute right-[-15%] top-[30%] h-[500px] w-[500px] rounded-full opacity-25 blur-[130px]" style={{ background: "radial-gradient(circle, #D9A441 0%, transparent 70%)" }} />
      <div
        ref={glowRef}
        className="pointer-events-none absolute hidden h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 blur-[80px] lg:block lg:hover:opacity-15 transition-opacity duration-300"
        style={{ background: "radial-gradient(circle, #FF8266 0%, transparent 70%)" }}
      />
      <div
        className="absolute inset-0 opacity-[0.1]"
        style={{
          backgroundImage:
            theme === "dark"
              ? "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)"
              : "linear-gradient(rgba(36,30,23,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(36,30,23,0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      {/* Top bar */}
      <nav className="glass-nav sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/10 px-4 py-2.5" style={{ background: theme === "dark" ? "rgba(18,20,26,0.75)" : "rgba(255,255,255,0.82)" }}>
        <div className="flex items-center gap-4 flex-shrink-0">
          <button onClick={() => setSidebarOpen((s) => !s)} className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 transition-colors" aria-label="Toggle sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme === "dark" ? "#F5F5F0" : "#241E17"} strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
          <Link href="/home"><Logo dark={theme === "dark"} /></Link>
        </div>

        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl mx-auto">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search twins, videos, topics" className={`flex-1 rounded-l-full border px-4 py-2 text-sm outline-none focus:border-coral-400 transition-colors ${theme === "dark" ? "border-white/15 bg-white/5 text-paper-100 placeholder:text-paper-300/40" : "border-ink-900/15 bg-ink-900/5 text-ink-900 placeholder:text-ink-500/40"}`} />
          <button type="submit" className={`flex items-center justify-center rounded-r-full border border-l-0 px-5 transition-colors ${theme === "dark" ? "border-white/15 bg-white/10 hover:bg-white/15" : "border-ink-900/15 bg-ink-900/10 hover:bg-ink-900/15"}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme === "dark" ? "#C9CBD1" : "#5C5443"} strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          </button>
        </form>

        <div className="flex items-center gap-3 flex-shrink-0">
          <ThemeToggle theme={theme} onToggle={toggleTheme} className={theme === "dark" ? "text-paper-100" : "text-ink-900"} />
          <Link href={ctaHref} className="rounded-full bg-gradient-to-r from-rec-500 to-rec-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-rec-500/30 hover:scale-105 transition-transform">
            + Build twin
          </Link>
          <button className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 transition-colors" aria-label="Notifications">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9CBD1" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          </button>
          {signedIn ? (
            <button onClick={logout} className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rec-500 to-rec-600 text-xs font-semibold text-white" title="Log out">M</button>
          ) : (
            <Link href="/login" className={`glass-pill rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium hover:bg-white/10 transition-colors ${theme === "dark" ? "text-paper-100" : "text-ink-900"}`}>Sign in</Link>
          )}
        </div>
      </nav>

      <div className="relative flex">
        {sidebarOpen && (
          <aside className="hidden sm:flex sticky top-[53px] h-[calc(100vh-53px)] w-[72px] flex-shrink-0 flex-col items-center gap-1 border-r border-white/10 py-3">
            {SIDEBAR_ITEMS.map((item, i) => (
              <Link key={item.label} href={item.href} className={`flex w-16 flex-col items-center gap-1 rounded-lg py-2.5 hover:bg-white/10 transition-colors ${i === 0 ? "bg-white/10" : ""}`}>
                <SidebarIcon type={item.icon} theme={theme} />
                <span className={`text-[9px] transition-colors ${theme === "dark" ? "text-paper-300" : "text-ink-500"}`}>{item.label}</span>
              </Link>
            ))}
          </aside>
        )}

        <main className="flex-1 min-w-0">
          <div className="px-4 sm:px-6 py-10 max-w-6xl mx-auto">
            <span className={`glass-pill inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-mono-timecode text-xs tracking-[0.2em] mb-6 transition-colors ${theme === "dark" ? "text-paper-300" : "text-ink-500"}`}>
              CSE_C_06 &middot; GHRCE NAGPUR
            </span>
            <h1 className={`font-display text-5xl sm:text-6xl font-bold leading-[1.02] max-w-2xl transition-colors ${theme === "dark" ? "text-paper-100" : "text-ink-900"}`}>
              Your channel, answering in <span className="bg-gradient-to-r from-coral-400 via-rec-500 to-cited-500 bg-clip-text text-transparent">your own voice.</span>
            </h1>
            <p className={`mt-4 max-w-xl text-lg transition-colors ${theme === "dark" ? "text-paper-300" : "text-ink-500"}`}>
              A digital twin trained on your real videos — every answer grounded in something you
              actually said, cited to the second.
            </p>

            {/* Live-typing demo card — a real, working interaction, not
                a static screenshot */}
            <Reveal>
              <div className="mt-8 grid lg:grid-cols-[1.3fr_1fr] gap-5 glass-panel rounded-2xl border border-white/15 bg-white/5 p-5">
                <div className="aspect-video rounded-xl bg-gradient-to-br from-ink-950 via-ink-900 to-rec-500 flex items-center justify-center relative overflow-hidden">
                  <div className="flex items-end gap-[3px] h-14">
                    {Array.from({ length: 32 }).map((_, i) => (
                      <div key={i} className="w-1 rounded-full bg-paper-100/70 waveform-bar" style={{ height: `${20 + Math.abs(Math.sin(i * 0.6)) * 80}%`, animationDelay: `${(i % 12) * 0.08}s` }} />
                    ))}
                  </div>
                  <span className="glass-pill absolute bottom-2 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">LIVE</span>
                </div>
                <div className="flex flex-col justify-center text-left">
                  <p className="font-mono-timecode text-[10px] text-rec-400 mb-1">GROUNDED &amp; CITED</p>
                  <p className={`text-sm italic transition-colors ${theme === "dark" ? "text-paper-300" : "text-ink-500"}`}>&ldquo;Who built this project?&rdquo;</p>
                  <p className={`mt-2 font-serif text-lg min-h-[3.2em] transition-colors ${theme === "dark" ? "text-paper-100" : "text-ink-900"}`}>
                    &ldquo;{MIRROR_ANSWER.slice(0, typedLength)}
                    <span className="inline-block w-[2px] h-[1em] bg-rec-500 ml-0.5 align-middle animate-pulse" />
                    &rdquo;
                  </p>
                  <span className="mt-2 w-fit rounded bg-black/30 px-2 py-1 font-mono-timecode text-[10px] text-cited-400">cited &middot; 01:08</span>
                </div>
              </div>
            </Reveal>

            {/* Feature grid */}
            <p className={`mt-14 mb-4 text-lg font-semibold transition-colors ${theme === "dark" ? "text-paper-100" : "text-ink-900"}`}>Why creators use it</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={i * 80}>
                  <div className="glass-panel group cursor-default rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors">
                    <div className="text-3xl">{f.icon}</div>
                    <p className={`mt-3 text-sm font-medium leading-snug transition-colors ${theme === "dark" ? "text-paper-100" : "text-ink-900"}`}>{f.title}</p>
                    <p className="text-xs text-cited-400 mt-0.5">{f.stat}</p>
                    <p className={`mt-2 text-xs leading-relaxed transition-colors ${theme === "dark" ? "text-paper-300" : "text-ink-500"}`}>{f.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Timeline */}
            <section id="how-it-works" className="mt-16 max-w-2xl">
              <h2 className={`font-display text-2xl font-bold mb-1 transition-colors ${theme === "dark" ? "text-paper-100" : "text-ink-900"}`}>How it works</h2>
              <p className={`text-sm mb-8 transition-colors ${theme === "dark" ? "text-paper-300" : "text-ink-500"}`}>Four moments, laid out like the timeline it actually runs on.</p>
              <div className="relative border-l-2 border-white/10 pl-8">
                {TIMELINE.map((item, i) => (
                  <Reveal key={i} delay={i * 100}>
                    <div className="relative pb-10 last:pb-0">
                      <div className={`absolute -left-[41px] top-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-rec-500 transition-colors ${theme === "dark" ? "bg-ink-950" : "bg-paper-50"}`}>
                        <span className="h-2 w-2 rounded-full bg-rec-500" />
                      </div>
                      <span className="font-mono-timecode text-xs text-rec-400">{item.time}</span>
                      <h3 className={`font-display text-lg font-medium mt-1 transition-colors ${theme === "dark" ? "text-paper-100" : "text-ink-900"}`}>{item.title}</h3>
                      <p className={`text-sm mt-1 max-w-md leading-relaxed transition-colors ${theme === "dark" ? "text-paper-300" : "text-ink-500"}`}>{item.body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </section>

            {/* CTA */}
            <section className="mt-16 glass-panel rounded-2xl border border-white/15 bg-white/5 p-10 text-center max-w-xl mx-auto">
              <h2 className={`font-display text-3xl font-bold transition-colors ${theme === "dark" ? "text-paper-100" : "text-ink-900"}`}>Ready to train your twin?</h2>
              <p className={`mt-2 text-sm transition-colors ${theme === "dark" ? "text-paper-300" : "text-ink-500"}`}>No embedding, no code — just your channel and a link in your video description.</p>
              <Link href={ctaHref} className="mt-6 inline-block rounded-full bg-gradient-to-r from-rec-500 to-rec-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-rec-500/30 hover:scale-105 transition-transform">
                Get started
              </Link>
            </section>
          </div>
          <div className="relative"><Footer /></div>
        </main>
      </div>

      <CookieBanner />
    </div>
  );
}
