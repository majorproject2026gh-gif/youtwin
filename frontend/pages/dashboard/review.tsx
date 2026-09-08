import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { api, authHeader, logout, PersonaProfile } from "@/lib/api";
import Toggle from "@/components/Toggle";
import Logo from "@/components/Logo";

export default function ReviewStep() {
  const router = useRouter();
  const [session, setSession] = useState<string | null>(null);
  const [twinId, setTwinId] = useState<string | null>(null);
  const [persona, setPersona] = useState<PersonaProfile | null>(null);

  useEffect(() => {
    const s = localStorage.getItem("youtwin_session");
    const t = localStorage.getItem("youtwin_twinId");
    if (!s || !t) {
      router.replace("/dashboard/train");
      return;
    }
    setSession(s);
    setTwinId(t);
    api
      .get(`/twins/${t}/persona`, { headers: authHeader(s) })
      .then(({ data }) => setPersona(data))
      .catch(() => router.replace("/dashboard/train"));
  }, [router]);

  async function updateToggle(field: "tone_match_enabled" | "guardrails_enabled", value: boolean) {
    if (!persona || !twinId || !session) return;
    const next = { ...persona, [field]: value };
    setPersona(next);
    await api.patch(
      `/twins/${twinId}/persona`,
      { toneMatch: next.tone_match_enabled, guardrails: next.guardrails_enabled },
      { headers: authHeader(session) }
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-ink-950 flex flex-col">
      <div className="bg-orb-a pointer-events-none absolute -left-32 top-[10%] h-[520px] w-[520px] rounded-full opacity-40 blur-[120px]" style={{ background: "radial-gradient(circle, #D9A441 0%, transparent 70%)" }} />
      <div className="bg-orb-b pointer-events-none absolute right-[-20%] bottom-[5%] h-[480px] w-[480px] rounded-full opacity-30 blur-[120px]" style={{ background: "radial-gradient(circle, #5EEAD4 0%, transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />

      <nav className="relative flex items-center justify-between px-8 py-6">
        <Link href="/home"><Logo dark /></Link>
        <button onClick={async () => { await logout(); router.push("/login"); }} className="glass-pill rounded-full border border-white/15 px-4 py-2 text-xs text-paper-300 hover:bg-white/10 transition-colors">
          Log out
        </button>
      </nav>

      <div className="relative flex-1 flex flex-col items-center px-6 py-10 text-center">
        <span className="font-mono-timecode text-xs tracking-[0.25em] text-paper-300 mb-4">STEP 3 OF 4 &middot; REVIEW</span>
        <h1 className="font-display text-5xl sm:text-6xl font-bold text-paper-100 mb-3">Review the persona</h1>
        <p className="text-lg text-paper-300 mb-10 max-w-md">Preview tone, set guardrails.</p>

        <div className="w-full max-w-lg">
          {persona ? (
            <div className="glass-panel rounded-2xl border border-white/15 bg-white/10 p-7 text-left flex flex-col gap-5">
              <div className="rounded-xl bg-black/25 border border-white/10 px-5 py-4">
                <p className="font-serif italic text-lg text-paper-100 leading-snug">
                  &ldquo;{persona.sample_opening_line || "Hey! Ask me anything from my videos."}&rdquo;
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-black/20 border border-white/10 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-paper-300/70 font-mono-timecode">Speaking pace</p>
                  <p className="mt-0.5 font-display text-2xl font-bold text-paper-100">
                    {persona.speaking_pace_wpm > 0 ? `${persona.speaking_pace_wpm}` : "—"}
                    <span className="text-sm font-normal text-paper-300 ml-1">wpm</span>
                  </p>
                </div>
                <div className="rounded-xl bg-black/20 border border-white/10 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-paper-300/70 font-mono-timecode">Avg. sentence</p>
                  <p className="mt-0.5 font-display text-2xl font-bold text-paper-100">
                    {persona.avg_sentence_length > 0 ? `${persona.avg_sentence_length}` : "—"}
                    <span className="text-sm font-normal text-paper-300 ml-1">words</span>
                  </p>
                </div>
              </div>

              {persona.tone_descriptors.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-paper-300/70 font-mono-timecode mb-1.5">Tone</p>
                  <div className="flex flex-wrap gap-1.5">
                    {persona.tone_descriptors.map((t) => (
                      <span key={t} className="rounded-full bg-cited-500/20 border border-cited-500/30 px-2.5 py-1 text-xs text-cited-400">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {persona.top_vocabulary.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-paper-300/70 font-mono-timecode mb-1.5">Frequently used words</p>
                  <div className="flex flex-wrap gap-1.5">
                    {persona.top_vocabulary.slice(0, 8).map((w) => (
                      <span key={w} className="rounded bg-white/10 px-2 py-1 text-xs text-paper-100 font-mono-timecode">{w}</span>
                    ))}
                  </div>
                </div>
              )}

              {persona.catchphrases.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-paper-300/70 font-mono-timecode mb-1.5">Recurring phrases</p>
                  <div className="flex flex-col gap-1">
                    {persona.catchphrases.slice(0, 3).map((c) => (
                      <span key={c} className="text-sm italic text-paper-300">&ldquo;{c}&rdquo;</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-white/10 pt-4">
                <Toggle dark label="Tone match" checked={persona.tone_match_enabled} onChange={(v) => updateToggle("tone_match_enabled", v)} />
                <Toggle dark label="Guardrails" checked={persona.guardrails_enabled} onChange={(v) => updateToggle("guardrails_enabled", v)} />
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl border border-white/15 bg-white/10 p-10 text-paper-300">Loading persona…</div>
          )}
        </div>

        <div className="mt-10 flex items-center gap-4">
          <button onClick={() => router.push("/dashboard/train")} className="glass-pill rounded-full border border-white/15 px-6 py-2.5 text-sm text-paper-300 hover:bg-white/10 transition-colors">
            ← Back
          </button>
          <button
            onClick={() => router.push("/dashboard/share")}
            disabled={!persona}
            className="rounded-full bg-gradient-to-r from-rec-500 to-rec-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rec-500/30 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 transition-all"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
