import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { api, resolveTwin } from "@/lib/api";
import { errorMessage } from "@/lib/browser";
import { cleanName, loadViewer, saveViewerName, ViewerIdentity } from "@/lib/viewer";
import ViewerShell from "@/components/ViewerShell";
import Logo from "@/components/Logo";
import { Alert, Eyebrow, Icon, Spinner } from "@/components/ui";

/** Carry a deep link's ?v=&t= playtime context through the viewer steps. */
function playtimeQuery(q: Record<string, string | string[] | undefined>): string {
  const p = new URLSearchParams();
  if (typeof q.v === "string" && /^[A-Za-z0-9_-]{11}$/.test(q.v)) p.set("v", q.v);
  if (typeof q.t === "string" && /^[0-9hms]{1,12}$/.test(q.t)) p.set("t", q.t);
  const s = p.toString();
  return s ? `?${s}` : "";
}

const firstName = (name: string) => name.split(" ")[0];

/**
 * The page the link in a video description opens: the viewer says who
 * they are once, then the chat opens. The name (plus a random device id)
 * is remembered on this device, and the creator sees each viewer by name
 * in Analytics.
 */
export default function NameStep() {
  const router = useRouter();
  const { handle } = router.query as { handle?: string };
  const [twinId, setTwinId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState<ViewerIdentity | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const v = loadViewer();
    setSaved(v);
    setName(v?.name ?? "");
    setEditing(!v || router.query.change === "1");
  }, [router.isReady, router.query.change]);

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    resolveTwin(handle)
      .then((d) => {
        if (cancelled) return;
        setTwinId(d.twinId);
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(
            err?.response?.status === 404
              ? "We couldn't find a twin at this link. Check the link in the video description and try again."
              : errorMessage(err, "Couldn't open this twin right now. Try again in a moment."),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function start(chosen: string) {
    if (busy || !twinId) return;
    const clean = cleanName(chosen);
    if (!clean) {
      setError("Please enter your name: 2 to 40 letters.");
      return;
    }
    setBusy(true);
    setError(null);
    const viewer = saveViewerName(clean);
    try {
      await api.post(`/chat/${twinId}/viewer`, { viewerId: viewer.id, name: viewer.name });
    } catch (err: any) {
      // A rejected name must be fixed; a network blip must not block the
      // chat (the first question registers the viewer anyway).
      if (err?.response?.status === 400) {
        setError(errorMessage(err, "Please enter a different name."));
        setBusy(false);
        return;
      }
    }
    router.push(`/twin/${handle}/chat${playtimeQuery(router.query)}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void start(name);
  }

  const preview = cleanName(name) ? firstName(cleanName(name)!) : "there";

  return (
    <ViewerShell step={2} accent="#C8302B" accent2="#E0AE4E" accent3="#2DD4BF">
      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:gap-20 lg:py-14">
        <div className="mx-auto w-full max-w-md animate-fade-up lg:mx-0">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <span className="relative">
              <span className="flex rounded-[20px] shadow-[0_12px_40px_-10px_rgba(224,72,63,0.6)]">
                <Logo size={72} withWordmark={false} />
              </span>
              <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-verified-500 ring-4 ring-[rgb(var(--canvas))]" />
            </span>
            <Eyebrow className="mt-6">Step 2 of 4 · Say hi</Eyebrow>
            <h1 className="mt-4 font-display text-[2.1rem] font-semibold leading-[1.05] tracking-tightest sm:text-5xl">
              <span className="text-gradient-soft">Chat with my</span>{" "}
              <span className="font-serif italic font-normal text-gradient">YouTwin</span>
            </h1>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-fg/55">
              Answers come from my real videos, with the exact moment cited.
            </p>
          </div>

          {loadError ? (
            <div className="mt-8"><Alert>{loadError}</Alert></div>
          ) : (
            <div className="surface-solid mt-8 p-5 sm:p-6">
              {!editing && saved ? (
                <div className="animate-fade-up">
                  <p className="text-sm text-fg/55">Welcome back,</p>
                  <p className="mt-0.5 font-display text-2xl font-semibold text-fg">{saved.name}</p>
                  <button onClick={() => start(saved.name)} disabled={busy || !twinId} className="btn btn-primary btn-xl mt-5 w-full">
                    {busy ? <Spinner size={16} /> : null} Continue as {firstName(saved.name)} <Icon name="arrow-right" size={17} strokeWidth={2.25} />
                  </button>
                  <button onClick={() => setEditing(true)} className="btn btn-ghost btn-sm mx-auto mt-3 flex">
                    Not {firstName(saved.name)}? Use a different name
                  </button>
                </div>
              ) : (
                <form onSubmit={onSubmit} noValidate className="animate-fade-up">
                  <label htmlFor="viewer-name" className="text-sm font-medium text-fg">What&apos;s your name?</label>
                  <input
                    id="viewer-name"
                    ref={inputRef}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError(null);
                    }}
                    maxLength={40}
                    autoComplete="given-name"
                    enterKeyHint="go"
                    placeholder="e.g. Rahul"
                    aria-invalid={!!error}
                    aria-describedby={error ? "viewer-name-error" : undefined}
                    className={`field mt-2 w-full !text-base ${error ? "field-invalid" : ""}`}
                  />
                  {error && (
                    <p id="viewer-name-error" role="alert" className="mt-2 flex items-center gap-1.5 text-[13px] text-rec-300">
                      <Icon name="alert" size={13} /> {error}
                    </p>
                  )}
                  <button type="submit" disabled={busy || !twinId} className="btn btn-primary btn-xl mt-4 w-full">
                    {busy ? <Spinner size={16} /> : null} Start chatting <Icon name="arrow-right" size={17} strokeWidth={2.25} />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Live preview: the greeting updates as the name is typed */}
        <div className="relative hidden animate-fade-up lg:block" style={{ animationDelay: "140ms" }} aria-hidden>
          <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-gradient-to-br from-rec-500/20 via-coral-400/10 to-cited-400/15 blur-3xl" />
          <div className="surface-solid border-gradient overflow-hidden rounded-[1.5rem]">
            <div className="flex items-center gap-3 border-b border-tint/[0.06] px-5 py-4">
              <Logo size={36} withWordmark={false} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">My YouTwin</p>
                <p className="flex items-center gap-1.5 text-[11px] text-fg/45">
                  <span className="h-1.5 w-1.5 rounded-full bg-verified-500 animate-glow" /> Active now · AI twin
                </p>
              </div>
            </div>
            <div className="space-y-3 px-5 py-6">
              <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-md border border-tint/[0.08] bg-tint/[0.05] px-4 py-3 text-[15px] text-fg/90">
                Hi <span className="font-semibold text-fg">{preview}</span>! Ask me anything from my videos.
              </div>
              <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-rec-400 to-rec-600 px-4 py-2.5 text-[15px] text-white">
                What camera do you use?
              </div>
              <div className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-md border border-tint/[0.08] bg-tint/[0.05] px-4 py-3">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-fg/60" style={{ animationDelay: "0ms" }} />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-fg/60" style={{ animationDelay: "150ms" }} />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-fg/60" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-tint/[0.06] px-5 py-3 font-mono-timecode text-[10.5px] text-fg/40">
              <Icon name="play" size={10} className="text-cited-400" /> Every answer links to the exact second in the video
            </div>
          </div>
        </div>
      </div>
    </ViewerShell>
  );
}
