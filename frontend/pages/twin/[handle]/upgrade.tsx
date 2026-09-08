import { useRouter } from "next/router";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function UpgradeStep() {
  const router = useRouter();
  const { handle } = router.query as { handle?: string };

  return (
    <div className="min-h-screen relative overflow-hidden bg-ink-950 flex flex-col">
      {/* Premium/gold-leaning glow, distinguishing this as the "upgrade"
          moment from the more coral-dominant earlier steps. */}
      <div className="bg-orb-a pointer-events-none absolute left-1/2 -translate-x-1/2 top-[5%] h-[560px] w-[560px] rounded-full opacity-40 blur-[130px]" style={{ background: "radial-gradient(circle, #D9A441 0%, transparent 70%)" }} />
      <div className="bg-orb-b pointer-events-none absolute right-[-15%] bottom-[10%] h-[420px] w-[420px] rounded-full opacity-30 blur-[110px]" style={{ background: "radial-gradient(circle, #C22A2A 0%, transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />

      <nav className="relative flex items-center px-8 py-6">
        <Link href="/home"><Logo dark /></Link>
      </nav>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        <span className="font-mono-timecode text-xs tracking-[0.25em] text-cited-400 mb-4">STEP 4 OF 4 &middot; UPGRADE</span>
        <h1 className="font-display text-5xl sm:text-6xl font-bold text-paper-100 mb-3">Keep chatting</h1>
        <p className="text-lg text-paper-300 mb-12 max-w-md">Or unlock deeper access with Twin+.</p>

        <div className="w-full max-w-md">
          <div className="glass-panel rounded-2xl border border-white/15 bg-white/10 p-6 flex flex-col items-center gap-4">
            <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-paper-100 max-w-xs font-serif">
              Best camera for vlogging?
            </div>
            <div className="rounded-xl bg-gradient-to-br from-rec-500 to-rec-600 px-4 py-3 text-sm text-white max-w-xs font-serif shadow-lg shadow-rec-500/30">
              The Sony ZV-1 II — I used it in my March vlog. <span className="opacity-80">▶ 12:45 cited</span>
            </div>
            <button className="mt-2 rounded-full bg-gradient-to-r from-cited-500 to-cited-400 px-6 py-3 text-sm font-semibold text-ink-950 shadow-lg shadow-cited-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all">
              Unlock more with Twin+
            </button>
          </div>

          <p className="mt-6 text-sm text-paper-300">
            One tap on the description link takes the viewer straight from the video to the twin&apos;s own
            chat page — no widget, no install.
          </p>
        </div>

        <div className="mt-10 flex items-center gap-4">
          <button onClick={() => router.push(`/twin/${handle}/chat`)} className="glass-pill rounded-full border border-white/15 px-6 py-2.5 text-sm text-paper-300 hover:bg-white/10 transition-colors">
            ← Back to live chat
          </button>
        </div>
      </div>
    </div>
  );
}
