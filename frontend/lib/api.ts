import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
});

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
  localStorage.clear();
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
  guardrails_enabled: boolean;
  tone_match_enabled: boolean;
}

export interface ChatTurn {
  role: "viewer" | "twin";
  content: string;
  grounded?: boolean;
  confidence?: number;
  citations?: { video_title: string; timestamp_seconds: number }[];
}
