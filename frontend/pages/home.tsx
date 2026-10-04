import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import AccuracySection from "@/components/AccuracySection";
import CookieBanner from "@/components/CookieBanner";
import SiteNav from "@/components/SiteNav";
import CreatorAvatar from "@/components/CreatorAvatar";
import { Backdrop, Eyebrow, Icon, Waveform, spotlight } from "@/components/ui";
import { logout as apiLogout } from "@/lib/api";

const FEATURES = [
  { icon: "wave", title: "Trained on your real videos", body: "Every response is built from your actual captions, transcripts, and speaking style.", stat: "Real transcripts" },
  { icon: "clock", title: "Timestamp-cited answers", body: "Every reply traces back to the exact second in the exact video it came from.", stat: "Cited to the second" },
  { icon: "shield", title: "Zero-hallucination guardrail", body: "If nothing in your videos actually answers the question, the twin says so instead of guessing.", stat: "Two-stage check" },
  { icon: "bolt", title: "Understands follow-ups", body: "“How much was it?” just works — the twin reads the conversation, searches by meaning and exact words, and caches popular answers.", stat: "Hybrid search" },
];

const TIMELINE = [
  { time: "00:00", title: "Connect your channel", body: "Sign in, no coding. YouTwin pulls your video library and starts learning." },
  { time: "00:24", title: "It learns your voice", body: "Captions, transcripts, and speaking patterns become a persona — not a generic chatbot." },
  { time: "01:10", title: "Viewers ask, it answers", body: "Every reply is grounded in a real moment from a real video, cited down to the second." },
  { time: "02:45", title: "It says “I don’t know” out loud", body: "If nothing in your library backs up an answer, the twin refuses instead of guessing." },
];

const STACK = ["faster-whisper", "spaCy", "BGE · sentence-transformers", "Qdrant hybrid search", "LangChain", "Llama 3 · Groq", "FastAPI", "Node · Express", "Next.js", "YouTube Data API"];

const PIPELINE = [
  { n: "M1", title: "Ingestion", body: "YouTube Data API + faster-whisper transcription", icon: "youtube" },
  { n: "M2", title: "Stylometry", body: "spaCy persona & speaking-style extraction", icon: "wave" },
  { n: "M3", title: "Embeddings", body: "BGE vectors + BM25 keywords → Qdrant", icon: "database" },
  { n: "M4", title: "RAG inference", body: "Two-stage guardrail · LangChain + LLM", icon: "cpu" },
  { n: "M5", title: "Serving", body: "Node/Express serialization → Next.js", icon: "globe" },
];

const MIRROR_ANSWER = "Four of us — Mayank Bambal, Sadiyanureen Hussain, Virender Singh and Harvinder Singh.";

export default function Home() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [typedLength, setTypedLength] = useState(0);

  useEffect(() => {
    setSignedIn(!!localStorage.getItem("youtwin_session"));
  }, []);

  useEffect(() => {
    let idx = 0;
    let timeoutId: ReturnType<typeof setTimeout>;
    function tick() {
      idx++;
      setTypedLength(idx);
      if (idx < MIRROR_ANSWER.length) {
        timeoutId = setTimeout(tick, 38);
      } else {
        timeoutId = setTimeout(() => { idx = 0; setTypedLength(0); timeoutId = setTimeout(tick, 400); }, 3200);
      }
    }
    timeoutId = setTimeout(tick, 900);
    return () => clearTimeout(timeoutId);
  }, []);

  async function logout() {
    await apiLogout();
    setSignedIn(false);
    router.push("/login");
  }

  const ctaHref = signedIn ? "/dashboard/connect" : "/login";
  const typingDone = typedLength >= MIRROR_ANSWER.length;

  return (
    <div className="relative isolate min-h-screen overflow-x-clip text-fg">
      <Backdrop accent="#C8302B" accent2="#E0AE4E" accent3="#FF8266" />

      <SiteNav signedIn={signedIn} onLogout={logout} ctaHref={ctaHref} />

      {/* ------------------------------------------------ Hero */}
      <section className="relative px-4 pb-10 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-5xl text-center">
          <div className="animate-fade-up">
            <Eyebrow>CSE_C_06 · GHRCE Nagpur</Eyebrow>
          </div>
          <h1
            className="mt-7 font-display text-[2.75rem] font-semibold leading-[0.98] tracking-tightest sm:text-7xl lg:text-[5.5rem] animate-fade-up"
            style={{ animationDelay: "80ms" }}
          >
            <span className="text-gradient-soft">Your channel, answering in</span>{" "}
            <span className="font-serif italic font-normal tracking-normal text-gradient pr-2">your own voice.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-fg/60 sm:text-lg animate-fade-up" style={{ animationDelay: "160ms" }}>
            A digital twin trained on your real videos — every answer grounded in something you actually said, cited to the second.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-up" style={{ animationDelay: "240ms" }}>
            <Link href={ctaHref} className="btn btn-primary btn-lg w-full sm:w-auto">
              Build your twin
              <Icon name="arrow-right" size={16} strokeWidth={2.25} />
            </Link>
            <a href="#how-it-works" className="btn btn-secondary btn-lg w-full sm:w-auto">
              <Icon name="play" size={14} />
              See how it works
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-fg/45 animate-fade-up" style={{ animationDelay: "320ms" }}>
            {["Grounded in real transcripts", "Cited to the second", "Refuses to guess"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <Icon name="check" size={14} strokeWidth={2.25} className="text-verified-500" />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Product frame — a live, working demo, not a screenshot */}
        <div className="relative mx-auto mt-16 max-w-5xl animate-fade-up sm:mt-20" style={{ animationDelay: "380ms" }}>
          <div className="absolute -inset-x-10 -bottom-10 top-10 -z-10 rounded-[3rem] bg-gradient-to-r from-rec-500/25 via-coral-400/15 to-cited-400/20 blur-3xl" />
          <div className="surface-solid border-gradient overflow-hidden rounded-[1.5rem] p-1.5">
            {/* window chrome */}
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]/80" />
              </div>
              <div className="mx-auto flex h-7 w-full max-w-sm items-center justify-center gap-2 rounded-md border border-tint/[0.06] bg-white/[0.03] px-3 text-[11px] text-fg/45">
                <Icon name="lock" size={11} />
                <span className="font-mono-timecode truncate">youtwin.ai/twin/mayankb/chat</span>
              </div>
              <span className="w-12" />
            </div>

            <div className="grid gap-1.5 lg:grid-cols-[1.35fr_1fr]">
              {/* Video side */}
              <div className="force-dark relative overflow-hidden rounded-xl bg-[#08080A]">
                <div className="relative aspect-video">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(242,96,63,0.45),transparent_55%),radial-gradient(ellipse_at_80%_90%,rgba(224,174,78,0.3),transparent_55%),linear-gradient(135deg,#1a0f0d,#0b0b0e)]" />
                  <div className="absolute inset-0 bg-dots opacity-30" />
                  <div className="absolute inset-x-10 top-1/2 h-20 -translate-y-1/2 sm:h-24">
                    <Waveform bars={48} color="bg-white/80" />
                  </div>
                  <div className="absolute left-4 top-4 flex items-center gap-2 rounded-md bg-black/50 px-2 py-1 text-[10px] font-medium text-white backdrop-blur">
                    <span className="live-dot !h-1.5 !w-1.5 text-rec-400" /> REC · TWIN SOURCE
                  </div>
                  <div className="absolute right-4 top-4 rounded-md bg-black/50 px-2 py-1 font-mono-timecode text-[10px] text-fg/80 backdrop-blur">1080p</div>
                  {/* scrubber */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10">
                    <div className="relative h-1 rounded-full bg-tint/20">
                      <div className="absolute inset-y-0 left-0 w-[38%] rounded-full bg-gradient-to-r from-rec-500 to-coral-400" />
                      <div className="absolute left-[38%] top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_4px_rgba(242,96,63,0.35)]" />
                      <div className="absolute -top-7 left-[38%] -translate-x-1/2 rounded bg-cited-400 px-1.5 py-0.5 font-mono-timecode text-[9px] font-semibold text-[#1A1406] shadow-glow-gold">
                        CITED 01:08
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between font-mono-timecode text-[10px] text-fg/60">
                      <span className="flex items-center gap-2"><Icon name="play" size={10} /> 01:08 / 02:58</span>
                      <span>Building YouTwin — project walkthrough</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat side */}
              <div className="flex flex-col rounded-xl bg-night-900/80 p-4 text-left">
                <div className="flex items-center gap-2.5 border-b border-tint/[0.06] pb-3">
                  <CreatorAvatar name="Mayank" size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-fg/90">Mayank&apos;s twin</p>
                    <p className="flex items-center gap-1.5 text-[11px] text-fg/45">
                      <span className="live-dot !h-1.5 !w-1.5 text-verified-500" /> Grounded mode
                    </p>
                  </div>
                  <span className="rounded-md border border-verified-500/30 bg-verified-500/10 px-1.5 py-0.5 font-mono-timecode text-[9px] text-verified-400">
                    GROUNDED &amp; CITED
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-end gap-3 pt-4">
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-rec-400 to-rec-600 px-3.5 py-2 text-[13px] text-white shadow-[0_6px_18px_-6px_rgba(200,48,43,0.7)]">
                    Who built this project?
                  </div>
                  <div className="flex items-end gap-2">
                    <CreatorAvatar name="Mayank" size={22} />
                    <div className="min-h-[5.5rem] max-w-[88%] rounded-2xl rounded-bl-md border border-tint/[0.06] bg-white/[0.05] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-fg/90">
                      {MIRROR_ANSWER.slice(0, typedLength)}
                      {!typingDone && <span className="caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-coral-400" />}
                      <div className={`mt-2 flex items-center gap-2 transition-all duration-500 ${typingDone ? "opacity-100" : "translate-y-1 opacity-0"}`}>
                        <span className="inline-flex items-center gap-1 rounded-md bg-sunk/40 px-2 py-0.5 font-mono-timecode text-[10.5px] text-cited-300 ring-1 ring-cited-400/25">
                          <Icon name="play" size={8} /> cited · 01:08
                        </span>
                        <span className="text-[10.5px] text-fg/35">confidence 0.94</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-tint/[0.07] bg-sunk/30 p-1.5 pl-3.5">
                  <span className="flex-1 text-[12.5px] text-fg/30">Message the twin…</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-b from-rec-400 to-rec-600 text-white">
                    <Icon name="send" size={13} strokeWidth={2.25} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Stack marquee */}
      <section className="py-14">
        <p className="text-center font-mono-timecode text-[11px] uppercase tracking-[0.2em] text-fg/35">Built on a real ML stack</p>
        <div className="marquee-mask mt-6 overflow-hidden">
          <div className="marquee-track gap-3">
            {[...STACK, ...STACK].map((s, i) => (
              <span key={i} className="mx-1.5 whitespace-nowrap rounded-full border border-tint/[0.07] bg-tint/[0.03] px-4 py-2 text-sm text-fg/55">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Features (bento) */}
      <section id="features" className="scroll-mt-24 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="max-w-2xl">
              <Eyebrow tone="gold">Why creators use it</Eyebrow>
              <h2 className="mt-5 font-display text-3xl font-semibold leading-tight sm:text-5xl">
                <span className="text-gradient-soft">A twin that sounds like you</span>{" "}
                <span className="font-serif italic font-normal text-fg/70">— and never makes things up.</span>
              </h2>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-4 md:grid-cols-6">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 70} className={i === 0 || i === 3 ? "md:col-span-4" : "md:col-span-2"}>
                <div onMouseMove={spotlight} className="surface surface-interactive spotlight group flex h-full min-h-[240px] flex-col overflow-hidden p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-tint/10 bg-gradient-to-b from-tint/10 to-tint/[0.02] text-coral-400 shadow-card transition-transform duration-500 group-hover:scale-110">
                      <Icon name={f.icon} size={20} />
                    </span>
                    <span className="rounded-full border border-cited-400/25 bg-cited-400/10 px-2.5 py-1 font-mono-timecode text-[10px] uppercase tracking-wider text-cited-400">
                      {f.stat}
                    </span>
                  </div>
                  <div className="mt-auto pt-10">
                    <h3 className="font-display text-xl font-semibold text-fg">{f.title}</h3>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-fg/55">{f.body}</p>
                  </div>
                  {i === 0 && (
                    <div className="pointer-events-none absolute right-6 top-20 hidden h-16 w-56 opacity-40 transition-opacity duration-500 group-hover:opacity-80 md:block">
                      <Waveform bars={40} color="bg-coral-400" />
                    </div>
                  )}
                  {i === 1 && (
                    <div className="pointer-events-none absolute left-6 right-6 top-[5.5rem] flex flex-wrap gap-1.5 opacity-70 transition-opacity duration-500 group-hover:opacity-100">
                      {["01:08", "04:12", "12:45"].map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 rounded-md bg-sunk/30 px-2 py-0.5 font-mono-timecode text-[10.5px] text-cited-300 ring-1 ring-cited-400/25">
                          <Icon name="play" size={8} /> {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {i === 2 && (
                    <div className="pointer-events-none absolute left-6 right-6 top-[5.5rem] opacity-70 transition-opacity duration-500 group-hover:opacity-100">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-cited-400/40 bg-cited-400/[0.06] px-2.5 py-1 text-[11px] text-fg/65">
                        <Icon name="shield" size={12} className="text-cited-300" /> I haven&apos;t covered that yet
                      </span>
                    </div>
                  )}
                  {i === 3 && (
                    <div className="pointer-events-none absolute right-6 top-16 hidden gap-2 md:flex">
                      {["meaning", "+ keywords", "+ context"].map((c) => (
                        <span key={c} className="rounded-md border border-tint/10 bg-tint/[0.04] px-2 py-1 font-mono-timecode text-[10px] text-fg/50">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ How it works (timeline) */}
      <section id="how-it-works" className="scroll-mt-24 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-xl">
                <Eyebrow>How it works</Eyebrow>
                <h2 className="mt-5 font-display text-3xl font-semibold sm:text-5xl text-gradient-soft">Four moments, one timeline.</h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-fg/55">Laid out like the timeline it actually runs on — from connecting a channel to the twin saying &ldquo;I don&apos;t know.&rdquo;</p>
            </div>
          </Reveal>

          <div className="relative mt-14">
            {/* track */}
            <div className="absolute left-0 right-0 top-[22px] hidden h-px bg-gradient-to-r from-rec-500/60 via-tint/15 to-transparent md:block" />
            <div className="grid gap-6 md:grid-cols-4">
              {TIMELINE.map((item, i) => (
                <Reveal key={item.time} delay={i * 110}>
                  <div className="relative">
                    <div className="mb-6 flex items-center gap-3">
                      <span className="relative flex h-11 w-11 items-center justify-center rounded-full border border-rec-500/40 bg-night-900 shadow-[0_0_0_6px_rgb(var(--canvas)),0_0_24px_rgba(200,48,43,0.4)]">
                        <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-b from-coral-400 to-rec-500" />
                      </span>
                      <span className="rounded-md border border-rec-500/25 bg-night-900 px-2 py-0.5 font-mono-timecode text-sm text-rec-400">{item.time}</span>
                    </div>
                    <div onMouseMove={spotlight} className="surface surface-interactive spotlight h-full p-5">
                      <h3 className="font-display text-lg font-semibold text-fg">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-fg/55">{item.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Pipeline */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="surface overflow-hidden p-6 sm:p-10">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <Eyebrow tone="teal">Under the hood</Eyebrow>
                  <h2 className="mt-5 font-display text-2xl font-semibold sm:text-4xl">A five-module pipeline</h2>
                </div>
                <p className="max-w-sm text-sm text-fg/55">From raw YouTube audio to a grounded answer, cited to the second — five modules, one pipeline.</p>
              </div>
              <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {PIPELINE.map((p, i) => (
                  <div key={p.n} className="group relative rounded-2xl border border-tint/[0.07] bg-tint/[0.025] p-4 transition-colors hover:border-signal-400/30 hover:bg-signal-400/[0.04]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono-timecode text-[11px] text-signal-400">{p.n}</span>
                      <Icon name={p.icon} size={17} className="text-fg/40 transition-colors group-hover:text-signal-400" />
                    </div>
                    <p className="mt-6 font-medium text-fg">{p.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-fg/50">{p.body}</p>
                    {i < PIPELINE.length - 1 && (
                      <Icon name="chevron-right" size={14} className="absolute -right-[11px] top-1/2 z-10 hidden -translate-y-1/2 text-fg/25 lg:block" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <AccuracySection />

      {/* ------------------------------------------------ CTA */}
      <section className="px-4 pb-28 pt-10 sm:px-6">
        <Reveal>
          <div className="relative mx-auto max-w-4xl">
            <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-r from-rec-500/30 via-coral-400/20 to-cited-400/25 blur-3xl" />
            <div className="surface-solid border-gradient overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:px-16">
              <div className="absolute inset-0 bg-grid opacity-60" />
              <div className="relative">
                <h2 className="font-display text-3xl font-semibold text-fg sm:text-5xl">
                  Ready to train <span className="font-serif italic font-normal text-gradient">your twin?</span>
                </h2>
                <p className="mx-auto mt-4 max-w-md text-[15px] text-fg/55">
                  No embedding, no code — just your channel and a link in your video description.
                </p>
                <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link href={ctaHref} className="btn btn-primary btn-xl">
                    Get started <Icon name="arrow-right" size={16} strokeWidth={2.25} />
                  </Link>
                  <Link href="/about" className="btn btn-ghost btn-lg !text-fg/70 hover:!text-fg">
                    Read about the project
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <Footer />
      <CookieBanner />
    </div>
  );
}
