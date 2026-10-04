import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, authHeader } from "@/lib/api";
import { errorMessage } from "@/lib/browser";
import { Alert, EmptyState, Icon, Skeleton, spotlight } from "./ui";

/** One person who opened the twin's link (GET /twins/:id/viewers). */
export interface ViewerProfile {
  id: string;
  tag: string;
  name: string;
  device: string;
  language: string;
  visits: number;
  firstSeen: string;
  lastSeen: string;
  questions: number;
  answered: number;
  refused: number;
  lastQuestion: string | null;
}

interface Conversation {
  viewer: Omit<ViewerProfile, "questions" | "answered" | "refused" | "lastQuestion">;
  messages: { role: string; content: string; grounded: boolean; confidence: number; createdAt: string }[];
}

const AVATAR_TONES = [
  "bg-coral-400/15 text-coral-400 ring-coral-400/30",
  "bg-cited-400/15 text-cited-300 ring-cited-400/30",
  "bg-verified-500/15 text-verified-400 ring-verified-500/30",
  "bg-signal-400/15 text-signal-400 ring-signal-400/30",
  "bg-rec-500/15 text-rec-300 ring-rec-400/30",
];

function tone(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const isPhone = (device: string) => /iPhone|Android|iPad/.test(device);
const activeNow = (iso: string) => Date.now() - new Date(iso).getTime() < 5 * 60 * 1000;

function Avatar({ v, size = 44 }: { v: { id: string; name: string; lastSeen: string }; size?: number }) {
  return (
    <span className="relative flex-shrink-0">
      <span
        className={`flex items-center justify-center rounded-full font-display font-semibold ring-1 ${tone(v.id)}`}
        style={{ width: size, height: size, fontSize: size * 0.36 }}
        aria-hidden
      >
        {initials(v.name)}
      </span>
      {activeNow(v.lastSeen) && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-verified-500 ring-2 ring-[rgb(var(--canvas))]" title="Active now" />
      )}
    </span>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="rounded-lg bg-tint/[0.04] px-2 py-1.5 text-center ring-1 ring-tint/[0.06]">
      <p className={`font-display text-lg font-semibold leading-none tabular-nums ${cls}`}>{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-fg/40">{label}</p>
    </div>
  );
}

function ProfileCard({ v, onOpen }: { v: ViewerProfile; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseMove={spotlight}
      className="surface surface-interactive spotlight group flex h-full flex-col p-4 text-left animate-fade-up"
      aria-label={`Open ${v.name}'s conversation`}
    >
      <div className="flex items-center gap-3">
        <Avatar v={v} />
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1.5">
            <span className="truncate font-medium text-fg">{v.name}</span>
            <span className="flex-shrink-0 font-mono-timecode text-[10px] text-fg/35">#{v.tag}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-fg/45">
            <Icon name={isPhone(v.device) ? "phone" : "monitor"} size={12} />
            <span className="truncate">{v.device || "Unknown device"}</span>
            {v.language !== "English" && <><span aria-hidden>·</span><span>{v.language}</span></>}
          </p>
        </div>
        <Icon name="chevron-right" size={16} className="flex-shrink-0 text-fg/25 transition-transform group-hover:translate-x-0.5 group-hover:text-fg/60" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Asked" value={v.questions} cls="text-fg" />
        <Stat label="Answered" value={v.answered} cls="text-verified-400" />
        <Stat label="Refused" value={v.refused} cls={v.refused ? "text-rec-300" : "text-fg/40"} />
      </div>

      <p className={`mt-3 line-clamp-2 min-h-[2.5rem] text-[13px] leading-snug ${v.lastQuestion ? "text-fg/70" : "italic text-fg/35"}`}>
        {v.lastQuestion ? <>&ldquo;{v.lastQuestion}&rdquo;</> : "Opened the link — hasn't asked anything yet"}
      </p>

      <p className="mt-auto flex items-center justify-between gap-2 border-t border-tint/[0.06] pt-3 text-[11px] text-fg/40">
        <span className="flex items-center gap-1">
          <Icon name="clock" size={11} />
          {activeNow(v.lastSeen) ? <span className="text-verified-400">Active now</span> : `Active ${ago(v.lastSeen)}`}
        </span>
        <span>
          {v.visits} visit{v.visits === 1 ? "" : "s"} · since {new Date(v.firstSeen).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </span>
      </p>
    </button>
  );
}

function ConversationDrawer({
  twinId,
  session,
  profile,
  onClose,
}: {
  twinId: string;
  session: string;
  profile: ViewerProfile;
  onClose: () => void;
}) {
  const [data, setData] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/twins/${twinId}/viewers/${profile.id}`, { headers: authHeader(session) })
      .then(({ data }) => !cancelled && setData(data))
      .catch((err) => !cancelled && setError(errorMessage(err, "Couldn't load this conversation.")));
    return () => {
      cancelled = true;
    };
  }, [twinId, session, profile.id]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-stretch sm:justify-end" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewer-title"
        onClick={(e) => e.stopPropagation()}
        className="surface-solid flex max-h-[88dvh] w-full flex-col overflow-hidden !rounded-b-none animate-fade-up sm:max-h-none sm:max-w-md sm:!rounded-none sm:!rounded-l-[1.5rem]"
      >
        <div className="flex items-start gap-3 border-b border-tint/[0.06] p-5">
          <Avatar v={profile} size={52} />
          <div className="min-w-0 flex-1">
            <p id="viewer-title" className="flex items-baseline gap-2">
              <span className="truncate font-display text-xl font-semibold text-fg">{profile.name}</span>
              <span className="font-mono-timecode text-[11px] text-fg/35">#{profile.tag}</span>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-fg/50">
              <span className="flex items-center gap-1"><Icon name={isPhone(profile.device) ? "phone" : "monitor"} size={12} />{profile.device || "Unknown device"}</span>
              <span className="flex items-center gap-1"><Icon name="globe" size={12} />{profile.language}</span>
            </p>
            <p className="mt-1 text-[12px] text-fg/40">
              First seen {day(profile.firstSeen)} · {profile.visits} visit{profile.visits === 1 ? "" : "s"} · active {ago(profile.lastSeen)}
            </p>
          </div>
          <button ref={closeRef} onClick={onClose} className="btn btn-ghost btn-icon btn-sm -mr-1 -mt-1" aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 px-5 pt-4">
          <Stat label="Asked" value={profile.questions} cls="text-fg" />
          <Stat label="Answered" value={profile.answered} cls="text-verified-400" />
          <Stat label="Refused" value={profile.refused} cls={profile.refused ? "text-rec-300" : "text-fg/40"} />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-4" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
          <p className="mb-3 font-mono-timecode text-[10px] uppercase tracking-[0.16em] text-fg/35">Conversation</p>
          {error && <Alert>{error}</Alert>}
          {!data && !error && (
            <div className="space-y-3">
              <Skeleton className="ml-auto h-10 w-2/3 !rounded-2xl" />
              <Skeleton className="h-14 w-3/4 !rounded-2xl" />
              <Skeleton className="ml-auto h-10 w-1/2 !rounded-2xl" />
            </div>
          )}
          {data && data.messages.length === 0 && (
            <p className="rounded-xl border border-dashed border-tint/15 p-4 text-center text-sm text-fg/45">
              {profile.name} opened the link but hasn&apos;t asked anything yet.
            </p>
          )}
          {data && data.messages.length > 0 && (
            <ol className="space-y-2.5">
              {data.messages.map((m, i) => {
                const viewer = m.role === "viewer";
                return (
                  <li key={i} className={`flex flex-col ${viewer ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed ${
                        viewer
                          ? "rounded-br-md bg-gradient-to-br from-rec-400 to-rec-600 text-white"
                          : m.grounded
                          ? "rounded-bl-md border border-tint/[0.08] bg-tint/[0.05] text-fg/90"
                          : "rounded-bl-md border border-dashed border-cited-400/40 bg-cited-400/[0.06] text-fg/70"
                      }`}
                    >
                      {!viewer && !m.grounded && (
                        <span className="mb-0.5 flex items-center gap-1 font-mono-timecode text-[9.5px] uppercase tracking-[0.14em] text-cited-300">
                          <Icon name="shield" size={10} /> Refused
                        </span>
                      )}
                      {m.content}
                    </div>
                    <span className="mt-0.5 px-1 font-mono-timecode text-[10px] text-fg/30">
                      {new Date(m.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

const PAGE = 24;

/**
 * Analytics → "Your viewers": a small profile card for every person who
 * opened this twin's link and gave their name, newest activity first.
 * Clicking a card opens that person's full conversation.
 */
export default function ViewerProfiles({ twinId, session }: { twinId: string; session: string }) {
  const [viewers, setViewers] = useState<ViewerProfile[] | null>(null);
  const [activeToday, setActiveToday] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<ViewerProfile | null>(null);
  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/twins/${twinId}/viewers`, { headers: authHeader(session) })
      .then(({ data }) => {
        if (cancelled) return;
        setViewers(Array.isArray(data?.viewers) ? data.viewers : []);
        setActiveToday(Number(data?.activeToday) || 0);
      })
      .catch((err) => !cancelled && setError(errorMessage(err, "Couldn't load your viewers.")));
    return () => {
      cancelled = true;
    };
  }, [twinId, session]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (viewers ?? []).filter((v) => !q || v.name.toLowerCase().includes(q) || v.tag.startsWith(q.replace(/^#/, "")));
  }, [viewers, query]);

  return (
    <>
    <section className="surface p-5 sm:p-6 animate-fade-up" aria-labelledby="viewers-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p id="viewers-title" className="flex items-center gap-2 font-display text-lg font-semibold text-fg">
            <Icon name="users" size={18} className="text-coral-400" /> Your viewers
          </p>
          <p className="text-sm text-fg/45">Everyone who opened your twin link, by name. Tap a card to read their chat.</p>
          {viewers && viewers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="chip"><Icon name="users" size={12} /> {viewers.length} viewer{viewers.length === 1 ? "" : "s"}</span>
              <span className="chip !border-verified-500/25 !text-verified-400"><span className="h-1.5 w-1.5 rounded-full bg-verified-500" /> {activeToday} active today</span>
            </div>
          )}
        </div>
        {viewers && viewers.length > 0 && (
          <label className="relative block w-full sm:w-64">
            <Icon name="search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg/35" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShown(PAGE);
              }}
              placeholder="Search by name"
              aria-label="Search viewers by name"
              className="field w-full !pl-9"
            />
          </label>
        )}
      </div>

      <div className="mt-5">
        {error && <Alert>{error}</Alert>}
        {!viewers && !error && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="surface space-y-3 p-4">
                <div className="flex items-center gap-3"><Skeleton className="h-11 w-11 !rounded-full" /><Skeleton className="h-4 w-32" /></div>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        )}
        {viewers && viewers.length === 0 && (
          <EmptyState
            icon="users"
            title="No viewers yet"
            body="When someone opens your twin's link from a video description and enters their name, they show up here."
          />
        )}
        {viewers && viewers.length > 0 && filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-tint/15 p-6 text-center text-sm text-fg/45">No viewer matches &ldquo;{query}&rdquo;.</p>
        )}
        {filtered.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.slice(0, shown).map((v) => (
              <ProfileCard key={v.id} v={v} onOpen={() => setOpen(v)} />
            ))}
          </div>
        )}
        {filtered.length > shown && (
          <button onClick={() => setShown((n) => n + PAGE * 2)} className="btn btn-secondary mx-auto mt-5 flex">
            Show more <span className="text-fg/45">({filtered.length - shown} left)</span>
          </button>
        )}
      </div>

    </section>
    {/* Outside the section: its entrance animation uses a transform,
        which would trap this fixed overlay inside the card. */}
    {open && <ConversationDrawer twinId={twinId} session={session} profile={open} onClose={close} />}
    </>
  );
}

