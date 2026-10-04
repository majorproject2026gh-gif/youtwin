import axios from "axios";
import { viewerDeviceId } from "./viewer";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  // Without a timeout a hung request left pages on "Loading…" forever.
  // Chat can legitimately take a while (retrieval + LLM), so be generous.
  timeout: 45_000,
});

/**
 * Viewer pages identify the device (lib/viewer.ts) so the API rate-limits
 * per person, not per IP — many mobile users share one carrier IP.
 */
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const id = viewerDeviceId();
    if (id) config.headers.set("X-Viewer-Id", id);
  }
  return config;
});

/**
 * An expired/invalid session (JWTs last 30 days) used to leave every
 * creator page stuck showing errors with no way back. Any 401 on a request
 * that carried a session token now clears the stale session and returns
 * the creator to the login page. Login/signup attempts (no token) are
 * untouched, so a wrong password still shows its normal inline error.
 */
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const hadToken = !!err?.config?.headers?.Authorization;
    if (typeof window !== "undefined" && hadToken && err?.response?.status === 401) {
      try {
        localStorage.removeItem("youtwin_session");
        localStorage.removeItem("youtwin_creator");
        localStorage.removeItem("youtwin_twinId");
      } catch {
        /* ignore */
      }
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login?expired=1");
      }
    }
    return Promise.reject(err);
  },
);

export function authHeader(session: string | null) {
  return session ? { Authorization: `Bearer ${session}` } : {};
}

/**
 * Logs the user out AND unlinks their Google account server-side, so
 * that the next time they log back in, the Connect step always shows a
 * fresh Google sign-in prompt rather than remembering a prior
 * authorization. Best-effort: if the unlink call fails (offline,
 * already logged out, etc.) we still clear the local session either way.
 */
export async function logout(): Promise<void> {
  const session = localStorage.getItem("youtwin_session");
  if (session) {
    try {
      await api.post("/auth/google/unlink", {}, { headers: authHeader(session) });
    } catch {
      /* non-fatal — proceed with clearing the local session regardless */
    }
  }
  // Clear only YouTwin's own session data — localStorage.clear() also wiped
  // the viewer's theme choice and cookie acknowledgement on every logout.
  for (const key of [
    "youtwin_session",
    "youtwin_creator",
    "youtwin_twinId",
    "youtwin_channel_name",
    "youtwin_studio",
  ]) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export interface IngestStatus {
  twin_id: string;
  stage: "queued" | "fetching_captions" | "transcribing_audio" | "extracting_style" | "embedding" | "ready" | "error";
  percent: number;
  videos_processed: number;
  videos_total: number;
  detail: string;
}

export interface PersonaProfile {
  twin_id: string;
  creator_name: string;
  tone_descriptors: string[];
  avg_sentence_length: number;
  speaking_pace_wpm: number;
  top_vocabulary: string[];
  catchphrases: string[];
  sample_opening_line: string;
  style_exemplars?: string[];
  guardrails_enabled: boolean;
  tone_match_enabled: boolean;
}

export interface Citation {
  video_id: string;
  video_title: string;
  timestamp_seconds: number;
  snippet?: string;
}

export interface ChatTurn {
  role: "viewer" | "twin";
  content: string;
  grounded?: boolean;
  /** True when the twin declined to answer (guardrail). */
  refused?: boolean;
  confidence?: number;
  citations?: Citation[];
}

export interface TwinLookup {
  twinId: string;
  creatorName: string;
  status: string;
}

/**
 * Resolves a public /twin/<param> route to an actual twin. Tries the
 * legacy creator-handle lookup first (a link like youtwin.ai/mayankb —
 * always resolves to whichever twin that creator trained MOST RECENTLY,
 * fine for a creator with a single twin), and if that 404s, falls back
 * to treating the param as a specific twin's own id (a link like
 * youtwin.ai/twin/<uuid> — always resolves to that exact twin,
 * regardless of what gets trained afterward). This lets both link
 * styles work through the same viewer pages without duplicating them.
 */
export async function resolveTwin(handleOrId: string): Promise<TwinLookup> {
  const key = encodeURIComponent(handleOrId);
  try {
    const { data } = await api.get(`/twins/by-handle/${key}`);
    return data;
  } catch (err: any) {
    // Only fall back to the id lookup when the handle genuinely doesn't
    // exist — a network error or 5xx should surface as-is instead of
    // being masked by a second (also failing) request.
    if (err?.response?.status !== 404) throw err;
    const { data } = await api.get(`/twins/by-id/${key}`);
    return data;
  }
}
