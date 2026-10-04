import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { api, authHeader } from "@/lib/api";
import AppShell, { withAppFrame } from "@/components/AppShell";
import { copyText, errorMessage } from "@/lib/browser";
import { Alert, EmptyState, Icon, PageHeader, Skeleton, spotlight } from "@/components/ui";

interface TwinRow {
  id: string;
  channelId: string | null;
  status: string;
  createdAt: string;
}

/** A twin still "training" after this long is treated as stuck (matches the API). */
const STUCK_AFTER_MS = 30 * 60 * 1000;

function isUnfinished(t: TwinRow): boolean {
  if (t.status === "ready") return false;
  if (t.status === "error") return true;
  return Date.now() - new Date(t.createdAt).getTime() > STUCK_AFTER_MS;
}

type PendingDelete =
  | { kind: "one"; twin: TwinRow; label: string }
  | { kind: "unfinished"; count: number }
  | { kind: "all"; count: number };

/** Drop local pointers to twins that no longer exist. */
function forgetLocalTwins(ids: Set<string> | "all") {
  const gone = (id: string | null | undefined) => !!id && (ids === "all" || ids.has(id));
  try {
    if (gone(localStorage.getItem("youtwin_twinId"))) localStorage.removeItem("youtwin_twinId");
    const studio = localStorage.getItem("youtwin_studio");
    if (studio && gone(JSON.parse(studio)?.twinId)) localStorage.removeItem("youtwin_studio");
  } catch {
    /* storage unavailable or malformed — nothing to clean */
  }
}

export default function MyTwinsPage() {
  const router = useRouter();
  const [twins, setTwins] = useState<TwinRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.host), []);
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const s = localStorage.getItem("youtwin_session");
    if (!s) {
      router.replace("/login");
      return;
    }
    api
      .get("/twins/mine", { headers: authHeader(s) })
      .then(({ data }) => setTwins(Array.isArray(data?.twins) ? data.twins : []))
      .catch((err) => setError(errorMessage(err, "Couldn't load your twins.")));
  }, [router]);

  function copyLink(twinId: string) {
    // The site's real address, so the link works when pasted into a video
    // description (a hard-coded youtwin.ai link would not open).
    void copyText(`${window.location.origin}/twin/${twinId}`);
    setCopiedId(twinId);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function askDelete(p: PendingDelete) {
    setPending(p);
    setConfirmText("");
    setDeleteError(null);
    setNotice(null);
  }

  function closeDialog() {
    if (busy) return;
    setPending(null);
  }

  useEffect(() => {
    if (!pending) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDialog();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, busy]);

  async function confirmDelete() {
    if (!pending || busy) return;
    const s = localStorage.getItem("youtwin_session");
    if (!s) {
      router.replace("/login");
      return;
    }
    setBusy(true);
    setDeleteError(null);
    try {
      let deletedIds: Set<string> | "all";
      let deleted = 0;
      let cleanupFailed = false;
      if (pending.kind === "one") {
        const { data } = await api.delete(`/twins/${pending.twin.id}`, { headers: authHeader(s) });
        deletedIds = new Set([pending.twin.id]);
        deleted = data?.deleted ?? 1;
        cleanupFailed = !!data?.cleanupFailed;
      } else {
        const { data } = await api.post("/twins/bulk-delete", { scope: pending.kind }, { headers: authHeader(s) });
        deletedIds = pending.kind === "all" ? "all" : new Set<string>(Array.isArray(data?.ids) ? data.ids : []);
        deleted = data?.deleted ?? 0;
        cleanupFailed = !!data?.cleanupFailed;
        if (pending.kind === "unfinished" && !Array.isArray(data?.ids)) {
          // Older API without ids in the response: fall back to the same rule locally.
          deletedIds = new Set((twins ?? []).filter(isUnfinished).map((t) => t.id));
        }
      }
      setTwins((prev) => (prev ? prev.filter((t) => !(deletedIds === "all" || deletedIds.has(t.id))) : prev));
      forgetLocalTwins(deletedIds);
      setNotice(
        `Deleted ${deleted} twin${deleted === 1 ? "" : "s"}.` +
          (cleanupFailed ? " (The AI service was unreachable, so some index data stayed behind — it is no longer linked to anything.)" : "")
      );
      setPending(null);
    } catch (err) {
      setDeleteError(errorMessage(err, "Couldn't delete. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  function newTwin() {
    localStorage.removeItem("youtwin_twinId");
    router.push(`/dashboard/train?fresh=${Date.now()}`);
  }

  const readyCount = twins?.filter((t) => t.status === "ready").length ?? 0;
  const unfinishedCount = twins?.filter(isUnfinished).length ?? 0;
  const needsTyping = pending?.kind === "all";
  const canConfirm = !busy && (!needsTyping || confirmText.trim().toUpperCase() === "DELETE");

  return (
    <AppShell title="My Twins" accent="#2DD4BF" accent2="#E0AE4E" accent3="#C8302B">
      <PageHeader
        eyebrow="Library"
        eyebrowTone="teal"
        title="My Twins"
        description="Every twin you've trained, each with its own permanent link — one per video."
        actions={
          <>
            <button onClick={() => router.push("/dashboard/connect")} className="btn btn-secondary">
              <Icon name="arrow-left" size={15} /> Back to dashboard
            </button>
            <button onClick={newTwin} className="btn btn-primary">
              <Icon name="plus" size={15} strokeWidth={2.25} /> Train another video
            </button>
          </>
        }
      />

      {twins && twins.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-3 animate-fade-up">
          <span className="chip"><Icon name="twins" size={13} /> {twins.length} twin{twins.length === 1 ? "" : "s"}</span>
          <span className="chip !border-verified-500/25 !text-verified-400"><span className="h-1.5 w-1.5 rounded-full bg-verified-500" /> {readyCount} live</span>
          {twins.length - readyCount > 0 && (
            <span className="chip !border-cited-400/25 !text-cited-300"><span className="h-1.5 w-1.5 rounded-full bg-cited-400" /> {twins.length - readyCount} in progress / failed</span>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            {unfinishedCount > 0 && (
              <button onClick={() => askDelete({ kind: "unfinished", count: unfinishedCount })} className="btn btn-secondary btn-sm">
                <Icon name="trash" size={14} /> Clean up unfinished ({unfinishedCount})
              </button>
            )}
            <button onClick={() => askDelete({ kind: "all", count: twins.length })} className="btn btn-danger btn-sm">
              <Icon name="trash" size={14} /> Delete all
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-verified-500/25 bg-verified-500/[0.06] px-4 py-2.5 text-sm text-verified-400 animate-fade-up">
          <Icon name="check" size={15} /> {notice}
        </div>
      )}

      <div className="mt-8">
        {error && <Alert>{error}</Alert>}

        {!twins && !error && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="surface space-y-4 p-5">
                <Skeleton className="h-28 w-full !rounded-xl" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        )}

        {twins && twins.length === 0 && (
          <EmptyState
            icon="twins"
            title="You haven't trained a twin yet"
            body="Train your first twin on a video or channel — it takes a few minutes and gets its own shareable link."
            action={
              <Link href="/dashboard/train" className="btn btn-primary">
                Start now <Icon name="arrow-right" size={15} strokeWidth={2.25} />
              </Link>
            }
          />
        )}

        {twins && twins.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {twins.map((t, i) => {
              const ready = t.status === "ready";
              const failed = t.status === "error";
              return (
                <div
                  key={t.id}
                  onMouseMove={spotlight}
                  className="surface surface-interactive spotlight group flex flex-col overflow-hidden p-2 animate-fade-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {/* Thumbnail */}
                  <div className="force-dark relative h-32 overflow-hidden rounded-[0.9rem] bg-[#08080A]">
                    <div
                      className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                      style={{
                        background: failed
                          ? "radial-gradient(ellipse at 30% 20%, rgba(224,72,63,0.5), transparent 60%), linear-gradient(135deg,#1a0d0d,#0b0b0e)"
                          : ready
                          ? `radial-gradient(ellipse at ${20 + ((i * 37) % 60)}% 20%, rgba(242,96,63,0.5), transparent 60%), radial-gradient(ellipse at 90% 100%, rgba(224,174,78,0.35), transparent 60%), linear-gradient(135deg,#1a0f0d,#0b0b0e)`
                          : "radial-gradient(ellipse at 50% 30%, rgba(224,174,78,0.4), transparent 60%), linear-gradient(135deg,#17130b,#0b0b0e)",
                      }}
                    />
                    <div className="absolute inset-0 bg-dots opacity-25" />
                    <span className="absolute left-3 top-3 font-display text-3xl font-semibold text-fg/90">#{twins.length - i}</span>
                    <span
                      className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono-timecode text-[10px] backdrop-blur ${
                        ready
                          ? "bg-verified-500/20 text-verified-400 ring-1 ring-verified-500/40"
                          : failed
                          ? "bg-rec-500/20 text-rec-300 ring-1 ring-rec-500/40"
                          : "bg-cited-400/20 text-cited-300 ring-1 ring-cited-400/40"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${ready ? "bg-verified-500" : failed ? "bg-rec-400" : "bg-cited-400 animate-pulse"}`} />
                      {t.status.toUpperCase()}
                    </span>
                    {ready && (
                      <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-rec-500 opacity-0 shadow-lift transition-all duration-300 group-hover:opacity-100">
                        <Icon name="play" size={13} />
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col px-3 pb-2 pt-4">
                    <p className="font-medium text-fg">Twin #{twins.length - i}</p>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-fg/45">
                      <Icon name={t.channelId ? "youtube" : "sparkles"} size={12} />
                      <span className="truncate">{t.channelId || "Sample data"}</span>
                      <span>·</span>
                      <Icon name="calendar" size={12} />
                      {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                    <p className="mt-3 truncate rounded-lg border border-tint/[0.06] bg-tint/[0.03] px-2.5 py-1.5 font-mono-timecode text-[11px] text-cited-300">
                      {host}/twin/{t.id}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <button onClick={() => copyLink(t.id)} className={`btn btn-sm flex-1 ${copiedId === t.id ? "btn-green" : "btn-secondary"}`}>
                        <Icon name={copiedId === t.id ? "check" : "copy"} size={14} />
                        {copiedId === t.id ? "Copied!" : "Copy link"}
                      </button>
                      {ready && (
                        <a href={`/twin/${t.id}`} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm flex-1">
                          Preview <Icon name="arrow-up-right" size={14} />
                        </a>
                      )}
                      <button
                        onClick={() => askDelete({ kind: "one", twin: t, label: `Twin #${twins.length - i}` })}
                        className="btn btn-ghost btn-icon btn-sm text-fg/50 hover:!text-rec-300"
                        aria-label={`Delete twin #${twins.length - i}`}
                        title="Delete twin"
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              onClick={newTwin}
              className="group flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-[1.25rem] border border-dashed border-tint/15 text-fg/45 transition-all hover:border-coral-400/50 hover:bg-coral-400/[0.03] hover:text-fg/80"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-tint/10 bg-tint/[0.04] transition-transform duration-300 group-hover:scale-110 group-hover:text-coral-400">
                <Icon name="plus" size={20} />
              </span>
              <span className="text-sm font-medium">Train another video</span>
            </button>
          </div>
        )}
      </div>

      {pending && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center" onClick={closeDialog}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            aria-describedby="delete-body"
            className="surface-solid w-full max-w-md p-6 animate-fade-up"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-rec-500/15 text-rec-300">
                <Icon name="trash" size={18} />
              </span>
              <div>
                <p id="delete-title" className="font-display text-lg font-semibold text-fg">
                  {pending.kind === "one"
                    ? `Delete ${pending.label}?`
                    : pending.kind === "unfinished"
                    ? `Delete ${pending.count} unfinished twin${pending.count === 1 ? "" : "s"}?`
                    : `Delete all ${pending.count} twins?`}
                </p>
                <p id="delete-body" className="mt-1.5 text-sm text-fg/65">
                  {pending.kind === "one"
                    ? "Its share link stops working and its chat history and AI index are removed."
                    : pending.kind === "unfinished"
                    ? "Removes every twin that failed or has been stuck in training for over 30 minutes. Live twins are kept."
                    : "Removes every twin you own, including live ones. All their share links stop working."}{" "}
                  This can&apos;t be undone.
                </p>
              </div>
            </div>

            {needsTyping && (
              <label className="mt-5 block text-sm text-fg/70">
                Type <strong className="font-mono-timecode text-fg">DELETE</strong> to confirm
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canConfirm && confirmDelete()}
                  className="field mt-2 w-full"
                  autoComplete="off"
                  aria-label="Type DELETE to confirm"
                />
              </label>
            )}

            {deleteError && <div className="mt-4"><Alert>{deleteError}</Alert></div>}

            <div className="mt-6 flex justify-end gap-2">
              <button ref={cancelRef} onClick={closeDialog} disabled={busy} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={!canConfirm} className="btn btn-danger">
                <Icon name="trash" size={15} /> {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

MyTwinsPage.getLayout = withAppFrame;
