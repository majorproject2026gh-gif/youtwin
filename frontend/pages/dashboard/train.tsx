import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { errorMessage } from "@/lib/browser";
import { api, authHeader, IngestStatus } from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Alert, Icon, PageHeader, RadialGauge, Spinner } from "@/components/ui";
import { StageHandoff, withStudio } from "@/components/StudioWorkspace";
import { useStudio } from "@/components/studio";

const STAGE_LABELS: Record<string, string> = {
  queued: "Queued…",
  fetching_captions: "Fetching captions",
  transcribing_audio: "Transcribing audio",
  extracting_style: "Learning the voice",
  embedding: "Indexing the channel's videos",
  ready: "Ready",
  error: "Something went wrong",
};

const PIPELINE: { key: IngestStatus["stage"]; label: string; icon: string }[] = [
  { key: "queued", label: "Queued", icon: "clock" },
  { key: "fetching_captions", label: "Fetching captions", icon: "youtube" },
  { key: "transcribing_audio", label: "Transcribing audio", icon: "mic" },
  { key: "extracting_style", label: "Learning the voice", icon: "wave" },
  { key: "embedding", label: "Indexing the videos", icon: "database" },
  { key: "ready", label: "Twin ready", icon: "check-circle" },
];

/**
 * The Train step — the one moment in the flow with real, dramatic state
 * to show (a model actually training), so it gets a live pipeline view
 * and a large progress gauge. Polling, error recovery and the
 * direct-video-vs-channel detection are unchanged.
 */
export default function TrainStep() {
  const router = useRouter();
  const [session, setSession] = useState<string | null>(null);
  const [twinId, setTwinId] = useState<string | null>(null);
  const [status, setStatus] = useState<IngestStatus | null>(null);
  const [channelId, setChannelId] = useState("");
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const s = localStorage.getItem("youtwin_session");
    if (!s) {
      router.replace("/dashboard/connect");
      return;
    }
    setSession(s);
    const savedTwin = localStorage.getItem("youtwin_twinId");
    if (savedTwin) setTwinId(savedTwin);
  }, [router]);

  // "New twin" (top bar) / "Train another video" navigate here with
  // ?fresh=… — if this page is already open it doesn't remount, so the
  // old twin's progress used to stay on screen. Reset explicitly.
  useEffect(() => {
    if (router.query.fresh) {
      resetTraining();
      setChannelId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.fresh]);

  function resetTraining() {
    if (pollRef.current) clearInterval(pollRef.current);
    localStorage.removeItem("youtwin_twinId");
    setTwinId(null);
    setStatus(null);
    setStartError(null);
  }

  function isDirectVideoUrl(input: string): boolean {
    return /(?:watch\?v=|youtu\.be\/|\/shorts\/)/.test(input);
  }

  async function startTraining(useSampleData: boolean) {
    if (!session || starting) return;
    setStartError(null);
    setStarting(true);
    try {
      const trimmed = channelId.trim();
      const payload = useSampleData
        ? { useSampleData: true }
        : isDirectVideoUrl(trimmed)
        ? { videoUrls: [trimmed], useSampleData: false }
        : { channelId: trimmed, useSampleData: false };

      const { data } = await api.post("/twins", payload, { headers: authHeader(session) });
      localStorage.setItem("youtwin_twinId", data.twinId);
      setTwinId(data.twinId);
      setStatus(null);
    } catch (err: any) {
      setStartError(errorMessage(err, "Couldn't start training. Is the backend running?"));
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    if (!twinId || !session) return;
    let missCount = 0;

    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/twins/${twinId}/status`, { headers: authHeader(session) });
        missCount = 0;
        setStatus(data);
        if (data.stage === "ready" || data.stage === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        missCount += 1;
        if (missCount >= 4) {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus({
            twin_id: twinId, stage: "error", percent: 0, videos_processed: 0, videos_total: 0,
            detail: "Lost track of this training run — the AI service may have restarted. Start a new one below.",
          });
        }
      }
    }, 1500);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [twinId, session]);

  const showStartForm = !twinId;
  const { update: updateStudio } = useStudio();
  // Publish live training state to the workspace blueprint.
  useEffect(() => {
    if (!status) return;
    updateStudio({
      knowledge: {
        state: status.stage === "ready" ? "ready" : status.stage === "error" ? "error" : "training",
        label: STAGE_LABELS[status.stage] ?? status.stage,
        percent: status.percent,
        videos: status.videos_total > 0 ? `${status.videos_processed}/${status.videos_total}` : undefined,
        source: channelId.trim() || undefined,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.stage, status?.percent, status?.videos_processed]);

  const showWaiting = !!twinId && !status;
  const isError = status?.stage === "error";
  const isReady = status?.stage === "ready";
  const showProgress = !!twinId && !!status && !isReady && !isError;
  const percent = status?.percent ?? 0;

  const ringColor = isError ? "#C22A2A" : isReady ? "#10B981" : "#FF8266";

  const stageIdx = status ? PIPELINE.findIndex((p) => p.key === status.stage) : -1;
  const trimmed = channelId.trim();
  const sourceHint = !trimmed
    ? "Leave blank to train on bundled sample data — no YouTube access needed."
    : isDirectVideoUrl(trimmed)
    ? "Trains only on this specific video — other videos on the channel are ignored."
    : "Trains on up to 6 recent videos from this channel.";

  return (
    <AppShell setupStep={2} title="Train twin" accent={ringColor} accent2="#E0AE4E">
      <PageHeader
        compact
        title="Your twin trains itself"
        description="Ingests videos, learns the voice — watch it happen in real time."
      />

      <div className="mt-7 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="surface flex flex-col p-6 sm:p-8 animate-fade-up" style={{ animationDelay: "80ms" }}>
          {showStartForm && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="font-display text-lg font-semibold text-fg">Choose a source</p>
                <p className="mt-1 text-sm text-fg/50">A single video, a whole channel, or the bundled sample creator.</p>
              </div>
              <div>
                <label className="label" htmlFor="source">Video URL, channel URL, @handle, or ID <span className="text-fg/35">(optional)</span></label>
                <div className="relative">
                  <Icon name="link" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg/35" />
                  <input
                    id="source"
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !starting && startTraining(!channelId.trim())}
                    placeholder="https://youtube.com/watch?v=… or @yourchannel"
                    className="field pl-10"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { k: "sample", label: "Sample creator", icon: "sparkles", on: !trimmed },
                    { k: "video", label: "Single video", icon: "play", on: !!trimmed && isDirectVideoUrl(trimmed) },
                    { k: "channel", label: "Channel", icon: "youtube", on: !!trimmed && !isDirectVideoUrl(trimmed) },
                  ].map((c) => (
                    <span
                      key={c.k}
                      className={`chip transition-all ${c.on ? "!border-coral-400/40 !bg-coral-400/10 !text-coral-300" : "opacity-50"}`}
                    >
                      <Icon name={c.icon} size={12} /> {c.label}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-fg/45">{sourceHint}</p>
              </div>
              <button onClick={() => startTraining(!channelId.trim())} disabled={starting} className="btn btn-primary btn-lg w-full">
                {starting ? (
                  <><Spinner size={16} /> Starting…</>
                ) : (
                  <>
                    <Icon name="sparkles" size={16} />
                    {trimmed ? (isDirectVideoUrl(trimmed) ? "Ingest this video" : "Ingest my channel") : "Load sample creator"}
                  </>
                )}
              </button>
              {startError && <Alert>{startError}</Alert>}
            </div>
          )}

          {!showStartForm && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between">
                <p className="font-display text-lg font-semibold text-fg">
                  {isReady ? "Twin trained" : isError ? "Training didn\u2019t finish" : showWaiting ? "Starting up…" : STAGE_LABELS[status!.stage] ?? status!.stage}
                </p>
                {status && status.videos_total > 0 && (
                  <span className="chip font-mono-timecode">
                    <Icon name="video" size={12} /> {status.videos_processed}/{status.videos_total} videos
                  </span>
                )}
              </div>

              <ol className="relative mt-6 space-y-1">
                {PIPELINE.map((p, i) => {
                  const done = isReady ? true : stageIdx > i;
                  const active = !isReady && !isError && (stageIdx === i || (showWaiting && i === 0));
                  const failed = isError && (stageIdx === i || (stageIdx === -1 && i === 0));
                  return (
                    <li
                      key={p.key}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-500 ${active ? "bg-tint/[0.05] ring-1 ring-tint/10" : ""}`}
                    >
                      <span
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-500 ${
                          failed
                            ? "bg-rec-500/15 text-rec-300 ring-1 ring-rec-500/40"
                            : done
                            ? "bg-verified-500/12 text-verified-400 ring-1 ring-verified-500/30"
                            : active
                            ? "bg-coral-400/15 text-coral-300 ring-1 ring-coral-400/40 shadow-[0_0_16px_rgba(255,130,102,0.35)]"
                            : "bg-tint/[0.04] text-fg/30 ring-1 ring-tint/[0.08]"
                        }`}
                      >
                        {failed ? <Icon name="alert" size={15} /> : done ? <Icon name="check" size={15} strokeWidth={2.25} /> : active ? <Spinner size={15} /> : <Icon name={p.icon} size={15} />}
                      </span>
                      <span className={`text-sm ${done || active ? "text-fg" : "text-fg/40"}`}>{p.label}</span>
                      {active && status && <span className="ml-auto font-mono-timecode text-xs text-coral-300">{percent}%</span>}
                      {done && !isReady && <span className="ml-auto font-mono-timecode text-[11px] text-fg/30">done</span>}
                    </li>
                  );
                })}
              </ol>

              {isError && status && (
                <div className="mt-6 flex flex-col items-start gap-4">
                  <Alert>{status.detail}</Alert>
                  <button onClick={resetTraining} className="btn btn-primary">
                    <Icon name="refresh" size={15} /> Try again
                  </button>
                </div>
              )}

              {isReady && status?.detail && (
                <div className="mt-6"><Alert tone="success">{status.detail}</Alert></div>
              )}

              {!isError && (
                <button onClick={resetTraining} className="btn btn-ghost btn-sm mt-5 w-fit">
                  <Icon name="refresh" size={14} /> Start over
                </button>
              )}
            </div>
          )}

        </div>

        {/* Training core */}
        <div className="surface-solid relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden p-8 animate-fade-up" style={{ animationDelay: "160ms" }}>
          <div className="absolute inset-0 bg-dots opacity-40" />
          <div className="relative">
            <RadialGauge
              value={isReady || isError ? 100 : percent}
              color={ringColor}
              size={260}
              stroke={14}
              halo={showProgress}
              indeterminate={showWaiting}
            >
              {isReady ? (
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-verified-500 text-white shadow-glow-green animate-scale-in">
                  <Icon name="check" size={32} strokeWidth={2.5} />
                </span>
              ) : isError ? (
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rec-500 text-white shadow-glow animate-scale-in">
                  <Icon name="alert" size={28} />
                </span>
              ) : showWaiting ? (
                <span className="font-mono-timecode text-xs uppercase tracking-[0.2em] text-fg/50">Starting</span>
              ) : showProgress ? (
                <>
                  <span className="font-display text-6xl font-semibold tabular-nums text-fg">
                    {percent}
                    <span className="text-2xl text-fg/40">%</span>
                  </span>
                  <span className="mt-2 max-w-[140px] text-center font-mono-timecode text-[10px] uppercase leading-relaxed tracking-[0.16em] text-fg/45">
                    {STAGE_LABELS[status!.stage] ?? status!.stage}
                  </span>
                </>
              ) : (
                <span className="flex flex-col items-center gap-2 text-fg/40">
                  <Icon name="cpu" size={34} strokeWidth={1.5} />
                  <span className="font-mono-timecode text-[10px] uppercase tracking-[0.2em]">Idle</span>
                </span>
              )}
            </RadialGauge>
          </div>
          <p className="relative mt-8 max-w-xs text-center text-sm text-fg/50">
            {isReady
              ? "Voice learned and videos indexed. Review the persona next."
              : isError
              ? "The run stopped before finishing — nothing was published."
              : showStartForm
              ? "Pick a source to start. Progress streams here live."
              : "Training runs on the AI service — you can watch every stage."}
          </p>
        </div>
      </div>
      <StageHandoff
        done={isReady}
        doneTitle="Knowledge base ready"
        doneBody={
          status && status.videos_total > 0
            ? `${status.videos_total} video${status.videos_total === 1 ? "" : "s"} transcribed, learned and indexed.`
            : "Videos transcribed, learned and indexed."
        }
        pendingHint={showStartForm ? "Choose a source to start training." : isError ? "Training stopped — start again above." : "Training is running — this panel updates live."}
        nextHref="/dashboard/review"
        nextLabel="Continue to Persona"
      />
    </AppShell>
  );
}

TrainStep.getLayout = withStudio;
