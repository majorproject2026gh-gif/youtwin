/**
 * The viewer's identity on this device: a random id (groups one device's
 * chats into one profile for the creator) and the name they typed on the
 * share link's name step. Kept in localStorage — no account, no login.
 */
export interface ViewerIdentity {
  id: string;
  name: string;
}

const KEY = "youtwin_viewer";
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Same rule as the API (lib.ts cleanViewerName): 2–40 characters,
 * letters in any script, digits, spaces and . ' - ; at least one letter. */
const NAME_RE = /^[\p{L}\p{M}0-9 .'-]{2,40}$/u;

export function cleanName(raw: string): string | null {
  const name = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  return NAME_RE.test(name) && /\p{L}/u.test(name) ? name : null;
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function loadViewer(): ViewerIdentity | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && ID_RE.test(v.id) && typeof v.name === "string" && cleanName(v.name)) return { id: v.id, name: v.name };
  } catch {
    /* storage blocked or malformed */
  }
  return null;
}

/** The device id alone (created on first use), for request headers. */
export function viewerDeviceId(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && ID_RE.test(v.id) ? v.id : null;
  } catch {
    return null;
  }
}

/** Saves the name, keeping this device's id (or creating one). */
export function saveViewerName(name: string): ViewerIdentity {
  const viewer = { id: viewerDeviceId() ?? newId(), name };
  try {
    localStorage.setItem(KEY, JSON.stringify(viewer));
  } catch {
    /* private mode: the name still works for this visit */
  }
  return viewer;
}
