import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { api, ChatTurn } from "@/lib/api";
import Logo from "@/components/Logo";
import ChatBubble from "@/components/ChatBubble";

const SUGGESTED_QUESTIONS = [
  "What's your setup?",
  "What do you recommend?",
  "Tell me something from your videos.",
];

const LANGUAGES = ["English", "Hindi", "Spanish", "French", "Marathi"];

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
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ChatStep() {
  const router = useRouter();
  const { handle } = router.query as { handle?: string };

  const [twinId, setTwinId] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [askedOnce, setAskedOnce] = useState(false);
  const [language, setLanguage] = useState("English");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [showExplorer, setShowExplorer] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!handle) return;
    api.get(`/twins/by-handle/${handle}`).then(({ data }) => {
      setTwinId(data.twinId);
      setCreatorName(data.creatorName);
      setTurns([{ role: "twin", content: "Hi! Ask me anything from my videos." }]);
      api
        .get(`/chat/${data.twinId}/moments`)
        .then(({ data: m }) => setMoments(m.moments ?? []))
        .catch(() => {});
    });
  }, [handle]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
  }, []);

  function toggleVoiceInput() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setListening(true);
      recognitionRef.current.start();
    }
  }

  async function send(overrideText?: string) {
    const message = (overrideText ?? input).trim();
    if (!message || !twinId || sending) return;
    setInput("");
    setTurns((t) => [...t, { role: "viewer", content: message }]);
    setSending(true);
    try {
      const { data } = await api.post("/chat", { twinId, message, language });
      setTurns((t) => [
        ...t,
        { role: "twin", content: data.answer, grounded: data.grounded, confidence: data.confidence, citations: data.citations },
      ]);
      setAskedOnce(true);
    } catch {
      setTurns((t) => [...t, { role: "twin", content: "Sorry, something went wrong. Try again shortly." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-ink-950 flex flex-col">
      <div className="bg-orb-a pointer-events-none absolute -left-32 top-[10%] h-[500px] w-[500px] rounded-full opacity-35 blur-[120px]" style={{ background: "radial-gradient(circle, #C22A2A 0%, transparent 70%)" }} />
      <div className="bg-orb-b pointer-events-none absolute right-[-15%] bottom-[5%] h-[460px] w-[460px] rounded-full opacity-30 blur-[120px]" style={{ background: "radial-gradient(circle, #D9A441 0%, transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.1]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />

      <nav className="relative flex items-center justify-between px-8 py-6">
        <Link href="/home"><Logo dark /></Link>
        <span className="font-mono-timecode text-xs tracking-[0.2em] text-paper-300">STEP 3 OF 4 &middot; CHAT</span>
      </nav>

      <div className="relative flex-1 flex flex-col items-center px-6 py-6 text-center">
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-paper-100 mb-2">Ask &amp; get an answer</h1>
        <p className="text-base text-paper-300 mb-8">Grounded, timestamped reply.</p>

        <div className="w-full max-w-lg text-left">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="text-sm font-medium text-cited-400">{creatorName ? `${creatorName}'s Twin` : "Creator Twin"}</div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="glass-pill rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs text-paper-100 outline-none focus:border-coral-400"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l} className="text-ink-900">{l}</option>
              ))}
            </select>
          </div>

          {/* Bright "device screen" for the actual conversation, sitting
              inside the dark bespoke environment — ChatBubble's styling
              was built for a light surface, so it stays as-is here. */}
          <div className="rounded-2xl border border-white/15 bg-white p-4 flex flex-col gap-3 min-h-[280px] shadow-2xl shadow-black/40">
            {turns.map((t, i) => (
              <ChatBubble key={i} turn={t} />
            ))}
            {sending && <div className="text-xs text-ink-300">typing…</div>}
            <div ref={bottomRef} />
          </div>

          {moments.length > 0 && (
            <div className="mt-3">
              <button onClick={() => setShowExplorer((s) => !s)} className="text-xs text-cited-400 underline hover:text-cited-300">
                {showExplorer ? "Hide" : "Browse"} topics from the videos ({moments.length})
              </button>
              {showExplorer && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {moments.map((m, i) => (
                    <button
                      key={i}
                      onClick={() => send(`Tell me more about: "${m.text.slice(0, 60)}"`)}
                      className="glass-panel text-left rounded-lg border border-white/15 bg-white/10 p-2.5 hover:bg-white/15 transition-colors"
                    >
                      <p className="text-[11px] text-paper-100 line-clamp-2">{m.text}</p>
                      <p className="mt-1 font-mono-timecode text-[9px] text-paper-300/70">
                        {m.video_title} &middot; {formatTime(m.timestamp_seconds)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!askedOnce && (
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={sending}
                  className="glass-pill rounded-full border border-white/15 px-3 py-1.5 text-xs text-paper-300 hover:bg-white/10 hover:text-paper-100 transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={listening ? "Listening…" : "Type a message…"}
              className="flex-1 rounded-full border border-white/15 bg-black/25 px-4 py-2.5 text-sm text-paper-100 placeholder:text-paper-300/40 outline-none focus:border-coral-400 transition-colors"
            />
            {voiceSupported && (
              <button
                onClick={toggleVoiceInput}
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
                  listening ? "border-rec-500 bg-rec-500/20 text-rec-400 animate-pulse" : "border-white/15 text-paper-300 hover:bg-white/10"
                }`}
                title="Ask by voice"
              >
                🎤
              </button>
            )}
            <button
              onClick={() => send()}
              disabled={sending}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-rec-500 to-rec-600 text-white shadow-lg shadow-rec-500/30 disabled:opacity-50"
            >
              →
            </button>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-4">
          <button onClick={() => router.push(`/twin/${handle}/open`)} className="glass-pill rounded-full border border-white/15 px-6 py-2.5 text-sm text-paper-300 hover:bg-white/10 transition-colors">
            ← Back
          </button>
          <button
            onClick={() => router.push(`/twin/${handle}/upgrade`)}
            disabled={!askedOnce}
            className="rounded-full bg-gradient-to-r from-rec-500 to-rec-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rec-500/30 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 transition-all"
          >
            Keep chatting →
          </button>
        </div>
      </div>
    </div>
  );
}
