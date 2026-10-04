/**
 * Twin Studio state — one shared picture of how far the creator's twin is
 * configured, so the workspace can show what's already done (channel
 * name, videos indexed, tone, live link) instead of a bare step number.
 *
 * Pages publish what they learn via useStudio().update(...); the
 * twin-scoped parts are persisted per twin in localStorage so they
 * survive navigation and refreshes, and reset automatically when a new
 * twin is started.
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

export type KnowledgeState = "idle" | "training" | "ready" | "error";

export type StudioState = {
  twinId: string | null;
  linked: boolean;
  channelName: string | null;
  creatorName: string;
  knowledge?: { state: KnowledgeState; label?: string; videos?: string; percent?: number; source?: string };
  persona?: { tone?: string[]; wpm?: number; reviewed?: boolean };
  published?: boolean;
};

type TwinScoped = Pick<StudioState, "knowledge" | "persona" | "published">;

export type StageKey = "channel" | "knowledge" | "persona" | "publish";
export type StageStatus = "done" | "active" | "available" | "locked";

export const STAGES: { key: StageKey; href: string; label: string; icon: string; blurb: string }[] = [
  { key: "channel", href: "/dashboard/connect", label: "Channel", icon: "youtube", blurb: "Where your twin learns from" },
  { key: "knowledge", href: "/dashboard/train", label: "Knowledge", icon: "database", blurb: "Videos ingested & indexed" },
  { key: "persona", href: "/dashboard/review", label: "Persona", icon: "wave", blurb: "Voice, tone & guardrails" },
  { key: "publish", href: "/dashboard/share", label: "Publish", icon: "globe", blurb: "Your twin's public link" },
];

const STORE_KEY = "youtwin_studio";

const EMPTY: StudioState = { twinId: null, linked: false, channelName: null, creatorName: "" };

type Ctx = {
  state: StudioState;
  update: (patch: Partial<TwinScoped>) => void;
  refresh: () => void;
};

const StudioContext = createContext<Ctx>({ state: EMPTY, update: () => {}, refresh: () => {} });

function readState(): StudioState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const creator = JSON.parse(localStorage.getItem("youtwin_creator") || "null");
    const twinId = localStorage.getItem("youtwin_twinId");
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null") as (TwinScoped & { twinId?: string }) | null;
    const scoped: TwinScoped = saved && twinId && saved.twinId === twinId ? saved : {};
    return {
      twinId,
      linked: !!creator?.googleLinked,
      channelName: localStorage.getItem("youtwin_channel_name"),
      creatorName: creator?.displayName ?? "",
      knowledge: scoped.knowledge,
      persona: scoped.persona,
      published: scoped.published,
    };
  } catch {
    return EMPTY;
  }
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<StudioState>(EMPTY);

  const refresh = useCallback(() => setState(readState()), []);

  // Re-read on every navigation: pages change localStorage (twin started,
  // Google linked, twin reset) and the workspace should reflect it.
  useEffect(() => {
    refresh();
  }, [router.asPath, refresh]);

  useEffect(() => {
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const update = useCallback((patch: Partial<TwinScoped>) => {
    setState((cur) => {
      const fresh = readState(); // pick up a twinId/creator change made just now
      const next: StudioState = {
        ...fresh,
        knowledge: patch.knowledge !== undefined ? { ...(fresh.knowledge ?? { state: "idle" }), ...patch.knowledge } : fresh.knowledge ?? cur.knowledge,
        persona: patch.persona !== undefined ? { ...(fresh.persona ?? {}), ...patch.persona } : fresh.persona ?? cur.persona,
        published: patch.published !== undefined ? patch.published : fresh.published ?? cur.published,
      };
      if (next.twinId) {
        try {
          localStorage.setItem(
            STORE_KEY,
            JSON.stringify({ twinId: next.twinId, knowledge: next.knowledge, persona: next.persona, published: next.published }),
          );
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ state, update, refresh }), [state, update, refresh]);
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  return useContext(StudioContext);
}

/** Completion + availability of each stage, derived from real state. */
export function stageStatuses(state: StudioState, activePath?: string): Record<StageKey, StageStatus> {
  const done: Record<StageKey, boolean> = {
    channel: state.linked,
    knowledge: state.knowledge?.state === "ready" || !!state.persona?.reviewed || !!state.published,
    persona: !!state.persona?.reviewed || !!state.published,
    publish: !!state.published,
  };
  const locked: Record<StageKey, boolean> = {
    channel: false,
    knowledge: false,
    persona: !state.twinId,
    publish: !state.twinId,
  };
  const out = {} as Record<StageKey, StageStatus>;
  for (const s of STAGES) {
    out[s.key] = activePath === s.href ? "active" : done[s.key] ? "done" : locked[s.key] ? "locked" : "available";
  }
  return out;
}

export function isStageDone(state: StudioState, key: StageKey) {
  return stageStatuses(state)[key] === "done";
}

/** Where "Twin Studio" should take the creator: the first unfinished stage. */
export function nextStageHref(state: StudioState) {
  const st = stageStatuses(state);
  const next = STAGES.find((s) => st[s.key] !== "done" && st[s.key] !== "locked");
  return next?.href ?? "/dashboard/share";
}

export function completion(state: StudioState) {
  const st = stageStatuses(state);
  return STAGES.filter((s) => st[s.key] === "done").length;
}
