import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { copyText, readJSON } from "@/lib/browser";
import CreatorAvatar from "@/components/CreatorAvatar";
import { Icon, PageHeader } from "@/components/ui";
import { withStudio } from "@/components/StudioWorkspace";
import { useStudio } from "@/components/studio";

type Creator = { id: string; displayName: string; handle: string };

/** Pulls the 11-char video id and optional start time out of any common
 * YouTube URL shape (watch?v=, youtu.be/, shorts/, live/, embed/). */
function parseYouTube(input: string): { id: string; t?: number } | null {
  const raw = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return { id: raw };
  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!/(^|\.)(youtube\.com|youtu\.be)$/.test(url.hostname)) return null;
  const id =
    url.searchParams.get("v") ??
    (url.hostname.endsWith("youtu.be") ? url.pathname.slice(1) : url.pathname.match(/\/(?:shorts|live|embed)\/([^/?#]+)/)?.[1]) ??
    "";
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  const tRaw = url.searchParams.get("t") ?? url.searchParams.get("start");
  let t: number | undefined;
  if (tRaw) {
    const m = tRaw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
    if (m && (m[1] || m[2] || m[3])) t = (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + +(m[3] ?? 0);
  }
  return { id, t };
}

/** "4:50", "1:02:03" or plain seconds -> seconds. */
function parseClock(input: string): number | undefined {
  const v = input.trim();
  if (!v) return undefined;
  if (/^\d+$/.test(v)) return +v;
  const parts = v.split(":").map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return undefined;
  return parts.reduce((acc, p) => acc * 60 + +p, 0);
}

export default function ShareStep() {
  const router = useRouter();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [twinId, setTwinId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [videoInput, setVideoInput] = useState("");
  const [clockInput, setClockInput] = useState("");
  const [deepCopied, setDeepCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    const t = localStorage.getItem("youtwin_twinId");
    const c = readJSON<Creator>("youtwin_creator");
    if (!t || !c) {
      router.replace("/dashboard/train");
      return;
    }
    setTwinId(t);
    setCreator(c);
  }, [router]);

  // Tied to this specific twin's own id, not the creator's handle — a
  // link generated here keeps working for THIS video even after the
  // creator trains more twins for other videos. See resolveTwin() in
  // lib/api.ts for how both link styles resolve through the same pages.
  // The site's real address (the Vercel URL, or a custom domain once one
  // is attached) — a hard-coded youtwin.ai link would not open.
  const shareUrl = twinId && origin ? `${origin}/twin/${twinId}` : "";

  const { update: updateStudio } = useStudio();
  useEffect(() => {
    if (twinId) updateStudio({ published: true, persona: { reviewed: true } });
  }, [twinId, updateStudio]);

  // Timestamped deep link: opens the twin's chat already tied to one
  // moment of one video (answers are biased toward that part of it).
  const parsedVideo = videoInput ? parseYouTube(videoInput) : null;
  const clockSeconds = parseClock(clockInput);
  const deepSeconds = clockSeconds ?? parsedVideo?.t;
  const deepLink =
    twinId && parsedVideo && origin
      ? `${origin}/twin/${twinId}/chat?v=${parsedVideo.id}${deepSeconds !== undefined ? `&t=${deepSeconds}` : ""}`
      : "";

  function copyDeep() {
    if (!deepLink) return;
    void copyText(deepLink);
    setDeepCopied(true);
    setTimeout(() => setDeepCopied(false), 1500);
  }

  function copy() {
    void copyText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <AppShell setupStep={4} title="Share link" accent="#10B981" accent2="#E0AE4E" accent3="#C8302B">
      <div className="grid items-start gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="animate-fade-up">
          <div className="relative mb-8 inline-flex">
            <div className="absolute inset-0 rounded-3xl bg-verified-500/40 blur-2xl" />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-verified-500/40 bg-gradient-to-b from-verified-500/25 to-verified-500/5 text-verified-400 shadow-glow-green">
              <Icon name="check" size={36} strokeWidth={2.25} />
            </span>
          </div>
          <PageHeader
            eyebrow="Published"
            eyebrowTone="green"
            title={<>Your twin is <span className="font-serif italic font-normal text-verified-400">live.</span></>}
            description="Paste this into your video description — no embedding, no code."
          />
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button onClick={() => router.push("/dashboard/review")} className="btn btn-secondary">
              <Icon name="arrow-left" size={15} /> Back
            </button>
            <button
              onClick={() => {
                // Clear the active twin reference so the wizard starts a
                // genuinely fresh run for the next video, without
                // touching this twin's already-generated link above.
                localStorage.removeItem("youtwin_twinId");
                router.push(`/dashboard/train?fresh=${Date.now()}`);
              }}
              className="btn btn-secondary"
            >
              <Icon name="plus" size={15} /> Train another video
            </button>
            <Link href="/home" className="btn btn-green btn-lg">
              Done <Icon name="arrow-right" size={16} strokeWidth={2.25} />
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-4 animate-fade-up" style={{ animationDelay: "120ms" }}>
          {/* Link card */}
          <div className="surface p-6">
            <p className="label">Your twin&apos;s permanent link</p>
            <div className="flex gap-2">
              <div className="field flex min-w-0 items-center gap-2 font-mono-timecode text-sm">
                <Icon name="globe" size={15} className="text-fg/40" />
                <span className="truncate">{shareUrl}</span>
              </div>
              <button onClick={copy} className={`btn btn-lg flex-shrink-0 ${copied ? "btn-green" : "btn-primary"}`}>
                <Icon name={copied ? "check" : "copy"} size={15} strokeWidth={2.25} />
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="mt-3 text-xs text-fg/40">Tied to this twin — keeps working even after you train more twins for other videos.</p>
          </div>

          {/* Timestamped deep link */}
          <div className="surface p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="label !mb-0">Timestamped deep link</p>
              <span className="chip font-mono-timecode !text-[10px]">mobile · pinned comments</span>
            </div>
            <p className="mt-1.5 text-xs text-fg/45">Opens the chat tied to one moment of a video — answers favour that part of it.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_7.5rem]">
              <input
                className="field"
                placeholder="YouTube video URL (a ?t= time is picked up too)"
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                aria-label="YouTube video URL"
              />
              <input
                className="field font-mono-timecode"
                placeholder="4:50"
                value={clockInput}
                onChange={(e) => setClockInput(e.target.value)}
                aria-label="Timestamp"
              />
            </div>
            {videoInput && !parsedVideo && <p className="mt-2 text-xs text-rec-400">That doesn&apos;t look like a YouTube video link.</p>}
            {clockInput && clockSeconds === undefined && <p className="mt-2 text-xs text-rec-400">Use a time like 4:50 or 1:02:03.</p>}
            {deepLink && (
              <div className="mt-3 flex gap-2">
                <div className="field flex min-w-0 items-center font-mono-timecode text-xs">
                  <span className="truncate">{deepLink}</span>
                </div>
                <button onClick={copyDeep} className={`btn flex-shrink-0 ${deepCopied ? "btn-green" : "btn-secondary"}`}>
                  <Icon name={deepCopied ? "check" : "copy"} size={14} /> {deepCopied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>

          {/* YouTube description preview */}
          <div className="surface-solid overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-tint/[0.06] px-5 py-3 text-xs text-fg/45">
              <Icon name="youtube" size={15} className="text-[#FF3B30]" /> Description preview
            </div>
            <div className="flex gap-4 p-5">
              <div className="force-dark relative hidden h-20 w-36 flex-shrink-0 overflow-hidden rounded-lg bg-[radial-gradient(ellipse_at_30%_20%,rgba(242,96,63,0.5),transparent_60%),linear-gradient(135deg,#1a0f0d,#0b0b0e)] sm:block">
                <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1 font-mono-timecode text-[9px] text-white">12:45</span>
                <span className="absolute inset-0 m-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-rec-500">
                  <Icon name="play" size={12} />
                </span>
              </div>
              <div className="min-w-0 text-sm">
                <div className="flex items-center gap-2">
                  <CreatorAvatar name={creator?.displayName || "Creator"} size={22} />
                  <p className="truncate text-fg/80">{creator?.displayName ?? "Your channel"}</p>
                </div>
                <p className="mt-2 text-fg/50">Thanks for watching! Got questions about this video?</p>
                <p className="mt-1 truncate text-[#3EA6FF]">Chat with my AI twin — {shareUrl}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {twinId && (
              <a
                href={`/twin/${twinId}`}
                target="_blank"
                rel="noreferrer"
                className="surface surface-interactive group flex items-center gap-3 p-4"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-coral-400/10 text-coral-400"><Icon name="eye" size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">Preview it yourself</p>
                  <p className="text-xs text-fg/45">Walk through the viewer experience</p>
                </div>
                <Icon name="arrow-up-right" size={16} className="text-fg/35 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            )}
            <Link href="/dashboard/twins" className="surface surface-interactive group flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cited-400/10 text-cited-300"><Icon name="twins" size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">Have more videos?</p>
                <p className="text-xs text-fg/45">See all your twins</p>
              </div>
              <Icon name="arrow-right" size={16} className="text-fg/35 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

ShareStep.getLayout = withStudio;
