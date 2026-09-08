import { useRouter } from "next/router";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function FindLinkStep() {
  const router = useRouter();
  const { handle } = router.query as { handle?: string };

  return (
    <div className="min-h-screen relative overflow-hidden bg-ink-950 flex flex-col">
      <div className="bg-orb-a pointer-events-none absolute -left-32 top-[15%] h-[520px] w-[520px] rounded-full opacity-40 blur-[120px]" style={{ background: "radial-gradient(circle, #C22A2A 0%, transparent 70%)" }} />
      <div className="bg-orb-b pointer-events-none absolute right-[-20%] bottom-[10%] h-[480px] w-[480px] rounded-full opacity-30 blur-[120px]" style={{ background: "radial-gradient(circle, #D9A441 0%, transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />

      <nav className="relative flex items-center px-8 py-6">
        <Link href="/home"><Logo dark /></Link>
      </nav>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        <span className="font-mono-timecode text-xs tracking-[0.25em] text-paper-300 mb-4">STEP 1 OF 4 &middot; FIND LINK</span>
        <h1 className="font-display text-5xl sm:text-6xl font-bold text-paper-100 mb-3">Find the link in the description</h1>
        <p className="text-lg text-paper-300 mb-12 max-w-md">Under the creator&apos;s YouTube video.</p>

        <div className="w-full max-w-md">
          <div className="glass-panel rounded-2xl border border-white/15 bg-white/10 p-6 flex flex-col gap-4">
            <div className="flex h-40 items-center justify-center rounded-xl bg-black/30">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-rec-500 text-3xl shadow-lg">▶</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-paper-300">
              <div className="flex items-center gap-1"><span className="text-rec-500">▶</span> Description</div>
              <div className="mt-1 text-cited-400 underline">Chat with my AI twin</div>
            </div>
          </div>
        </div>

        <div className="mt-14 flex items-center gap-4">
          <span />
          <button
            onClick={() => router.push(`/twin/${handle}/open`)}
            className="rounded-full bg-gradient-to-r from-rec-500 to-rec-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rec-500/30 hover:scale-[1.03] active:scale-[0.98] transition-all"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
