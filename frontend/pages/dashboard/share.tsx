import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { logout } from "@/lib/api";
import Logo from "@/components/Logo";

type Creator = { id: string; displayName: string; handle: string };

export default function ShareStep() {
  const router = useRouter();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("youtwin_twinId");
    const c = localStorage.getItem("youtwin_creator");
    if (!t || !c) {
      router.replace("/dashboard/train");
      return;
    }
    setCreator(JSON.parse(c));
  }, [router]);

  const shareUrl = creator ? `youtwin.ai/${creator.handle}` : "";

  return (
    <div className="min-h-screen relative overflow-hidden bg-ink-950 flex flex-col">
      {/* The finish line — a celebratory glow, brighter and warmer than
          the other steps, since this is the moment the twin actually
          goes live. */}
      <div className="bg-orb-a pointer-events-none absolute left-1/2 -translate-x-1/2 top-[5%] h-[600px] w-[600px] rounded-full opacity-45 blur-[130px]" style={{ background: "radial-gradient(circle, #10B981 0%, transparent 70%)" }} />
      <div className="bg-orb-b pointer-events-none absolute -left-20 bottom-[0%] h-[420px] w-[420px] rounded-full opacity-30 blur-[110px]" style={{ background: "radial-gradient(circle, #D9A441 0%, transparent 70%)" }} />
      <div className="bg-orb-a pointer-events-none absolute right-[-10%] bottom-[10%] h-[420px] w-[420px] rounded-full opacity-25 blur-[110px]" style={{ background: "radial-gradient(circle, #C22A2A 0%, transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />

      <nav className="relative flex items-center justify-between px-8 py-6">
        <Link href="/home"><Logo dark /></Link>
        <button onClick={async () => { await logout(); router.push("/login"); }} className="glass-pill rounded-full border border-white/15 px-4 py-2 text-xs text-paper-300 hover:bg-white/10 transition-colors">
          Log out
        </button>
      </nav>

      <div className="relative flex-1 flex flex-col items-center px-6 py-10 text-center">
        <span className="font-mono-timecode text-xs tracking-[0.25em] text-verified-500 mb-4">STEP 4 OF 4 &middot; LIVE</span>
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-verified-500/15 border border-verified-500/40 text-4xl mb-6">
          🎉
        </div>
        <h1 className="font-display text-5xl sm:text-6xl font-bold text-paper-100 mb-3">Your twin is live</h1>
        <p className="text-lg text-paper-300 mb-10 max-w-md">
          Paste this into your video description — no embedding, no code.
        </p>

        <div className="w-full max-w-lg">
          <div className="glass-panel rounded-2xl border border-white/15 bg-white/10 p-6 flex flex-col gap-4 text-left">
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 rounded-lg border border-white/15 bg-black/25 px-4 py-3 text-sm text-paper-100 font-mono-timecode"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="flex-shrink-0 rounded-lg bg-gradient-to-r from-rec-500 to-rec-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rec-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-5 py-4 text-sm text-paper-300">
              <p className="text-xs uppercase tracking-wide text-paper-300/60 font-mono-timecode mb-1.5">▶ Description preview</p>
              <p className="text-cited-400 underline truncate">Chat with my AI twin — {shareUrl}</p>
            </div>
          </div>

          {creator && (
            <p className="mt-6 text-sm text-paper-300">
              Preview it yourself:{" "}
              <a className="text-coral-400 underline hover:text-coral-500" href={`/twin/${creator.handle}`} target="_blank" rel="noreferrer">
                walk through the viewer experience →
              </a>
            </p>
          )}
        </div>

        <div className="mt-10 flex items-center gap-4">
          <button onClick={() => router.push("/dashboard/review")} className="glass-pill rounded-full border border-white/15 px-6 py-2.5 text-sm text-paper-300 hover:bg-white/10 transition-colors">
            ← Back
          </button>
          <Link
            href="/home"
            className="rounded-full bg-gradient-to-r from-verified-500 to-emerald-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-verified-500/30 hover:scale-[1.03] active:scale-[0.98] transition-all"
          >
            Done →
          </Link>
        </div>
      </div>
    </div>
  );
}
