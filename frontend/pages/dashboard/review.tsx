import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { api, authHeader, PersonaProfile } from "@/lib/api";
import Toggle from "@/components/Toggle";
import AppShell from "@/components/AppShell";
import CreatorAvatar from "@/components/CreatorAvatar";
import { Alert, Icon, PageHeader, Skeleton } from "@/components/ui";
import { errorMessage } from "@/lib/browser";
import { StageHandoff, withStudio } from "@/components/StudioWorkspace";
import { useStudio } from "@/components/studio";

export default function ReviewStep() {
  const router = useRouter();
  const [session, setSession] = useState<string | null>(null);
  const [twinId, setTwinId] = useState<string | null>(null);
  const [persona, setPersona] = useState<PersonaProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // M2's persona definition file (spaCy profile + LlamaIndex Document),
  // saved as JSON so the creator can inspect or archive their twin's voice.
  async function downloadPersonaFile() {
    if (!twinId || !session || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const { data } = await api.get(`/twins/${twinId}/persona/definition`, { headers: authHeader(session) });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `youtwin-persona-${twinId.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setDownloadError(errorMessage(err, "Couldn't download the persona file."));
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    const s = localStorage.getItem("youtwin_session");
    const t = localStorage.getItem("youtwin_twinId");
    if (!s || !t) {
      router.replace("/dashboard/train");
      return;
    }
    setSession(s);
    setTwinId(t);
    setLoadError(null);
    let cancelled = false;
    api
      .get(`/twins/${t}/persona`, { headers: authHeader(s) })
      .then(({ data }) => !cancelled && setPersona(data))
      .catch((err) => {
        if (cancelled) return;
        // Only a genuinely missing persona means "go train first" — a
        // network blip used to bounce the creator out of the studio.
        if (err?.response?.status === 404) router.replace("/dashboard/train");
        else setLoadError(errorMessage(err, "Couldn't load the persona."));
      });
    return () => {
      cancelled = true;
    };
  }, [router, reloadKey]);

  async function updateToggle(field: "tone_match_enabled" | "guardrails_enabled", value: boolean) {
    if (!persona || !twinId || !session) return;
    const prev = persona;
    const next = { ...persona, [field]: value };
    setPersona(next);
    setSaveError(null);
    try {
      await api.patch(
        `/twins/${twinId}/persona`,
        { toneMatch: next.tone_match_enabled, guardrails: next.guardrails_enabled },
        { headers: authHeader(session) }
      );
    } catch (err) {
      // Optimistic update rolled back — the toggle used to show a state
      // that was never saved (and threw an unhandled rejection).
      setPersona(prev);
      setSaveError(errorMessage(err, "Couldn't save that setting. Try again."));
    }
  }

  const { update: updateStudio } = useStudio();
  useEffect(() => {
    if (persona) updateStudio({ persona: { tone: persona.tone_descriptors, wpm: persona.speaking_pace_wpm } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona?.twin_id]);

  const vocabMax = persona?.top_vocabulary.length ?? 0;

  return (
    <AppShell setupStep={3} title="Review persona" accent="#E0AE4E" accent2="#2DD4BF">
      <PageHeader compact title="Review the persona" description="Preview tone, set guardrails." />

      {loadError && (
        <div className="mt-7 flex flex-col items-start gap-3">
          <Alert>{loadError}</Alert>
          <button onClick={() => setReloadKey((k) => k + 1)} className="btn btn-secondary btn-sm">
            <Icon name="refresh" size={14} /> Try again
          </button>
        </div>
      )}

      {loadError ? null : !persona ? (
        <div className="mt-7 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="surface space-y-4 p-7">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="surface space-y-4 p-7">
            <div className="grid grid-cols-2 gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-16 w-full" />
            <p className="pt-2 text-sm text-fg/45">Loading persona…</p>
          </div>
        </div>
      ) : (
        <div className="mt-7 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Voice preview + guardrails */}
          <div className="flex flex-col gap-6">
            <div className="surface-solid relative overflow-hidden p-7 animate-fade-up" style={{ animationDelay: "60ms" }}>
              <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cited-400/20 blur-3xl" />
              <div className="relative flex items-center gap-3">
                <CreatorAvatar name={persona.creator_name || "Creator"} size={40} />
                <div>
                  <p className="font-medium text-fg">{persona.creator_name || "Your twin"}</p>
                  <p className="text-xs text-fg/45">Opening line · in your voice</p>
                </div>
                <Icon name="quote" size={28} className="ml-auto text-cited-400/40" />
              </div>
              <p className="relative mt-6 font-serif text-[1.65rem] italic leading-snug text-fg">
                &ldquo;{persona.sample_opening_line || "Hey! Ask me anything from my videos."}&rdquo;
              </p>
            </div>

            <div className="surface p-6 animate-fade-up" style={{ animationDelay: "120ms" }}>
              <div className="flex items-center gap-2">
                <Icon name="shield" size={17} className="text-verified-400" />
                <p className="font-display font-semibold text-fg">Behaviour controls</p>
              </div>
              <div className="mt-2 divide-y divide-tint/[0.06]">
                <Toggle
                  label="Tone match"
                  description="Replies mirror your pacing, vocabulary and recurring phrases."
                  checked={persona.tone_match_enabled}
                  onChange={(v) => updateToggle("tone_match_enabled", v)}
                />
                {saveError && <div className="py-2"><Alert>{saveError}</Alert></div>}
                <Toggle
                  label="Guardrails"
                  description="Refuse instead of guessing when your videos don't cover a question."
                  checked={persona.guardrails_enabled}
                  onChange={(v) => updateToggle("guardrails_enabled", v)}
                />
              </div>
            </div>
          </div>

          {/* Stylometry */}
          <div className="surface flex flex-col gap-7 p-7 animate-fade-up" style={{ animationDelay: "180ms" }}>
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-semibold text-fg">Stylometric profile</p>
              <span className="chip font-mono-timecode !text-[10px]">spaCy · LlamaIndex · M2</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Metric label="Speaking pace" value={persona.speaking_pace_wpm > 0 ? `${persona.speaking_pace_wpm}` : "—"} unit="wpm" pct={Math.min(100, (persona.speaking_pace_wpm / 220) * 100)} />
              <Metric label="Avg. sentence" value={persona.avg_sentence_length > 0 ? `${persona.avg_sentence_length}` : "—"} unit="words" pct={Math.min(100, (persona.avg_sentence_length / 30) * 100)} />
            </div>

            {persona.tone_descriptors.length > 0 && (
              <div>
                <p className="mb-2.5 font-mono-timecode text-[10px] uppercase tracking-[0.16em] text-fg/40">Tone</p>
                <div className="flex flex-wrap gap-2">
                  {persona.tone_descriptors.map((t) => (
                    <span key={t} className="rounded-full border border-cited-400/30 bg-cited-400/10 px-3 py-1 text-xs font-medium text-cited-300">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {persona.top_vocabulary.length > 0 && (
              <div>
                <p className="mb-2.5 font-mono-timecode text-[10px] uppercase tracking-[0.16em] text-fg/40">Frequently used words</p>
                <div className="space-y-1.5">
                  {persona.top_vocabulary.slice(0, 8).map((w, i) => (
                    <div key={w} className="flex items-center gap-3">
                      <span className="w-24 truncate font-mono-timecode text-xs text-fg/75">{w}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-tint/[0.05]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-signal-500/70 to-signal-400 transition-all duration-700"
                          style={{ width: `${100 - (i / Math.max(1, vocabMax)) * 70}%` }}
                        />
                      </div>
                      <span className="w-6 text-right font-mono-timecode text-[10px] text-fg/30">#{i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {persona.catchphrases.length > 0 && (
              <div>
                <p className="mb-2.5 font-mono-timecode text-[10px] uppercase tracking-[0.16em] text-fg/40">Recurring phrases</p>
                <div className="flex flex-col gap-2">
                  {persona.catchphrases.slice(0, 3).map((c) => (
                    <span key={c} className="rounded-xl border border-tint/[0.07] bg-tint/[0.03] px-3.5 py-2.5 font-serif text-[1.05rem] italic text-fg/80">&ldquo;{c}&rdquo;</span>
                  ))}
                </div>
              </div>
            )}

            {(persona.style_exemplars?.length ?? 0) > 0 && (
              <div>
                <p className="mb-2.5 font-mono-timecode text-[10px] uppercase tracking-[0.16em] text-fg/40">Lines in your voice</p>
                <ul className="space-y-1.5">
                  {persona.style_exemplars!.slice(0, 3).map((e) => (
                    <li key={e} className="border-l-2 border-signal-400/40 pl-3 text-[13px] leading-relaxed text-fg/70">{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-auto flex flex-col gap-2 border-t border-tint/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-fg/45">Persona definition file — profile, voice lines and guardrails as JSON.</p>
              <button onClick={downloadPersonaFile} disabled={downloading} className="btn btn-secondary btn-sm flex-shrink-0">
                <Icon name="download" size={14} /> {downloading ? "Preparing…" : "Download"}
              </button>
            </div>
            {downloadError && <Alert>{downloadError}</Alert>}
          </div>
        </div>
      )}
      <StageHandoff
        done={!!persona}
        doneTitle="Persona learned from your videos"
        doneBody={
          persona
            ? `${persona.tone_descriptors.slice(0, 3).join(", ") || "Your voice"} · guardrails ${persona.guardrails_enabled ? "on" : "off"} · tone match ${persona.tone_match_enabled ? "on" : "off"}`
            : undefined
        }
        pendingHint="Loading the persona…"
        nextHref="/dashboard/share"
        nextLabel="Looks right — publish"
        onNext={() => updateStudio({ persona: { reviewed: true } })}
      />
    </AppShell>
  );
}

ReviewStep.getLayout = withStudio;

function Metric({ label, value, unit, pct }: { label: string; value: string; unit: string; pct: number }) {
  return (
    <div className="rounded-xl border border-tint/[0.07] bg-tint/[0.03] p-4">
      <p className="text-xs text-fg/50">{label}</p>
      <p className="mt-1.5 font-display text-3xl font-semibold tabular-nums text-fg">
        {value}
        <span className="ml-1 text-sm font-normal text-fg/40">{unit}</span>
      </p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-tint/[0.06]">
        <div className="h-full rounded-full bg-gradient-to-r from-cited-500 to-cited-300" style={{ width: `${Math.max(4, pct || 0)}%` }} />
      </div>
    </div>
  );
}
