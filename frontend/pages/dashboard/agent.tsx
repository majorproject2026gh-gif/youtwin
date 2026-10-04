import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { api, authHeader, IngestStatus, PersonaProfile } from "@/lib/api";
import AppShell, { withAppFrame } from "@/components/AppShell";
import { copyText, errorMessage, readJSON } from "@/lib/browser";
import { Alert, Icon, PageHeader, Spinner } from "@/components/ui";

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
    const parsedCreator = readJSON<Creator>("youtwin_creator");
    if (!s || !parsedCreator) { router.replace("/login"); return; }
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
      setError(errorMessage(err, "Couldn't start the agent. Try again."));
      setRunning(false);
    }
  }

  useEffect(() => {
    if (!twinId || !session) return;
    let misses = 0;
    let stopped = false;
    const stop = () => {
      stopped = true;
      if (pollRef.current) clearInterval(pollRef.current);
      setRunning(false);
    };
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/twins/${twinId}/status`, { headers: authHeader(session) });
        if (stopped) return;
        misses = 0;
        setStatus(data);
        if (data.stage === "ready") {
          stop();
          try {
            const p = await api.get(`/twins/${twinId}/persona`, { headers: authHeader(session) });
            setPersona(p.data);
          } catch (err) {
            setError(errorMessage(err, "The twin is ready, but its persona couldn't be loaded."));
          }
        }
        if (data.stage === "error") stop();
      } catch {
        // It used to poll forever if the AI service lost the job.
        misses += 1;
        if (misses >= 5) {
          stop();
          setError("Lost track of this run — the AI service may have restarted. Start the agent again.");
        }
      }
    }, 1200);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [twinId, session]);

  if (!creator) return null;

  const shareUrl = `${window.location.origin}/twin/${creator.handle}`;
  const currentStage = status?.stage ?? "start";

  const isFinished = currentStage === "ready" || currentStage === "error";

  return (
    <AppShell title="Agent Build" accent="#C8302B" accent2="#2DD4BF">
      <PageHeader
        eyebrow={running ? "Agent running" : "Agent idle"}
        eyebrowTone={running ? "gold" : "muted"}
        title="Build your twin"
        description="Give it a channel (optional) and start the agent — everything after this is automatic."
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        {/* Agent identity */}
        <div className="surface-solid relative flex flex-col overflow-hidden p-7 animate-fade-up">
          <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rec-500/30 blur-[90px]" />
          <div className="absolute inset-0 bg-grid opacity-60" />
          <div className="relative">
            <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-tint/10 bg-gradient-to-b from-night-700 to-night-900 text-coral-400 shadow-lift">
              <Icon name="bot" size={26} />
              {running && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-cited-400 shadow-[0_0_10px_#E0AE4E] animate-pulse" />}
            </span>
            <p className="mt-8 font-display text-2xl font-semibold leading-snug text-fg">One click. The agent does the rest.</p>
            <p className="mt-3 text-sm leading-relaxed text-fg/55">
              Ingestion, stylometric analysis, embedding, and guardrails run automatically — no manual steps once you start it.
            </p>
          </div>
          <div className="relative mt-10 space-y-2">
            <p className="font-mono-timecode text-[11px] text-fg/35">Signed in as {creator.displayName}</p>
            <p className="font-mono-timecode text-[10px] tracking-[0.16em] text-fg/30">CC · GROUNDED · TIMESTAMPED</p>
          </div>
        </div>

        {/* Console */}
        <div className="surface flex flex-col p-6 sm:p-7 animate-fade-up" style={{ animationDelay: "80ms" }}>
          {!twinId && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="label" htmlFor="agent-channel">YouTube channel URL, @handle, or ID <span className="text-fg/35">(optional)</span></label>
                <div className="relative">
                  <Icon name="youtube" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg/35" />
                  <input
                    id="agent-channel"
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    placeholder="Leave blank to use sample data"
                    className="field pl-10"
                  />
                </div>
              </div>
              {error && <Alert>{error}</Alert>}
              <button onClick={() => startAgent(!channelId.trim())} disabled={running} className="btn btn-primary btn-lg w-full">
                {running ? <Spinner size={16} /> : <Icon name="bolt" size={16} />}
                {channelId.trim() ? "Start agent on my channel" : "Start agent with sample data"}
              </button>
              <div className="mt-2 border-t border-tint/[0.06] pt-5">
                <p className="mb-3 font-mono-timecode text-[10px] uppercase tracking-[0.16em] text-fg/35">What the agent will do</p>
                <ol className="grid gap-1.5 sm:grid-cols-2">
                  {AGENT_STEPS.map((step, i) => (
                    <li key={step.key} className="flex items-center gap-2.5 rounded-lg border border-tint/[0.05] bg-tint/[0.02] px-3 py-2 text-[13px] text-fg/55">
                      <span className="font-mono-timecode text-[10px] text-fg/30">{String(i + 1).padStart(2, "0")}</span>
                      {step.label}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {twinId && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className="font-display text-lg font-semibold text-fg">Agent log</p>
                <span className="chip font-mono-timecode !text-[10px]">
                  {isFinished ? (currentStage === "error" ? "STOPPED" : "COMPLETE") : "RUNNING"}
                </span>
              </div>
              <ul className="relative space-y-1 rounded-xl border border-tint/[0.06] bg-sunk/20 p-2 font-mono-timecode">
                {AGENT_STEPS.map((step, i) => {
                  const st = stepStatus(step.key, currentStage === "ready" ? "done" : currentStage, true);
                  const isReady = currentStage === "ready" || currentStage === "error";
                  const finalSt = step.key === "done"
                    ? (isReady && currentStage !== "error" ? "done" : "pending")
                    : step.key === "persona"
                    ? (isReady ? "done" : "pending")
                    : st;
                  return (
                    <li
                      key={step.key}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all duration-500 ${finalSt === "active" ? "bg-coral-400/[0.07]" : ""}`}
                    >
                      <span className="w-6 text-[10px] text-fg/25">{String(i + 1).padStart(2, "0")}</span>
                      <span
                        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
                          finalSt === "done"
                            ? "bg-verified-500/15 text-verified-400 ring-1 ring-verified-500/40"
                            : finalSt === "active"
                            ? "text-coral-300"
                            : "ring-1 ring-tint/15"
                        }`}
                      >
                        {finalSt === "done" ? <Icon name="check" size={11} strokeWidth={2.5} /> : finalSt === "active" ? <Spinner size={14} /> : null}
                      </span>
                      <span className={finalSt === "pending" ? "text-fg/35" : "text-fg/90"}>{step.label}</span>
                      {finalSt === "active" && <span className="caret ml-0.5 h-3.5 w-1.5 bg-coral-400/80" />}
                    </li>
                  );
                })}
              </ul>

              {status?.stage === "error" && <div className="mt-5"><Alert>{status.detail}</Alert></div>}
              {error && <div className="mt-5"><Alert>{error}</Alert></div>}

              {persona && (
                <div className="mt-6 space-y-4 border-t border-tint/[0.06] pt-6 animate-fade-up">
                  <div className="rounded-xl border border-cited-400/20 bg-cited-400/[0.06] px-4 py-3.5 font-serif text-lg italic text-fg/90">
                    &ldquo;{persona.sample_opening_line || "Hey! Ask me anything from my videos."}&rdquo;
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="field flex min-w-0 items-center gap-2 font-mono-timecode text-sm text-fg/70">
                      <Icon name="globe" size={14} className="text-fg/35" />
                      <span className="truncate">{shareUrl}</span>
                    </div>
                    <button onClick={() => void copyText(shareUrl)} className="btn btn-secondary btn-lg flex-shrink-0">
                      <Icon name="copy" size={15} /> Copy
                    </button>
                  </div>
                  <a href={`/twin/${creator.handle}`} target="_blank" rel="noreferrer" className="btn btn-primary btn-lg w-full">
                    Chat with your twin <Icon name="arrow-up-right" size={16} />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

AgentBuild.getLayout = withAppFrame;
