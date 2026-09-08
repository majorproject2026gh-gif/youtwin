import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { api, authHeader, logout } from "@/lib/api";
import Logo from "@/components/Logo";

interface Analytics {
  totalConversations: number;
  groundedCount: number;
  refusedCount: number;
  groundedRate: number;
  avgConfidence: number;
  topQuestions: { content: string; count: number }[];
  dailyCounts: { date: string; count: number }[];
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [session, setSession] = useState<string | null>(null);
  const [twinId, setTwinId] = useState<string | null>(null);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = localStorage.getItem("youtwin_session");
    const t = localStorage.getItem("youtwin_twinId");
    if (!s) {
      router.replace("/dashboard/connect");
      return;
    }
    if (!t) {
      router.replace("/dashboard/train");
      return;
    }
    setSession(s);
    setTwinId(t);
  }, [router]);

  useEffect(() => {
    if (!session || !twinId) return;
    api
      .get(`/twins/${twinId}/analytics`, { headers: authHeader(session) })
      .then(({ data }) => setData(data))
      .catch((err) => setError(err?.response?.data?.error ?? "Couldn't load analytics."))
      .finally(() => setLoading(false));
  }, [session, twinId]);

  const maxDaily = data ? Math.max(1, ...data.dailyCounts.map((d) => d.count)) : 1;
  const groundedPct = data ? Math.round(data.groundedRate * 100) : 0;

  return (
    <div className="min-h-screen relative overflow-hidden bg-ink-950 flex flex-col">
      <div className="bg-orb-a pointer-events-none absolute -left-32 top-[10%] h-[520px] w-[520px] rounded-full opacity-35 blur-[120px]" style={{ background: "radial-gradient(circle, #5EEAD4 0%, transparent 70%)" }} />
      <div className="bg-orb-b pointer-events-none absolute right-[-20%] bottom-[5%] h-[480px] w-[480px] rounded-full opacity-30 blur-[120px]" style={{ background: "radial-gradient(circle, #10B981 0%, transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />

      <nav className="relative flex items-center justify-between px-8 py-6">
        <Link href="/home"><Logo dark /></Link>
        <button onClick={async () => { await logout(); router.push("/login"); }} className="glass-pill rounded-full border border-white/15 px-4 py-2 text-xs text-paper-300 hover:bg-white/10 transition-colors">
          Log out
        </button>
      </nav>

      <div className="relative flex-1 flex flex-col items-center px-6 py-10 text-center">
        <span className="font-mono-timecode text-xs tracking-[0.25em] text-verified-500 mb-4">REAL INSIGHT &middot; LIVE DATA</span>
        <h1 className="font-display text-5xl sm:text-6xl font-bold text-paper-100 mb-3">Analytics</h1>
        <p className="text-lg text-paper-300 mb-10 max-w-md">Real insight from every conversation your twin has had.</p>

        {loading && <p className="text-paper-300">Loading…</p>}
        {error && <p className="text-rec-400">{error}</p>}

        {data && (
          <div className="w-full max-w-2xl flex flex-col gap-6">
            {/* Grounded-rate gauge as the central visual — the single
                most important number on this page */}
            <div className="flex justify-center mb-2">
              <div className="relative flex items-center justify-center h-40 w-40">
                <div className="absolute h-48 w-48 rounded-full blur-[50px] opacity-40" style={{ background: "#10B981" }} />
                <svg width="160" height="160" viewBox="0 0 160 160" className="relative">
                  <circle cx="80" cy="80" r="68" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                  <circle
                    cx="80" cy="80" r="68" fill="none" stroke="#10B981" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 68}
                    strokeDashoffset={2 * Math.PI * 68 * (1 - groundedPct / 100)}
                    transform="rotate(-90 80 80)"
                    style={{ transition: "stroke-dashoffset 0.8s ease" }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="font-display text-3xl font-bold text-paper-100">{groundedPct}%</span>
                  <span className="text-[10px] text-paper-300 font-mono-timecode">GROUNDED</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Conversations" value={data.totalConversations.toString()} />
              <Stat label="Grounded rate" value={`${groundedPct}%`} accent="verified" />
              <Stat label="Avg. confidence" value={data.avgConfidence.toFixed(2)} />
              <Stat label="Refused" value={data.refusedCount.toString()} accent="rec" />
            </div>

            <div className="glass-panel rounded-2xl border border-white/15 bg-white/10 p-6 text-left">
              <p className="text-xs font-medium text-paper-300 mb-3">Last 14 days</p>
              <div className="flex items-end gap-1.5 h-24">
                {data.dailyCounts.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 rounded-t bg-gradient-to-t from-verified-500/60 to-verified-500 min-h-[2px] transition-all"
                    style={{ height: `${Math.max(4, (d.count / maxDaily) * 100)}%` }}
                    title={`${d.date}: ${d.count}`}
                  />
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-2xl border border-white/15 bg-white/10 p-6 text-left">
              <p className="text-xs font-medium text-paper-300 mb-3">Most-asked questions</p>
              {data.topQuestions.length === 0 ? (
                <p className="text-sm text-paper-300/70">No conversations yet — share your twin to start collecting data.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data.topQuestions.map((q, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
                      <span className="text-sm text-paper-100 truncate pr-2">{q.content}</span>
                      <span className="flex-shrink-0 rounded-full bg-white/10 px-2 py-0.5 font-mono-timecode text-[10px] text-paper-300">
                        {q.count}&times;
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-10 flex items-center gap-4">
          <button onClick={() => router.push("/dashboard/connect")} className="glass-pill rounded-full border border-white/15 px-6 py-2.5 text-sm text-paper-300 hover:bg-white/10 transition-colors">
            ← Back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "verified" | "rec" }) {
  const color = accent === "verified" ? "text-verified-500" : accent === "rec" ? "text-rec-400" : "text-paper-100";
  return (
    <div className="glass-panel rounded-xl border border-white/15 bg-white/10 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wide text-paper-300/70 font-mono-timecode">{label}</p>
      <p className={`mt-0.5 font-display text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
