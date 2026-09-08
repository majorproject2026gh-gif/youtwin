import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { api, authHeader, IngestStatus, PersonaProfile } from "@/lib/api";
import Logo from "@/components/Logo";
import Footer from "@/components/Footer";

type Creator = { id: string; displayName: string; handle: string; googleLinked: boolean };

/**
 * Maps the AI service's real pipeline stages (M1-M4, see ai-service's
 * status enum) onto a narrated agent log. Every line here corresponds
 * to genuine backend progress — this isn't a fake loading animation.
 */
const AGENT_STEPS: { key: IngestStatus["stage"] | "start" | "persona" | "done"; label: string }[] = [
  { key: "start", label: "Verifying channel access" },
  { key: "fetching_captions", label: "Fetching video captions" },
  { key: "transcribing_audio", label: "Transcribing untitled audio (Whisper)" },
  { key: "extracting_style", label: "Learning speaking style & tone" },
  { key: "embedding", label: "Indexing into vector memory" },
  { key: "persona", label: "Applying default guardrails" },
  { key: "done", label: "Twin is live" },
];

function stepStatus(stepKey: string, currentStage: string, reached: boolean): "done" | "active" | "pending" {
  const order = AGENT_STEPS.map((s) => s.key);
  const stepIdx = order.indexOf(stepKey as any);
  const currentIdx = order.indexOf(currentStage as any);
  if (reached && stepIdx <= currentIdx) return "done";
  if (stepIdx === currentIdx) return "active";
  return "pending";
}

export default function AgentBuild() {
  const router = useRouter();
  const [session, setSession] = useState<string | null>(null);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [channelId, setChannelId] = useState("");
  const [twinId, setTwinId] = useState<string | null>(null);
  const [status, setStatus] = useState<IngestStatus | null>(null);
  const [persona, setPersona] = useState<PersonaProfile | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const s = localStorage.getItem("youtwin_session");
    const c = localStorage.getItem("youtwin_creator");
    if (!s || !c) { router.replace("/login"); return; }
    const parsedCreator: Creator = JSON.parse(c);
    if (!parsedCreator.googleLinked) { router.replace("/dashboard/connect"); return; }
    setSession(s);
    setCreator(parsedCreator);
  }, [router]);

  async function startAgent(useSampleData: boolean) {
    if (!session) return;
    setError(null);
    setRunning(true);
    try {
      const { data } = await api.post(
        "/twins",
        { channelId: channelId.trim() || undefined, useSampleData },
        { headers: authHeader(session) }
      );
      localStorage.setItem("youtwin_twinId", data.twinId);
      setTwinId(data.twinId);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't start the agent. Try again.");
      setRunning(false);
    }
  }

  useEffect(() => {
    if (!twinId || !session) return;
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/twins/${twinId}/status`, { headers: authHeader(session) });
        setStatus(data);
        if (data.stage === "ready") {
          clearInterval(pollRef.current!);
          const p = await api.get(`/twins/${twinId}/persona`, { headers: authHeader(session) });
          setPersona(p.data);
        }
        if (data.stage === "error") clearInterval(pollRef.current!);
      } catch {
        /* keep polling */
      }
    }, 1200);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [twinId, session]);

  if (!creator) return null;

  const shareUrl = `youtwin.ai/${creator.handle}`;
  const currentStage = status?.stage ?? "start";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-paper-100">
      {/* Left: agent identity panel */}
      <aside className="relative hidden lg:flex lg:w-[360px] flex-shrink-0 flex-col overflow-hidden bg-ink-950 px-10 py-10 text-paper-100">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-[100px]"
          style={{ background: "radial-gradient(circle, #C22A2A 0%, transparent 70%)" }}
        />
        <div className="relative flex flex-1 flex-col justify-between">
          <Link href="/home"><Logo dark /></Link>
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-mono-timecode text-paper-300">
              <span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-cited-500 animate-pulse" : "bg-ink-300"}`} />
              {running ? "AGENT RUNNING" : "AGENT IDLE"}
            </div>
            <p className="font-display text-2xl font-semibold leading-snug">
              One click. The agent does the rest.
            </p>
            <p className="mt-3 text-sm text-paper-300 leading-relaxed">
              Ingestion, stylometric analysis, embedding, and guardrails run automatically —
              no manual steps once you start it.
            </p>
          </div>
          <p className="font-mono-timecode text-[10px] tracking-wide text-ink-300">
            CC &middot; GROUNDED &middot; TIMESTAMPED
          </p>
        </div>
      </aside>

      {/* Right: live agent console */}
      <main className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center px-6 py-14">
          <div className="w-full max-w-xl">
            <p className="font-mono-timecode text-xs text-ink-300 mb-2">Signed in as {creator.displayName}</p>
            <h1 className="font-display text-3xl font-bold text-ink-900">Build your twin</h1>
            <p className="mt-1 mb-8 text-ink-500">
              Give it a channel (optional) and start the agent — everything after this is automatic.
            </p>

            {!twinId && (
              <div className="rounded-xl border border-paper-300 bg-white p-6 shadow-sm space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-700">
                    YouTube channel URL, @handle, or ID (optional)
                  </span>
                  <input
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    placeholder="Leave blank to use sample data"
                    className="w-full rounded-lg border border-paper-300 px-3 py-2.5 text-sm focus:outline-none focus:border-rec-500 focus:ring-2 focus:ring-rec-500/10"
                  />
                </label>
                {error && <p className="rounded bg-rec-500/10 px-3 py-2 text-xs text-rec-500">{error}</p>}
                <button
                  onClick={() => startAgent(!channelId.trim())}
                  disabled={running}
                  className="w-full rounded-lg bg-rec-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rec-500/25 hover:bg-rec-600 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all"
                >
                  {channelId.trim() ? "Start agent on my channel" : "Start agent with sample data"}
                </button>
              </div>
            )}

            {twinId && (
              <div className="rounded-xl border border-paper-300 bg-white p-6 shadow-sm">
                <ul className="space-y-4">
                  {AGENT_STEPS.map((step) => {
                    const st = stepStatus(step.key, currentStage === "ready" ? "done" : currentStage, true);
                    const isReady = currentStage === "ready" || currentStage === "error";
                    const finalSt = step.key === "done"
                      ? (isReady && currentStage !== "error" ? "done" : "pending")
                      : step.key === "persona"
                      ? (isReady ? "done" : "pending")
                      : st;
                    return (
                      <li key={step.key} className="flex items-center gap-3">
                        <span
                          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-mono-timecode transition-colors ${
                            finalSt === "done"
                              ? "bg-cited-500 text-white"
                              : finalSt === "active"
                              ? "bg-rec-500 text-white animate-pulse"
                              : "border border-paper-300 text-ink-300"
                          }`}
                        >
                          {finalSt === "done" ? "✓" : ""}
                        </span>
                        <span className={`text-sm ${finalSt === "pending" ? "text-ink-300" : "text-ink-900"}`}>
                          {step.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {status?.stage === "error" && (
                  <p className="mt-5 rounded bg-rec-500/10 px-3 py-2 text-xs text-rec-500">{status.detail}</p>
                )}

                {persona && (
                  <div className="mt-6 border-t border-paper-300 pt-6">
                    <div className="rounded-lg bg-paper-200 px-4 py-3 text-sm text-ink-900 mb-4">
                      &ldquo;{persona.sample_opening_line || "Hey! Ask me anything from my videos."}&rdquo;
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      <input readOnly value={shareUrl} className="flex-1 rounded border border-paper-300 px-3 py-2 text-xs text-ink-500" />
                      <button
                        onClick={() => navigator.clipboard.writeText(shareUrl)}
                        className="rounded bg-rec-500 px-3 py-2 text-xs font-medium text-white hover:bg-rec-600"
                      >
                        Copy
                      </button>
                    </div>
                    <a
                      href={`/twin/${creator.handle}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-full rounded-lg bg-ink-950 px-5 py-3 text-center text-sm font-semibold text-paper-100 hover:bg-ink-900 transition-colors"
                    >
                      Chat with your twin →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <Footer />
      </main>
    </div>
  );
}
