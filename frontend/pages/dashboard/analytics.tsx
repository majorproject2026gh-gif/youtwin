import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { api, authHeader } from "@/lib/api";
import AppShell, { withAppFrame } from "@/components/AppShell";
import { errorMessage } from "@/lib/browser";
import ViewerProfiles from "@/components/ViewerProfiles";
import { Alert, AreaChart, EmptyState, Icon, PageHeader, RadialGauge, Skeleton, StatCard } from "@/components/ui";

interface Analytics {
  totalConversations: number;
  groundedCount: number;
  refusedCount: number;
  groundedRate: number;
  avgConfidence: number;
  topQuestions: { content: string; count: number }[];
  dailyCounts: { date: string; count: number }[];
}

/** Coerces whatever the API returned into a safe shape — a partial or
 * empty response used to crash the whole page (data.dailyCounts.map on
 * undefined → Next's error screen). */
function normalizeAnalytics(raw: any): Analytics {
  const n = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
  return {
    totalConversations: n(raw?.totalConversations),
    groundedCount: n(raw?.groundedCount),
    refusedCount: n(raw?.refusedCount),
    groundedRate: Math.min(1, Math.max(0, n(raw?.groundedRate))),
    avgConfidence: n(raw?.avgConfidence),
    topQuestions: Array.isArray(raw?.topQuestions)
      ? raw.topQuestions.filter((q: any) => q && typeof q.content === "string").map((q: any) => ({ content: q.content, count: n(q.count) }))
      : [],
    dailyCounts: Array.isArray(raw?.dailyCounts)
      ? raw.dailyCounts.filter((d: any) => d && d.date).map((d: any) => ({ date: String(d.date), count: n(d.count) }))
      : [],
  };
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
      .then(({ data }) => setData(normalizeAnalytics(data)))
      .catch((err) => setError(errorMessage(err, "Couldn't load analytics.")))
      .finally(() => setLoading(false));
  }, [session, twinId]);

  const groundedPct = data ? Math.round(data.groundedRate * 100) : 0;

  const maxQ = data ? Math.max(1, ...data.topQuestions.map((q) => q.count)) : 1;
  const series = data?.dailyCounts.map((d) => ({ label: d.date, value: d.count })) ?? [];
  const last14 = series.reduce((a, d) => a + d.value, 0);
  const fmtDay = (s: string) => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <AppShell title="Analytics" accent="#10B981" accent2="#2DD4BF" wide>
      <PageHeader
        eyebrow="Real insight · Live data"
        eyebrowTone="green"
        title="Analytics"
        description="Real insight from every conversation your twin has had."
        actions={
          <button onClick={() => router.push("/dashboard/connect")} className="btn btn-secondary">
            <Icon name="arrow-left" size={15} /> Back to dashboard
          </button>
        }
      />

      {error && <div className="mt-8"><Alert>{error}</Alert></div>}

      {loading && (
        <div className="mt-10 space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="surface space-y-4 p-5"><Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-20" /></div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="surface p-6 lg:col-span-2"><Skeleton className="h-60 w-full" /></div>
            <div className="surface p-6"><Skeleton className="mx-auto h-48 w-48 !rounded-full" /></div>
          </div>
        </div>
      )}

      {data && (
        <div className="mt-10 space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Conversations" value={data.totalConversations} icon="message" hint={`${last14} in the last 14 days`} spark={series.map((d) => d.value)} />
            <StatCard label="Grounded rate" value={groundedPct} unit="%" icon="shield" tone="green" hint={`${data.groundedCount} grounded answers`} meter={data.groundedRate} />
            <StatCard label="Avg. confidence" value={data.avgConfidence.toFixed(2)} icon="target" tone="gold" hint="How well answers match the videos (0–1)" meter={data.avgConfidence} />
            <StatCard label="Refused" value={data.refusedCount} icon="alert" tone="red" hint="Guardrail said “I don’t know”" meter={data.groundedCount + data.refusedCount > 0 ? data.refusedCount / (data.groundedCount + data.refusedCount) : 0} meterLabel="Share of questions refused" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="surface p-6 lg:col-span-2 animate-fade-up">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-semibold text-fg">Conversations</p>
                  <p className="text-sm text-fg/45">Last 14 days</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-semibold tabular-nums text-fg">{last14}</p>
                  <p className="text-xs text-fg/40">total</p>
                </div>
              </div>
              {series.length > 0 ? (
                <AreaChart data={series} color="#10B981" height={240} formatLabel={fmtDay} unit="chats" />
              ) : (
                <p className="py-16 text-center text-sm text-fg/45">No activity yet.</p>
              )}
            </div>

            <div className="surface flex flex-col items-center p-6 animate-fade-up" style={{ animationDelay: "80ms" }}>
              <p className="self-start font-display text-lg font-semibold text-fg">Answer quality</p>
              <p className="self-start text-sm text-fg/45">Grounded vs. refused</p>
              <div className="my-6">
                <RadialGauge value={groundedPct} color="#10B981" size={190} stroke={12}>
                  <span className="font-display text-4xl font-semibold tabular-nums text-fg">{groundedPct}%</span>
                  <span className="mt-0.5 font-mono-timecode text-[10px] tracking-[0.2em] text-fg/45">GROUNDED</span>
                </RadialGauge>
              </div>
              <div className="w-full space-y-2.5">
                {[
                  { label: "Grounded", value: data.groundedCount, color: "bg-verified-500" },
                  { label: "Refused", value: data.refusedCount, color: "bg-rec-400" },
                ].map((r) => (
                  <div key={r.label} className="flex items-center gap-3 text-sm">
                    <span className={`h-2 w-2 rounded-full ${r.color}`} />
                    <span className="flex-1 text-fg/65">{r.label}</span>
                    <span className="font-mono-timecode tabular-nums text-fg">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {session && twinId && <ViewerProfiles twinId={twinId} session={session} />}

          <div className="surface p-6 animate-fade-up" style={{ animationDelay: "120ms" }}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="font-display text-lg font-semibold text-fg">Most-asked questions</p>
                <p className="text-sm text-fg/45">What your audience actually wants to know</p>
              </div>
              <Icon name="message" size={18} className="text-fg/30" />
            </div>
            {data.topQuestions.length === 0 ? (
              <EmptyState icon="message" title="No conversations yet" body="Share your twin to start collecting data." />
            ) : (
              <ol className="space-y-2">
                {data.topQuestions.map((q, i) => (
                  <li key={i} className="group relative overflow-hidden rounded-xl border border-tint/[0.06] bg-tint/[0.02] px-4 py-3 transition-colors hover:border-tint/[0.12]">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-verified-500/[0.12] to-transparent transition-all duration-700"
                      style={{ width: `${(q.count / maxQ) * 100}%` }}
                    />
                    <div className="relative flex items-center gap-4">
                      <span className="w-5 font-mono-timecode text-xs text-fg/35">{String(i + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-fg/90">{q.content}</span>
                      <span className="flex-shrink-0 rounded-full bg-tint/[0.06] px-2.5 py-0.5 font-mono-timecode text-[11px] text-fg/70">{q.count}&times;</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

AnalyticsPage.getLayout = withAppFrame;
