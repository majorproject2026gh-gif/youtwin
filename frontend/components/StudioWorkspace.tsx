import { ReactElement, ReactNode, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { api, authHeader } from "@/lib/api";
import { AppFrame } from "./AppShell";
import CreatorAvatar from "./CreatorAvatar";
import { Icon } from "./ui";
import { STAGES, StageKey, StageStatus, StudioState, completion, stageStatuses, useStudio } from "./studio";

/**
 * Twin Studio — the single workspace the creator builds their twin in.
 *
 * The four stages (Channel → Knowledge → Persona → Publish) are panels of
 * one workspace rather than separate form pages: the "twin blueprint" on
 * the left stays mounted, shows what each stage has already configured,
 * and lets the creator jump back to edit any of them. Only the panel on
 * the right changes, sliding in the direction of travel.
 */
export default function StudioWorkspace({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { state, update } = useStudio();
  const idx = Math.max(0, STAGES.findIndex((s) => s.href === router.pathname));
  // Slide direction is decided once per stage change (not per render), so
  // background state updates never replay the panel animation.
  const prevIdx = useRef(idx);
  const dirRef = useRef<"forward" | "back">("forward");
  if (prevIdx.current !== idx) {
    dirRef.current = idx > prevIdx.current ? "forward" : "back";
    prevIdx.current = idx;
  }
  const direction = dirRef.current;

  // Fill in what we can't know from this session alone: if a twin exists
  // but we haven't seen its training state yet, ask the backend once.
  useEffect(() => {
    if (!state.twinId || state.knowledge) return;
    const session = localStorage.getItem("youtwin_session");
    if (!session) return;
    api
      .get(`/twins/${state.twinId}/status`, { headers: authHeader(session) })
      .then(({ data }) => {
        const ready = data?.stage === "ready";
        update({
          knowledge: {
            state: ready ? "ready" : data?.stage === "error" ? "error" : "training",
            videos: data?.videos_total ? `${data.videos_processed}/${data.videos_total}` : undefined,
            percent: data?.percent,
          },
        });
      })
      .catch(() => {});
  }, [state.twinId, state.knowledge, update]);

  // On narrow screens the blueprint scrolls sideways — keep the current
  // section in view.
  useEffect(() => {
    const el = document.querySelector('nav[aria-label="Twin blueprint"] li[data-active]');
    const list = el?.parentElement;
    if (el && list && list.scrollWidth > list.clientWidth) {
      // Scroll the strip itself — scrollIntoView() could also scroll the page.
      const target = (el as HTMLElement).offsetLeft - (list.clientWidth - (el as HTMLElement).clientWidth) / 2;
      list.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    }
  }, [router.pathname]);

  const statuses = stageStatuses(state, router.pathname);
  const done = completion(state);
  const live = !!state.published;
  const phase = live ? "Live" : state.knowledge?.state === "training" ? "Training" : state.twinId ? "Draft" : "New";

  return (
    <div className="animate-fade-up">
      {/* Workspace header */}
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={`absolute -inset-1 rounded-2xl blur-md transition-colors duration-700 ${live ? "bg-verified-500/40" : "bg-rec-500/30"}`} />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-tint/10 bg-gradient-to-b from-night-700 to-night-850 shadow-lift">
              <CreatorAvatar name={state.creatorName || "Twin"} size={34} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-2xl font-semibold text-fg sm:text-[1.75rem]">
                {state.creatorName ? `${state.creatorName.split(" ")[0]}'s twin` : "Your twin"}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 transition-colors duration-500 ${
                  live
                    ? "bg-verified-500/10 text-verified-400 ring-verified-500/30"
                    : phase === "Training"
                    ? "bg-cited-400/10 text-cited-300 ring-cited-400/30"
                    : "bg-tint/[0.05] text-fg/60 ring-tint/10"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-verified-500" : phase === "Training" ? "bg-cited-400 animate-pulse" : "bg-fg/40"}`} />
                {phase}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-fg/50">Twin Studio · everything your twin knows and how it speaks, in one place.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:w-56 sm:flex-col sm:items-end sm:gap-2">
          <p className="whitespace-nowrap text-xs text-fg/50">
            <span className="font-medium text-fg/85">{done}</span> of {STAGES.length} configured
          </p>
          <div className="flex h-1.5 w-full gap-1">
            {STAGES.map((s) => (
              <span key={s.key} className="relative flex-1 overflow-hidden rounded-full bg-tint/[0.08]">
                <span
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out-expo ${
                    statuses[s.key] === "done" || (s.key === "publish" && live)
                      ? "w-full bg-gradient-to-r from-verified-500 to-verified-400"
                      : statuses[s.key] === "active"
                      ? "w-1/2 bg-gradient-to-r from-coral-400 to-rec-500"
                      : "w-0"
                  }`}
                />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Twin blueprint — what each part of the twin is set to. Not a
          numbered wizard: every section shows its current configuration and
          can be reopened to edit at any time. */}
      <nav aria-label="Twin blueprint" className="surface mb-8 overflow-hidden p-1.5">
        <ol className="flex gap-1.5 overflow-x-auto md:grid md:grid-cols-4 md:overflow-visible">
          {STAGES.map((s, i) => (
            <StageRow key={s.key} stage={s} status={statuses[s.key]} summary={summaryFor(s.key, state, stageStatuses(state)[s.key])} last={i === STAGES.length - 1} />
          ))}
        </ol>
      </nav>

      <div>
        {/* Active panel */}
        <section key={router.pathname} className={`min-w-0 ${direction === "forward" ? "stage-in-forward" : "stage-in-back"}`}>
          {children}
        </section>
      </div>
    </div>
  );
}

function summaryFor(key: StageKey, s: StudioState, status?: StageStatus): string {
  if (status === "done") {
    if (key === "knowledge") return s.knowledge?.videos ? `${s.knowledge.videos.split("/").pop()} videos indexed` : "Indexed and ready";
    if (key === "persona" && !s.persona?.tone?.length) return "Voice reviewed";
  }
  switch (key) {
    case "channel":
      return s.linked ? s.channelName ?? "Google account linked" : "Connect a YouTube channel";
    case "knowledge":
      if (!s.twinId) return "Add videos for your twin to learn from";
      if (s.knowledge?.state === "ready") return s.knowledge.videos ? `${s.knowledge.videos.split("/").pop()} videos indexed` : "Indexed and ready";
      if (s.knowledge?.state === "error") return "Training stopped — retry";
      if (s.knowledge?.state === "training")
        return `${s.knowledge.label ?? "Training"}${typeof s.knowledge.percent === "number" ? ` · ${s.knowledge.percent}%` : ""}`;
      return "Training in progress";
    case "persona":
      if (s.persona?.tone?.length) return s.persona.tone.slice(0, 3).join(" · ");
      return s.twinId ? "Review voice & guardrails" : "Unlocks after training";
    case "publish":
      if (s.published && s.twinId) return `${typeof window !== "undefined" ? window.location.host : ""}/twin/${s.twinId.slice(0, 8)}…`;
      return s.twinId ? "Get your shareable link" : "Unlocks after training";
  }
}

function StageRow({
  stage,
  status,
  summary,
  last,
}: {
  stage: (typeof STAGES)[number];
  status: StageStatus;
  summary: string;
  last: boolean;
}) {
  const locked = status === "locked";
  const inner = (
    <div
      className={`group relative flex items-start gap-3 rounded-xl px-3 py-3 transition-all duration-300 ${
        status === "active"
          ? "bg-gradient-to-r from-tint/[0.08] to-tint/[0.02] ring-1 ring-tint/10"
          : locked
          ? "opacity-50"
          : "hover:bg-tint/[0.04]"
      }`}
    >
      {status === "active" && <span className="absolute inset-x-4 bottom-0 h-[2px] rounded-t-full bg-gradient-to-r from-coral-400 to-rec-500 shadow-[0_0_12px_rgba(242,96,63,0.8)]" />}
      <span
        className={`relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-500 ${
          status === "done"
            ? "bg-verified-500/12 text-verified-400 ring-1 ring-verified-500/30"
            : status === "active"
            ? "bg-gradient-to-b from-coral-400 to-rec-500 text-white shadow-glow"
            : "bg-tint/[0.05] text-fg/45 ring-1 ring-tint/10"
        }`}
      >
        {status === "done" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="draw-check">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        ) : (
          <Icon name={locked ? "lock" : stage.icon} size={16} />
        )}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-medium ${status === "active" || status === "done" ? "text-fg" : "text-fg/70"}`}>{stage.label}</p>
          {status === "done" && (
            <span className="text-[11px] text-fg/35 opacity-0 transition-opacity group-hover:opacity-100">Edit</span>
          )}
          {status === "active" && <span className="font-mono-timecode text-[10px] uppercase tracking-wider text-coral-400">Now</span>}
        </div>
        <p className={`mt-0.5 truncate text-xs ${status === "done" ? "text-fg/55" : "text-fg/40"}`}>{summary}</p>
      </div>
    </div>
  );

  return (
    <li data-active={status === "active" || undefined} className="relative min-w-[210px] flex-1 md:min-w-0">
      {!last && (
        <span
          className={`absolute -right-[7px] top-1/2 z-20 hidden h-px w-3 -translate-y-1/2 transition-colors duration-700 md:block ${
            status === "done" ? "bg-verified-500/60" : "bg-tint/15"
          }`}
        />
      )}
      {locked ? (
        <div title="Unlocks after training" className="cursor-not-allowed">{inner}</div>
      ) : (
        <Link href={stage.href} scroll={false} className="block">
          {inner}
        </Link>
      )}
    </li>
  );
}

/**
 * A meaningful completion state + the natural next move, used at the
 * bottom of each stage panel instead of a bare "Next →".
 */
export function StageHandoff({
  done,
  doneTitle,
  doneBody,
  nextHref,
  nextLabel,
  pendingHint,
  back,
  onNext,
}: {
  done: boolean;
  doneTitle: string;
  doneBody?: ReactNode;
  nextHref?: string;
  nextLabel?: string;
  pendingHint?: ReactNode;
  back?: ReactNode;
  onNext?: () => void;
}) {
  return (
    <div
      className={`mt-6 flex flex-col gap-4 rounded-2xl border p-4 transition-all duration-500 sm:flex-row sm:items-center sm:p-5 ${
        done ? "border-verified-500/25 bg-verified-500/[0.05]" : "border-tint/[0.07] bg-tint/[0.02]"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-500 ${
            done ? "bg-verified-500 text-white shadow-glow-green" : "bg-tint/[0.05] text-fg/40 ring-1 ring-tint/10"
          }`}
        >
          {done ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="draw-check">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          ) : (
            <Icon name="clock" size={17} />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">{done ? doneTitle : "Not finished yet"}</p>
          <p className="truncate text-xs text-fg/50">{done ? doneBody : pendingHint}</p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {back}
        {nextHref && nextLabel && (
          <Link
            href={done ? nextHref : "#"}
            scroll={false}
            aria-disabled={!done}
            onClick={(e) => (!done ? e.preventDefault() : onNext?.())}
            className={`btn btn-primary ${done ? "" : "pointer-events-none opacity-45"}`}
          >
            {nextLabel} <Icon name="arrow-right" size={15} strokeWidth={2.25} />
          </Link>
        )}
      </div>
    </div>
  );
}

/** getLayout for the four studio routes: persistent frame + workspace. */
export function withStudio(page: ReactElement) {
  return (
    <AppFrame>
      <StudioWorkspace>{page}</StudioWorkspace>
    </AppFrame>
  );
}
