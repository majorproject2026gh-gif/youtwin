import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { api } from "@/lib/api";
import Logo from "@/components/Logo";

export default function OpenStep() {
  const router = useRouter();
  const { handle } = router.query as { handle?: string };
  const [creatorName, setCreatorName] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!handle) return;
    api
      .get(`/twins/by-handle/${handle}`)
      .then(({ data }) => {
        setCreatorName(data.creatorName);
        setReady(true);
      })
      .catch(() => setReady(false));
  }, [handle]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-ink-950 flex flex-col">
      <div className="bg-orb-a pointer-events-none absolute left-1/2 -translate-x-1/2 top-[10%] h-[560px] w-[560px] rounded-full opacity-40 blur-[130px]" style={{ background: "radial-gradient(circle, #FF8266 0%, transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />

      <nav className="relative flex items-center px-8 py-6">
        <Link href="/home"><Logo dark /></Link>
      </nav>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        <span className="font-mono-timecode text-xs tracking-[0.25em] text-paper-300 mb-4">STEP 2 OF 4 &middot; OPENING</span>
        <h1 className="font-display text-5xl sm:text-6xl font-bold text-paper-100 mb-3">The twin page opens</h1>
        <p className="text-lg text-paper-300 mb-12 max-w-md">Hosted on youtwin.ai — no download.</p>

        <div className="relative flex items-center justify-center mb-10">
          <div className="absolute h-56 w-56 rounded-full blur-[60px] opacity-40" style={{ background: ready ? "#10B981" : "#FF8266" }} />
          <div className={`relative h-24 w-24 rounded-full border-2 flex items-center justify-center transition-colors duration-500 ${ready ? "border-verified-500" : "border-white/20"}`}>
            {ready ? <span className="text-3xl">✓</span> : <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/20 border-t-coral-400" />}
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="glass-panel rounded-2xl border border-white/15 bg-white/10 p-6">
            <p className="text-sm font-medium text-cited-400 mb-3">{creatorName ? `${creatorName}'s Twin` : "Loading twin…"}</p>
            <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-left">
              <p className="font-serif text-paper-100">Hi! Ask me anything from my videos.</p>
            </div>
          </div>
        </div>

        <div className="mt-14 flex items-center gap-4">
          <button onClick={() => router.push(`/twin/${handle}`)} className="glass-pill rounded-full border border-white/15 px-6 py-2.5 text-sm text-paper-300 hover:bg-white/10 transition-colors">
            ← Back
          </button>
          <button
            onClick={() => router.push(`/twin/${handle}/chat`)}
            disabled={!ready}
            className="rounded-full bg-gradient-to-r from-rec-500 to-rec-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rec-500/30 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 transition-all"
          >
            Start chatting →
          </button>
        </div>
      </div>
    </div>
  );
}
