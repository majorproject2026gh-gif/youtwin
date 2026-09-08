import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Script from "next/script";
import { api, authHeader } from "@/lib/api";
import StepHeader from "@/components/StepHeader";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const STEP_LABELS = ["Prompt", "Generate", "Preview", "Upload"];

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
      setStartError(err?.response?.data?.error ?? "Couldn't start generation. Try again.");
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

  return (
    <StepHeader
      title="Create a video"
      subtitle="Describe it, generate it, upload it if you like it"
      step={currentStep}
      totalSteps={4}
      stepLabels={STEP_LABELS}
      backHref="/dashboard/connect"
    >
      {GOOGLE_CLIENT_ID && (
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGsiReady(true)} />
      )}

      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-700">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A creator explaining a camera setup in a bright studio"
            rows={3}
            className="w-full rounded-lg border border-paper-300 px-3 py-2.5 text-sm transition-all focus:border-rec-500 focus:outline-none focus:ring-2 focus:ring-rec-500/15"
          />
          <p className="mt-1 text-[11px] text-ink-300">
            Short, concrete prompts work best — open text-to-video models produce a few seconds of
            footage, not a full scene.
          </p>
        </div>

        <button
          onClick={generate}
          disabled={starting || prompt.trim().length < 3 || job?.status === "processing" || job?.status === "starting"}
          className="rounded-full bg-rec-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rec-500/25 hover:bg-rec-600 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all"
        >
          {starting ? "Starting…" : job?.status === "processing" ? "Generating…" : "Generate video"}
        </button>
        {startError && <p className="text-xs text-rec-500">{startError}</p>}

        {job && (job.status === "starting" || job.status === "processing") && (
          <div className="flex items-center gap-3 rounded-lg border border-paper-300 bg-paper-200 px-4 py-3">
            <div className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-paper-300 border-t-rec-500" />
            <p className="text-xs text-ink-500">Generating your clip — this usually takes 30s to 2 minutes.</p>
          </div>
        )}

        {job?.status === "failed" && (
          <p className="rounded bg-rec-500/10 px-3 py-2 text-xs text-rec-500">
            {job.error ?? "Generation failed. Try a different prompt."}
          </p>
        )}

        {job?.status === "succeeded" && job.video_url && (
          <div className="rounded-lg border border-paper-300 bg-white p-4">
            <video src={job.video_url} controls className="w-full rounded-lg bg-black" />
            <p className="mt-2 text-xs text-ink-500">If you like it, upload it straight to your channel.</p>

            {!uploadedVideoId ? (
              <button
                onClick={uploadToChannel}
                disabled={uploading || !gsiReady}
                className="mt-3 w-full rounded-full bg-cited-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cited-400 disabled:opacity-50 transition-all"
              >
                {uploading ? "Uploading…" : "Upload to my channel"}
              </button>
            ) : (
              <div className="mt-3 rounded-lg bg-verified-500/10 px-4 py-3 text-sm text-ink-900">
                ✓ Uploaded as a private video.{" "}
                <a
                  href={`https://youtube.com/watch?v=${uploadedVideoId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-rec-500 underline"
                >
                  View on YouTube
                </a>
              </div>
            )}
            {uploadError && <p className="mt-2 text-xs text-rec-500">{uploadError}</p>}
          </div>
        )}
      </div>
    </StepHeader>
  );
}
