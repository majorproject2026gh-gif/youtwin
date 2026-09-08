import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { api, authHeader, IngestStatus, logout } from "@/lib/api";
import Logo from "@/components/Logo";

const STAGE_LABELS: Record<string, string> = {
  queued: "Queued…",
  fetching_captions: "Fetching captions",
  transcribing_audio: "Transcribing audio",
  extracting_style: "Learning the voice",
  embedding: "Indexing the channel's videos",
  ready: "Ready",
  error: "Something went wrong",
};

/**
 * The Train step is deliberately NOT built on the shared StepHeader
 * wizard template — this is the single moment in the whole flow with
 * real, dramatic state to show (a model actually training), so it gets
 * its own full-page, high-graphics presentation instead of living in a
 * small card in a sidebar layout. Every bit of the underlying logic
 * (polling, error recovery, direct-video-vs-channel detection) is
 * unchanged from the previous version — only the presentation differs.
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

  function resetTraining() {
    if (pollRef.current) clearInterval(pollRef.current);
    localStorage.removeItem("youtwin_twinId");
    setTwinId(null);
    setStatus(null);
    setStartError(null);
  }

  function isDirectVideoUrl(input: string): boolean {
    return /(?:watch\?v=|youtu\.be\/)/.test(input);
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
      setStartError(err?.response?.data?.error ?? "Couldn't start training. Is the backend running?");
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
  const showWaiting = !!twinId && !status;
  const isError = status?.stage === "error";
  const isReady = status?.stage === "ready";
  const showProgress = !!twinId && !!status && !isReady && !isError;
  const percent = status?.percent ?? 0;

  const ringColor = isError ? "#C22A2A" : isReady ? "#10B981" : "#FF8266";

  return (
    <div className="min-h-screen relative overflow-hidden bg-ink-950 flex flex-col">
      {/* Full-bleed animated backdrop — same living-glass system as
          login, but centered entirely around the training core visual. */}
      <div
        className="bg-orb-a pointer-events-none absolute -left-32 top-[15%] h-[520px] w-[520px] rounded-full opacity-40 blur-[120px]"
        style={{ background: `radial-gradient(circle, ${ringColor} 0%, transparent 70%)` }}
      />
      <div
        className="bg-orb-b pointer-events-none absolute right-[-20%] bottom-[10%] h-[480px] w-[480px] rounded-full opacity-30 blur-[120px]"
        style={{ background: "radial-gradient(circle, #D9A441 0%, transparent 70%)" }}
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
        <button
          onClick={async () => { await logout(); router.push("/login"); }}
          className="glass-pill rounded-full border border-white/15 px-4 py-2 text-xs text-paper-300 hover:bg-white/10 transition-colors"
        >
          Log out
        </button>
      </nav>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        <span className="font-mono-timecode text-xs tracking-[0.25em] text-paper-300 mb-4">
          STEP 2 OF 4 &middot; TRAINING
        </span>
        <h1 className="font-display text-5xl sm:text-6xl font-bold text-paper-100 mb-3">
          Your twin trains itself
        </h1>
        <p className="text-lg text-paper-300 mb-12 max-w-md">
          Ingests videos, learns the voice — watch it happen in real time.
        </p>

        {/* The training core — a large glowing ring, the visual anchor
            of the whole page instead of a small progress bar in a card */}
        <div className="relative flex items-center justify-center mb-10">
          <div
            className="absolute h-64 w-64 rounded-full blur-[60px] opacity-40 transition-colors duration-700"
            style={{ background: ringColor }}
          />
          <svg width="220" height="220" viewBox="0 0 220 220" className="relative">
            <circle cx="110" cy="110" r="96" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
            <circle
              cx="110" cy="110" r="96" fill="none" stroke={ringColor} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 96}
              strokeDashoffset={2 * Math.PI * 96 * (1 - (isReady ? 1 : isError ? 1 : percent / 100))}
              transform="rotate(-90 110 110)"
              style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.5s ease" }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            {isReady ? (
              <span className="text-5xl">✓</span>
            ) : isError ? (
              <span className="text-5xl text-rec-500">!</span>
            ) : showWaiting ? (
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/20 border-t-coral-400" />
            ) : (
              <span className="font-display text-4xl font-bold text-paper-100">{percent}%</span>
            )}
          </div>
        </div>

        <div className="w-full max-w-md">
          {showStartForm && (
            <div className="glass-panel rounded-2xl border border-white/15 bg-white/10 p-6 flex flex-col gap-3">
                <input
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="Paste a video URL, channel URL, @handle, or ID (optional)"
                  className="rounded-lg border border-white/15 bg-black/20 px-4 py-3 text-sm text-paper-100 placeholder:text-paper-300/40 outline-none focus:border-coral-400 transition-colors"
                />
                <button
                  onClick={() => startTraining(!channelId.trim())}
                  disabled={starting}
                  className="rounded-full bg-gradient-to-r from-rec-500 to-rec-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rec-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all"
                >
                  {starting ? "Starting…" : channelId.trim() ? (isDirectVideoUrl(channelId.trim()) ? "Ingest this video" : "Ingest my channel") : "Load sample creator"}
                </button>
                <p className="text-xs text-paper-300/70">
                  {!channelId.trim()
                    ? "Leave blank to train on bundled sample data — no YouTube access needed."
                    : isDirectVideoUrl(channelId.trim())
                    ? "Trains only on this specific video — other videos on the channel are ignored."
                    : "Trains on up to 6 recent videos from this channel."}
                </p>
                {startError && <p className="text-sm text-rec-400">{startError}</p>}
              </div>
          )}

          {showWaiting && <p className="text-paper-300">Starting up…</p>}

          {showProgress && status && (
            <div>
              <p className="text-lg text-paper-100 font-medium">{STAGE_LABELS[status.stage] ?? status.stage}</p>
              {status.videos_total > 0 && (
                <p className="font-mono-timecode text-xs text-paper-300 mt-1">
                  {status.videos_processed}/{status.videos_total} videos
                </p>
              )}
            </div>
          )}

          {isError && status && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-lg font-medium text-paper-100">Training didn&apos;t finish</p>
              <p className="text-sm leading-relaxed text-rec-400 max-w-sm">{status.detail}</p>
              <button
                onClick={resetTraining}
                className="rounded-full bg-gradient-to-r from-rec-500 to-rec-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rec-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Try again
              </button>
            </div>
          )}

          {isReady && status && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-lg font-medium text-paper-100">Twin trained</p>
              {status.detail && <p className="text-sm text-paper-300 max-w-sm">{status.detail}</p>}
            </div>
          )}

          {!showStartForm && !isError && (
            <button
              onClick={resetTraining}
              className="mt-4 text-sm text-paper-300 underline hover:text-paper-100 transition-colors"
            >
              Start over
            </button>
          )}
        </div>

        <div className="mt-14 flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard/connect")}
            className="glass-pill rounded-full border border-white/15 px-6 py-2.5 text-sm text-paper-300 hover:bg-white/10 transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={() => router.push("/dashboard/review")}
            disabled={!isReady}
            className="rounded-full bg-gradient-to-r from-rec-500 to-rec-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rec-500/30 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 transition-all"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
