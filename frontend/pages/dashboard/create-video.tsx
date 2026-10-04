import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Script from "next/script";
import { errorMessage } from "@/lib/browser";
import { api, authHeader } from "@/lib/api";
import AppShell, { withAppFrame } from "@/components/AppShell";
import { Alert, Icon, PageHeader, RadialGauge, Spinner, Stepper } from "@/components/ui";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const STEP_LABELS = ["Prompt", "Generate", "Preview", "Upload"];
const PROMPT_IDEAS = [
  "A creator explaining a camera setup in a bright studio",
  "Slow dolly shot across a tidy desk with a microphone",
  "Close-up of hands typing code at night, neon glow",
];

declare global {
  interface Window {
    google?: any;
  }
}

type JobStatus = "starting" | "processing" | "succeeded" | "failed";

interface VideoJob {
  job_id: string;
  prompt: string;
  status: JobStatus;
  video_url?: string | null;
  error?: string | null;
}

/**
 * Builds a raw multipart/related request body for the YouTube Data API's
 * resumable-alternative "multipart" upload — this is what lets the
 * upload happen directly from the browser using a short-lived OAuth
 * token, without piping the video binary through our own backend.
 */
async function buildMultipartBody(metadata: object, videoBlob: Blob): Promise<{ body: Blob; boundary: string }> {
  const boundary = "youtwin_upload_boundary_" + Math.random().toString(36).slice(2);
  const metadataPart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`;
  const closingPart = `\r\n--${boundary}--`;
  const body = new Blob([metadataPart, videoBlob, closingPart]);
  return { body, boundary };
}

export default function CreateVideoStep() {
  const router = useRouter();
  const [session, setSession] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [job, setJob] = useState<VideoJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [gsiReady, setGsiReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const s = localStorage.getItem("youtwin_session");
    if (!s) {
      router.replace("/dashboard/connect");
      return;
    }
    setSession(s);
  }, [router]);

  async function generate() {
    if (!session || starting || prompt.trim().length < 3) return;
    setStartError(null);
    setStarting(true);
    setUploadedVideoId(null);
    setUploadError(null);
    try {
      const { data } = await api.post("/video/generate", { prompt: prompt.trim() }, { headers: authHeader(session) });
      setJob(data);
    } catch (err: any) {
      setStartError(errorMessage(err, "Couldn't start generation. Try again."));
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    if (!job || !session || job.status === "succeeded" || job.status === "failed") return;
    let missCount = 0;
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/video/status/${job.job_id}`, { headers: authHeader(session) });
        missCount = 0;
        setJob(data);
        if (data.status === "succeeded" || data.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // A 404 here almost always means the ai-service process
        // restarted mid-job (e.g. --reload triggered by a file save)
        // and lost its in-memory job state. Give it a few retries for
        // a genuinely transient miss, then surface a real error
        // instead of polling forever with the UI silently stuck.
        missCount += 1;
        if (missCount >= 5) {
          if (pollRef.current) clearInterval(pollRef.current);
          setJob({
            job_id: job.job_id,
            prompt: job.prompt,
            status: "failed",
            error:
              "Lost track of this generation — the AI service likely restarted mid-job. Try again.",
          });
        }
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [job, session]);

  /**
   * Requests a fresh OAuth token scoped specifically for uploading (not
   * the read-only scope used for channel authorization), fetches the
   * generated video, and uploads it directly to the creator's channel
   * from the browser.
   */
  function uploadToChannel() {
    if (!job?.video_url || !window.google?.accounts?.oauth2 || !GOOGLE_CLIENT_ID) {
      setUploadError("Google upload isn't ready yet — try again in a moment.");
      return;
    }
    setUploadError(null);
    setUploading(true);

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/youtube.upload",
      callback: async (tokenResponse: { access_token?: string }) => {
        if (!tokenResponse?.access_token) {
          setUploading(false);
          setUploadError("Couldn't get upload permission. Try again.");
          return;
        }
        try {
          const videoRes = await fetch(job.video_url!);
          const videoBlob = await videoRes.blob();

          const metadata = {
            snippet: {
              title: job.prompt.slice(0, 90) || "Generated with YouTwin",
              description: `Generated by YouTwin's video agent from the prompt: "${job.prompt}"`,
              categoryId: "22",
            },
            status: { privacyStatus: "private" },
          };
          const { body, boundary } = await buildMultipartBody(metadata, videoBlob);

          const uploadRes = await fetch(
            "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${tokenResponse.access_token}`,
                "Content-Type": `multipart/related; boundary=${boundary}`,
              },
              body,
            }
          );
          const uploadJson = await uploadRes.json();
          if (!uploadRes.ok) {
            throw new Error(uploadJson?.error?.message ?? "Upload rejected by YouTube.");
          }
          setUploadedVideoId(uploadJson.id);
        } catch (err: any) {
          setUploadError(err?.message ?? "Upload failed. Try again.");
        } finally {
          setUploading(false);
        }
      },
      error_callback: () => {
        setUploading(false);
        setUploadError("Upload permission popup was blocked or closed. Try again.");
      },
    });
    tokenClient.requestAccessToken();
  }

  const currentStep = uploadedVideoId ? 4 : job?.status === "succeeded" ? 3 : job ? 2 : 1;
  const isProcessing = job?.status === "starting" || job?.status === "processing";
  const isError = job?.status === "failed";
  const isReady = job?.status === "succeeded";
  const ringColor = isError ? "#C22A2A" : isReady ? "#10B981" : "#FF8266";

  return (
    <AppShell title="Video Studio" accent={ringColor} accent2="#E0AE4E" wide>
      {GOOGLE_CLIENT_ID && (
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGsiReady(true)} />
      )}

      <PageHeader
        eyebrow={`Step ${currentStep} of 4 · Create video`}
        eyebrowTone="gold"
        title={<>Create a video <span className="ml-1 align-middle rounded-lg bg-gradient-to-r from-coral-400/20 to-cited-400/20 px-2 py-1 font-mono-timecode text-xs font-medium text-cited-300 ring-1 ring-cited-400/30">AI</span></>}
        description="Describe it, generate it, upload it if you like it."
        actions={
          <button onClick={() => router.push("/dashboard/connect")} className="btn btn-secondary">
            <Icon name="arrow-left" size={15} /> Back
          </button>
        }
      />
      <Stepper steps={STEP_LABELS} current={currentStep} className="mt-8 flex-wrap animate-fade-up" />

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        {/* Controls */}
        <div className="surface flex flex-col p-6 sm:p-7 animate-fade-up" style={{ animationDelay: "60ms" }}>
          {!job && (
            <div className="flex flex-col gap-5">
              <div>
                <div className="flex items-center justify-between">
                  <label className="label !mb-0" htmlFor="prompt">Prompt</label>
                  <span className={`font-mono-timecode text-[11px] ${prompt.length > 180 ? "text-cited-300" : "text-fg/35"}`}>{prompt.length} chars</span>
                </div>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A creator explaining a camera setup in a bright studio"
                  rows={5}
                  className="field mt-2"
                />
                <p className="mt-2 text-xs leading-relaxed text-fg/45">
                  Short, concrete prompts work best — open text-to-video models produce a few seconds of footage, not a full scene.
                </p>
              </div>

              <div>
                <p className="mb-2 font-mono-timecode text-[10px] uppercase tracking-[0.16em] text-fg/35">Try an idea</p>
                <div className="flex flex-col gap-1.5">
                  {PROMPT_IDEAS.map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      onClick={() => setPrompt(idea)}
                      className="group flex items-center gap-2.5 rounded-lg border border-tint/[0.06] bg-tint/[0.02] px-3 py-2 text-left text-[13px] text-fg/60 transition-all hover:border-coral-400/30 hover:bg-coral-400/[0.05] hover:text-fg"
                    >
                      <Icon name="wand" size={14} className="text-fg/30 group-hover:text-coral-400" />
                      <span className="truncate">{idea}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={generate} disabled={starting || prompt.trim().length < 3} className="btn btn-primary btn-lg w-full">
                {starting ? <><Spinner size={16} /> Starting…</> : <><Icon name="sparkles" size={16} /> Generate video</>}
              </button>
              {startError && <Alert>{startError}</Alert>}
            </div>
          )}

          {isProcessing && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral-400/15 text-coral-300 ring-1 ring-coral-400/30"><Spinner size={18} /></span>
                <div>
                  <p className="font-display text-lg font-semibold text-fg">Generating your clip</p>
                  <p className="text-sm text-fg/50">Usually takes 30 seconds to 2 minutes, depending on load.</p>
                </div>
              </div>
              <div className="rounded-xl border border-tint/[0.07] bg-tint/[0.03] p-3.5">
                <p className="font-mono-timecode text-[10px] uppercase tracking-[0.16em] text-fg/35">Prompt</p>
                <p className="mt-1 text-sm text-fg/80">&ldquo;{job?.prompt}&rdquo;</p>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-tint/[0.06]">
                <div className="skeleton h-full w-full !rounded-full !bg-coral-400/30" />
              </div>
            </div>
          )}

          {isError && job && (
            <div className="flex flex-col items-start gap-4">
              <p className="font-display text-lg font-semibold text-fg">Generation didn&apos;t finish</p>
              <Alert>{job.error ?? "Something went wrong. Try a different prompt."}</Alert>
              <button onClick={() => { setJob(null); setStartError(null); }} className="btn btn-primary">
                <Icon name="refresh" size={15} /> Try again
              </button>
            </div>
          )}

          {isReady && job && !uploadedVideoId && (
            <div className="flex flex-col items-start gap-4">
              <Alert tone="success">Clip ready</Alert>
              <p className="text-sm text-fg/60">If you like it, upload it straight to your channel — right there on this page.</p>
              <button onClick={uploadToChannel} disabled={uploading || !gsiReady} className="btn btn-gold btn-lg w-full">
                {uploading ? <><Spinner size={16} /> Uploading…</> : <><Icon name="upload" size={16} /> Upload to my channel</>}
              </button>
              <p className="flex items-center gap-1.5 text-xs text-fg/40"><Icon name="lock" size={12} /> Uploads as a private video — you choose when to publish.</p>
              {uploadError && <Alert>{uploadError}</Alert>}
              <button onClick={() => { setJob(null); setPrompt(""); setUploadError(null); }} className="btn btn-ghost btn-sm">
                <Icon name="refresh" size={14} /> Start a new clip instead
              </button>
            </div>
          )}

          {uploadedVideoId && (
            <div className="flex flex-col items-start gap-4">
              <Alert tone="success">Uploaded as a private video</Alert>
              <a href={`https://youtube.com/watch?v=${uploadedVideoId}`} target="_blank" rel="noreferrer" className="btn btn-secondary">
                <Icon name="youtube" size={16} className="text-[#FF3B30]" /> View on YouTube <Icon name="arrow-up-right" size={14} />
              </a>
              <button onClick={() => { setJob(null); setPrompt(""); setUploadedVideoId(null); }} className="btn btn-ghost btn-sm">
                <Icon name="plus" size={14} /> Create another clip
              </button>
            </div>
          )}
        </div>

        {/* Monitor */}
        <div className="surface-solid self-start overflow-hidden p-2 animate-fade-up lg:sticky lg:top-24" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center justify-between px-3 py-2 text-[11px] text-fg/45">
            <span className="flex items-center gap-2 font-mono-timecode uppercase tracking-[0.16em]">
              <span className={`h-1.5 w-1.5 rounded-full ${isProcessing ? "bg-coral-400 animate-pulse" : isReady ? "bg-verified-500" : isError ? "bg-rec-400" : "bg-fg/30"}`} />
              {isProcessing ? "Rendering" : isReady ? "Preview" : isError ? "Failed" : "Monitor"}
            </span>
            <span className="font-mono-timecode">16:9 · MP4</span>
          </div>
          <div className="force-dark relative aspect-video overflow-hidden rounded-xl bg-[#08080A]">
            {isReady && job?.video_url ? (
              <video src={job.video_url} controls autoPlay loop muted className="h-full w-full bg-black object-contain" />
            ) : (
              <>
                <div
                  className="absolute inset-0 transition-all duration-1000"
                  style={{
                    background: `radial-gradient(ellipse at 50% 40%, ${ringColor}33, transparent 60%), linear-gradient(135deg,#121216,#08080a)`,
                  }}
                />
                <div className="absolute inset-0 bg-grid opacity-70" />
                {/* frame guides */}
                <div className="absolute inset-6 rounded-lg border border-tint/[0.06]" />
                {["left-4 top-4 border-l border-t", "right-4 top-4 border-r border-t", "left-4 bottom-4 border-l border-b", "right-4 bottom-4 border-r border-b"].map((c) => (
                  <span key={c} className={`absolute h-5 w-5 border-tint/30 ${c}`} />
                ))}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {isProcessing ? (
                    <RadialGauge value={0} indeterminate color={ringColor} size={150} stroke={8} halo>
                      <Icon name="film" size={30} className="text-fg/80" />
                    </RadialGauge>
                  ) : isError ? (
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rec-500/20 text-rec-300 ring-1 ring-rec-500/40">
                      <Icon name="alert" size={28} />
                    </span>
                  ) : (
                    <div className="flex flex-col items-center text-center">
                      <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-tint/10 bg-white/[0.04] text-fg/70 shadow-lift animate-float">
                        <Icon name="film" size={28} strokeWidth={1.5} />
                      </span>
                      <p className="mt-4 max-w-xs px-6 text-sm text-fg/45">
                        {prompt.trim() ? <>&ldquo;{prompt.trim().slice(0, 90)}{prompt.trim().length > 90 ? "…" : ""}&rdquo;</> : "Your generated clip will appear here."}
                      </p>
                    </div>
                  )}
                </div>
                {isProcessing && <div className="skeleton absolute inset-x-0 bottom-0 h-1 !rounded-none !bg-coral-400/20" />}
              </>
            )}
          </div>
          {isReady && job && (
            <p className="truncate px-3 py-3 text-center font-mono-timecode text-xs text-fg/45">&ldquo;{job.prompt}&rdquo;</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

CreateVideoStep.getLayout = withAppFrame;
