/**
 * Small, crash-proof wrappers around browser APIs used across pages.
 * localStorage can hold corrupted JSON (or be blocked entirely in private
 * modes), and navigator.clipboard is undefined on non-HTTPS origins — both
 * used to throw uncaught errors from event handlers / effects.
 */

export function readJSON<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Pulls a human-readable message out of an axios/network error. */
export function errorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: unknown } }; code?: string };
  const msg = e?.response?.data?.error;
  if (typeof msg === "string" && msg.trim()) return msg;
  if (e?.code === "ECONNABORTED") return "The server took too long to respond — try again.";
  if (e && !e.response) return "Can't reach the YouTwin server — check your connection and try again.";
  return fallback;
}
