import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { api, resolveTwin, Citation } from "@/lib/api";
import ViewerShell from "@/components/ViewerShell";
import { EmptyState, Eyebrow, Icon, Spinner } from "@/components/ui";
import { errorMessage } from "@/lib/browser";
import Link from "next/link";
import ChatBubble, { Turn } from "@/components/ChatBubble";
import Logo from "@/components/Logo";
import VideoPanel from "@/components/VideoPanel";
import { loadViewer, ViewerIdentity } from "@/lib/viewer";

const SUGGESTED_QUESTIONS = [
  "What's your setup?",
  "What do you recommend?",
  "Tell me something from your videos.",
];

const LANGUAGES = ["English", "Hindi", "Spanish", "French", "Marathi"];

/** What the typing indicator says while an answer is being prepared. */
const THINKING_STAGES = ["Searching the videos…", "Reading the transcript…", "Writing the answer…"];

/** Starter questions built from the creator's own videos (one per video
 * title), topped up with generic ones. */
function starterQuestions(moments: { video_title: string }[]): { q: string; hint: string }[] {
  const titles = Array.from(new Set(moments.map((m) => m.video_title).filter((t) => t && !/^[A-Za-z0-9_-]{11}$/.test(t))));
  const fromVideos = titles.slice(0, 3).map((t) => ({
    q: `What's the key takeaway from "${t.length > 48 ? t.slice(0, 46) + "…" : t}"?`,
    hint: "From a video",
  }));
  const generic = SUGGESTED_QUESTIONS.map((q) => ({ q, hint: "Popular question" }));
  return [...fromVideos, ...generic].slice(0, 4);
}

interface Moment {
  text: string;
  video_id: string;
  video_title: string;
  timestamp_seconds: number;
}

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** YouTube ids are exactly 11 url-safe chars. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Accepts ?t=290, ?t=290s, ?t=4m50s or ?t=1h2m3s (YouTube's own formats). */
function parseSeconds(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  if (/^\d+s?$/.test(raw)) return Math.min(86400, parseInt(raw, 10));
  const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || !(m[1] || m[2] || m[3])) return undefined;
  return Math.min(86400, (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + +(m[3] ?? 0));
}

export default function ChatStep() {
  const router = useRouter();
  const { handle } = router.query as { handle?: string };

  // Deep link playtime context: /twin/<handle>/chat?v=<videoId>&t=<time>
  // (from the browser sidebar or a timestamped link in a description).
  // Answers are then tied to that moment of that video.
  const [watching, setWatching] = useState<{ videoId: string; at?: number } | null>(null);
  useEffect(() => {
    if (!router.isReady) return;
    const v = typeof router.query.v === "string" ? router.query.v : undefined;
    const t = typeof router.query.t === "string" ? router.query.t : undefined;
    if (v && VIDEO_ID_RE.test(v)) setWatching({ videoId: v, at: parseSeconds(t) });
  }, [router.isReady, router.query.v, router.query.t]);

  // Who is chatting (from the share link's name step). No name yet → back
  // to that step first, keeping any ?v=&t= playtime context.
  const [viewer, setViewer] = useState<ViewerIdentity | null>(null);
  useEffect(() => {
    if (!router.isReady || !handle) return;
    const v = loadViewer();
    if (v) {
      setViewer(v);
      return;
    }
    const p = new URLSearchParams();
    if (typeof router.query.v === "string") p.set("v", router.query.v);
    if (typeof router.query.t === "string") p.set("t", router.query.t);
    const qs = p.toString();
    router.replace(`/twin/${handle}${qs ? `?${qs}` : ""}`);
  }, [router, handle]);

  const [twinId, setTwinId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [askedOnce, setAskedOnce] = useState(false);
  const [language, setLanguage] = useState("English");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [showExplorer, setShowExplorer] = useState(false);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [activeCitationSiblings, setActiveCitationSiblings] = useState<Citation[]>([]);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!sending) return;
    setStage(0);
    const id = setInterval(() => setStage((s) => Math.min(s + 1, THINKING_STAGES.length - 1)), 1400);
    return () => clearInterval(id);
  }, [sending]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  // Phones: the player sits ABOVE the chat (reel-style). When a new
  // moment is cited and the player isn't on screen, bring it into view.
  useEffect(() => {
    if (!activeCitation || !videoRef.current) return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    const r = videoRef.current.getBoundingClientRect();
    if (r.top < 64 || r.top > window.innerHeight * 0.5) {
      videoRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeCitation]);

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    setLoadError(null);
    resolveTwin(handle).then((data) => {
      if (cancelled) return;
      setTwinId(data.twinId);
      const who = loadViewer()?.name.split(" ")[0];
      setTurns([{ role: "twin", content: `Hi${who ? ` ${who}` : ""}! Ask me anything from my videos.`, sentAt: Date.now() }]);
      api
        .get(`/chat/${data.twinId}/moments`)
        .then(({ data: m }) => setMoments(m.moments ?? []))
        .catch(() => {});
    }).catch((err) => {
      // An unknown/removed link used to leave the page on an empty chat
      // forever (the rejection was unhandled) — show a real error state.
      if (!cancelled)
        setLoadError(
          err?.response?.status === 404
            ? "This twin link doesn't exist, or the twin was removed."
            : errorMessage(err, "Couldn't load this twin right now."),
        );
    });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  useEffect(() => {
    // Scroll only the message list — scrollIntoView() also scrolled the
    // whole window, yanking the page down past the header on load and on
    // every new message.
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    setVoiceSupported(true);
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.abort();
      } catch {
        /* not started */
      }
    };
  }, []);

  function toggleVoiceInput() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch {
        // start() throws if a previous session is still closing
        setListening(false);
      }
    }
  }

  async function send(overrideText?: string) {
    const message = (overrideText ?? input).trim();
    if (!message || !twinId || sending) return;
    setInput("");
    // The last few real exchanges, so follow-ups ("how much was it?") make
    // sense to the twin. Errors and refusals carry no useful context.
    const history = turns
      .filter((t) => !t.error && t.content && (t.role === "viewer" || t.grounded))
      .slice(-6)
      .map((t) => ({ role: t.role, content: t.content.slice(0, 2000) }));
    setTurns((t) => [...t, { role: "viewer", content: message, sentAt: Date.now() }]);
    setSending(true);
    try {
      const { data } = await api.post("/chat", {
        twinId,
        message,
        language,
        history,
        ...(viewer ? { viewerId: viewer.id, viewerName: viewer.name } : {}),
        ...(watching ? { videoId: watching.videoId, ...(watching.at !== undefined ? { atSeconds: watching.at } : {}) } : {}),
      });
      setTurns((t) => [
        ...t,
        {
          role: "twin",
          content: data.answer,
          grounded: data.grounded,
          refused: data.refused,
          confidence: data.confidence,
          citations: data.citations,
          sentAt: Date.now(),
        },
      ]);
      // Jump the side-by-side player to the top citation automatically —
      // the viewer shouldn't have to click a badge just to see the moment
      // the answer came from, same as the reference "find the exact
      // second" UX. They can still click any other citation (this turn's
      // or an earlier one) to switch what's playing.
      if (data.citations && data.citations.length > 0) {
        setActiveCitation({ ...data.citations[0] });
        setActiveCitationSiblings(data.citations);
      }
      setAskedOnce(true);
    } catch (err) {
      setTurns((t) => [
        ...t,
        { role: "twin", content: errorMessage(err, "Sorry, something went wrong. Try again shortly."), error: true, sentAt: Date.now() },
      ]);
    } finally {
      setSending(false);
    }
  }

  function jumpToCitation(citation: Citation, siblings: Citation[]) {
    // Fresh object so clicking the same badge twice re-seeks the player.
    setActiveCitation({ ...citation });
    setActiveCitationSiblings(siblings);
  }

  if (!viewer && !loadError) {
    return (
      <ViewerShell step={3} accent="#C8302B" accent2="#E0AE4E">
        <div className="flex min-h-[60vh] items-center justify-center text-fg/50"><Spinner size={22} /></div>
      </ViewerShell>
    );
  }

  if (loadError) {
    return (
      <ViewerShell step={3} accent="#C8302B" accent2="#E0AE4E">
        <div className="mx-auto max-w-lg px-5 py-24">
          <EmptyState
            icon="link"
            title="We couldn't open this twin"
            body={loadError}
            action={<Link href="/home" className="btn btn-primary">Go to YouTwin</Link>}
          />
        </div>
      </ViewerShell>
    );
  }

  return (
    <ViewerShell step={3} accent="#C8302B" accent2="#E0AE4E" accent3="#2DD4BF">
      <div className={`mx-auto w-full px-4 pb-16 pt-5 sm:px-6 sm:pt-10 transition-[max-width] duration-500 ${activeCitation ? "max-w-7xl" : "max-w-3xl"}`}>
        <div className="mb-5 text-center animate-fade-up sm:mb-8">
          <Eyebrow>Step 3 of 4 · Chat</Eyebrow>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tightest sm:mt-5 sm:text-5xl text-gradient-soft">Ask &amp; get an answer</h1>
          <p className="mt-3 hidden text-fg/55 sm:block">Grounded, timestamped reply.</p>
        </div>

        <div className={`grid min-w-0 items-start gap-6 ${activeCitation ? "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(400px,46%)]" : "grid-cols-1"}`}>
          <div className="min-w-0 animate-fade-up" style={{ animationDelay: "80ms" }}>
            {watching && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-cited-400/25 bg-cited-400/[0.07] px-3.5 py-2 text-[13px] text-fg/75">
                <span className="flex min-w-0 items-center gap-2">
                  <Icon name="clock" size={14} className="flex-shrink-0 text-cited-300" />
                  <span className="truncate">
                    Tied to the video you were watching{watching.at !== undefined ? ` at ${formatTime(watching.at)}` : ""}
                  </span>
                </span>
                <span className="flex flex-shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const c = { video_id: watching.videoId, video_title: "The video you were watching", timestamp_seconds: watching.at ?? 0 };
                      setActiveCitation(c);
                      setActiveCitationSiblings([c]);
                    }}
                  >
                    <Icon name="play" size={12} /> Show
                  </button>
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Stop tying answers to this video" onClick={() => setWatching(null)}>
                    <Icon name="x" size={13} />
                  </button>
                </span>
              </div>
            )}
            {/* Chat window */}
            <div className="surface-solid flex flex-col overflow-hidden !rounded-[1.5rem]">
              <div className="flex items-center justify-between gap-3 border-b border-tint/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Logo size={38} withWordmark={false} />
                  <div className="min-w-0 text-left">
                    <p className="truncate text-[15px] font-semibold text-fg">My YouTwin</p>
                    <p className="flex items-center gap-1.5 text-[11px] text-fg/45">
                      <span className="h-1.5 w-1.5 rounded-full bg-verified-500 animate-glow" />
                      Active now · AI twin
                    </p>
                  </div>
                </div>
                <label className="relative flex flex-shrink-0 items-center">
                  <Icon name="globe" size={13} className="pointer-events-none absolute left-2.5 text-fg/40" />
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    aria-label="Reply language"
                    className="h-8 appearance-none rounded-lg border border-tint/10 bg-white/[0.04] pl-7 pr-7 text-xs text-fg/80 outline-none transition-colors hover:border-tint/20 focus:border-coral-400/60"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l} className="bg-night-900">{l}</option>
                    ))}
                  </select>
                  <Icon name="chevron-down" size={12} className="pointer-events-none absolute right-2.5 text-fg/40" />
                </label>
              </div>

              <div ref={scrollRef} className="relative flex max-h-[52dvh] min-h-[260px] flex-col gap-0 overflow-y-auto overscroll-contain px-4 py-5 sm:max-h-[62vh] sm:min-h-[380px]" aria-live="polite">
                <div className="pointer-events-none absolute inset-0 bg-dots opacity-[0.15]" />
                <div className="relative">
                  {turns.map((t, i) => {
                    const prevSameRole = i > 0 && turns[i - 1].role === t.role;
                    const nextSameRole = i < turns.length - 1 && turns[i + 1].role === t.role;
                    return (
                      <ChatBubble
                        key={i}
                        turn={t}
                        creatorName="YouTwin"
                        onCiteClick={jumpToCitation}
                        activeCitation={activeCitation}
                        showAvatar={!nextSameRole}
                        showTimestamp={!nextSameRole}
                        tight={prevSameRole}
                      />
                    );
                  })}
                  {sending && (
                    <div className={`flex items-end gap-2.5 ${turns[turns.length - 1]?.role === "twin" ? "mt-1" : "mt-4"} animate-bubble-in`}>
                      <Logo size={28} withWordmark={false} />
                      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-tint/[0.08] bg-white/[0.05] px-4 py-3">
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-fg/60" style={{ animationDelay: "0ms" }} />
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-fg/60" style={{ animationDelay: "150ms" }} />
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-fg/60" style={{ animationDelay: "300ms" }} />
                        <span key={stage} className="ml-1 text-[11px] text-fg/40 animate-fade-up">{THINKING_STAGES[stage]}</span>
                      </div>
                    </div>
                  )}
                  {!askedOnce && !sending && turns.length > 0 && (
                    <div className="mt-6 animate-fade-up" style={{ animationDelay: "120ms" }}>
                      <p className="mb-2.5 flex items-center gap-2 px-1 font-mono-timecode text-[10px] uppercase tracking-[0.16em] text-fg/35">
                        <Icon name="sparkles" size={11} className="text-coral-400" /> Try asking
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {starterQuestions(moments).map(({ q, hint }) => (
                          <button
                            key={q}
                            onClick={() => send(q)}
                            disabled={sending || !twinId}
                            className="group flex items-center justify-between gap-3 rounded-xl border border-tint/[0.08] bg-tint/[0.03] px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-coral-400/40 hover:bg-coral-400/[0.06] disabled:opacity-50"
                          >
                            <span className="min-w-0">
                              <span className="block text-[13.5px] leading-snug text-fg/85">{q}</span>
                              <span className="mt-1 block font-mono-timecode text-[9.5px] uppercase tracking-[0.14em] text-fg/35">{hint}</span>
                            </span>
                            <Icon name="arrow-up-right" size={15} className="flex-shrink-0 text-fg/30 transition-colors group-hover:text-coral-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              </div>

              <div className="border-t border-tint/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 rounded-xl border border-tint/10 bg-sunk/30 p-1.5 pl-4 shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] transition-colors focus-within:border-coral-400/50 focus-within:shadow-[0_0_0_4px_rgba(255,130,102,0.1)]">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder={listening ? "Listening…" : "Message my YouTwin…"}
                    aria-label="Message"
                    className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-fg outline-none placeholder:text-fg/30"
                  />
                  {voiceSupported && (
                    <button
                      onClick={toggleVoiceInput}
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-all ${
                        listening ? "bg-rec-500/15 text-rec-300 ring-1 ring-rec-400/50 animate-pulse" : "text-fg/45 hover:bg-tint/[0.06] hover:text-fg"
                      }`}
                      title="Ask by voice"
                      aria-label="Ask by voice"
                    >
                      <Icon name="mic" size={17} />
                    </button>
                  )}
                  <button onClick={() => send()} disabled={sending || !input.trim()} className="btn btn-primary btn-icon !h-9 !w-9 !rounded-lg" aria-label="Send">
                    {sending ? <Spinner size={15} /> : <Icon name="send" size={16} strokeWidth={2.25} />}
                  </button>
                </div>
                <p className="mt-2 px-1 text-center text-[10.5px] text-fg/30">
                  Answers come only from this creator&apos;s videos — if they never covered it, the twin says so.
                </p>
              </div>
            </div>

            {viewer && (
              <p className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 text-[12.5px] text-fg/45">
                <Icon name="user" size={13} /> Chatting as <span className="font-medium text-fg/80">{viewer.name}</span>
                <span aria-hidden>·</span>
                <Link href={`/twin/${handle}?change=1`} className="-my-2 py-2 text-coral-400 hover:underline">Change name</Link>
              </p>
            )}

            {moments.length > 0 && (
              <div className="mt-5">
                <button onClick={() => setShowExplorer((s) => !s)} className="btn btn-ghost btn-sm mx-auto flex">
                  <Icon name="layers" size={14} />
                  {showExplorer ? "Hide" : "Browse"} topics from the videos ({moments.length})
                  <Icon name="chevron-down" size={14} className={`transition-transform ${showExplorer ? "rotate-180" : ""}`} />
                </button>
                {showExplorer && (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 animate-fade-up">
                    {moments.map((m, i) => (
                      <button
                        key={i}
                        onClick={() => send(`Tell me more about: "${m.text.slice(0, 60)}"`)}
                        className="surface surface-interactive group !rounded-xl p-3 text-left"
                      >
                        <p className="line-clamp-2 text-[13px] text-fg/85">{m.text}</p>
                        <p className="mt-2 flex items-center gap-1.5 font-mono-timecode text-[10px] text-fg/40">
                          <Icon name="play" size={8} className="text-cited-400" />
                          <span className="truncate">{m.video_title}</span> &middot; {formatTime(m.timestamp_seconds)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {activeCitation && (
            <div ref={videoRef} className="order-first min-w-0 scroll-mt-20 lg:order-none lg:sticky lg:top-24">
              <VideoPanel
                active={activeCitation}
                citations={activeCitationSiblings}
                onSelect={(c) => setActiveCitation({ ...c })}
                onClose={() => setActiveCitation(null)}
              />
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-center gap-3 sm:mt-12">
          <button onClick={() => router.push(`/twin/${handle}`)} className="btn btn-secondary btn-lg">
            <Icon name="arrow-left" size={15} /> Back
          </button>
          <button onClick={() => router.push(`/twin/${handle}/upgrade`)} disabled={!askedOnce} className="btn btn-primary btn-xl">
            Keep chatting <Icon name="arrow-right" size={17} strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </ViewerShell>
  );
}
