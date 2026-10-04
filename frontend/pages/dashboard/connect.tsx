import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Script from "next/script";
import { api, authHeader } from "@/lib/api";
import { errorMessage, readJSON } from "@/lib/browser";
import AppShell from "@/components/AppShell";
import { StageHandoff, withStudio } from "@/components/StudioWorkspace";
import { Alert, Icon, PageHeader, Spinner } from "@/components/ui";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

declare global {
  interface Window {
    google?: any;
  }
}

type Creator = { id: string; displayName: string; handle: string; googleLinked: boolean };

export default function ConnectStep() {
  const router = useRouter();
  const [session, setSession] = useState<string | null>(null);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [gsiReady, setGsiReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [channelLoading, setChannelLoading] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);

  useEffect(() => {
    const s = localStorage.getItem("youtwin_session");
    const c = readJSON<Creator>("youtwin_creator");
    if (!s || !c) {
      router.replace("/login");
      return;
    }
    setSession(s);
    setCreator(c);
    // Refresh from the server: googleLinked in localStorage can be stale
    // (e.g. the Google account was linked or unlinked in another tab).
    api
      .get("/auth/me", { headers: authHeader(s) })
      .then(({ data }) => {
        if (data?.creator) {
          localStorage.setItem("youtwin_creator", JSON.stringify(data.creator));
          setCreator(data.creator);
        }
      })
      .catch(() => {});
    const cachedChannel = localStorage.getItem("youtwin_channel_name");
    if (cachedChannel) setChannelName(cachedChannel);
  }, [router]);

  function fetchChannelName() {
    if (!window.google?.accounts?.oauth2 || !GOOGLE_CLIENT_ID) {
      setChannelError("Google services aren't loaded yet — try again in a moment.");
      return;
    }
    setChannelError(null);
    setChannelLoading(true);

    const timeoutId = setTimeout(() => {
      setChannelLoading(false);
      setChannelError("Timed out — check that the Google popup wasn't blocked, then try again.");
    }, 30000);

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/youtube.readonly",
        callback: async (tokenResponse: { access_token?: string; error?: string }) => {
          clearTimeout(timeoutId);
          if (!tokenResponse?.access_token) {
            setChannelLoading(false);
            setChannelError("Couldn't get YouTube permission. Try again.");
            return;
          }
          try {
            const res = await fetch(
              "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
              { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
            );
            const json = await res.json();
            if (json?.error) {
              setChannelError(json.error.message ?? "YouTube API rejected the request.");
            } else {
              const title = json?.items?.[0]?.snippet?.title;
              if (title) {
                setChannelName(title);
                localStorage.setItem("youtwin_channel_name", title);
              } else {
                setChannelError("This Google account has no YouTube channel.");
              }
            }
          } catch {
            setChannelError("Couldn't reach the YouTube API. Try again.");
          } finally {
            setChannelLoading(false);
          }
        },
        error_callback: (err: { type?: string }) => {
          clearTimeout(timeoutId);
          setChannelLoading(false);
          setChannelError(
            err?.type === "popup_closed"
              ? "Popup closed before finishing. Try again."
              : "Popup was blocked — allow popups for localhost, then try again."
          );
        },
      });
      tokenClient.requestAccessToken();
    } catch {
      clearTimeout(timeoutId);
      setChannelLoading(false);
      setChannelError("Couldn't start Google authorization. Try again.");
    }
  }

  async function handleCredentialResponse(response: { credential: string }) {
    setAuthError(null);
    const s = localStorage.getItem("youtwin_session");
    if (!s) return;
    try {
      const { data } = await api.post("/auth/google", { idToken: response.credential }, { headers: authHeader(s) });
      localStorage.setItem("youtwin_creator", JSON.stringify(data.creator));
      setCreator(data.creator);
    } catch (err: any) {
      setAuthError(errorMessage(err, "Couldn't link that Google account. Try again."));
    }
  }

  useEffect(() => {
    if (!gsiReady || !GOOGLE_CLIENT_ID || !creator || creator.googleLinked) return;
    if (!window.google) return;
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredentialResponse });
    window.google.accounts.id.renderButton(document.getElementById("google-signin-button"), { theme: "filled_black", size: "large", width: 300, shape: "pill" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gsiReady, creator]);

  if (!creator) return null;
  const linked = creator.googleLinked;
  const ringColor = linked ? "#10B981" : "#FF8266";

  return (
    <AppShell setupStep={1} title="Connect channel" accent={linked ? "#10B981" : "#C8302B"} accent2="#E0AE4E">
      {GOOGLE_CLIENT_ID && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGsiReady(true)} />}

      <PageHeader
        compact
        title="Connect your channel"
        description={<>Signed in as <span className="text-fg/85">{creator.displayName}</span> — now authorize channel access.</>}
      />

      <div className="mt-7 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Action card */}
        <div className="surface flex flex-col p-6 sm:p-8 animate-fade-up" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b from-[#FF3B30] to-[#C8302B] text-white shadow-glow">
              <Icon name="youtube" size={20} />
            </span>
            <div>
              <p className="font-medium text-fg">YouTube channel access</p>
              <p className="text-sm text-fg/50">{linked ? "Authorized" : "Not connected yet"}</p>
            </div>
            <span
              className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                linked ? "bg-verified-500/10 text-verified-400 ring-1 ring-verified-500/30" : "bg-tint/[0.05] text-fg/55 ring-1 ring-tint/10"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${linked ? "bg-verified-500" : "bg-fg/40"}`} />
              {linked ? "Connected" : "Pending"}
            </span>
          </div>

          <div className="hairline my-6" />

          {!linked ? (
            GOOGLE_CLIENT_ID ? (
              <div className="flex flex-col items-start gap-4">
                <p className="text-sm leading-relaxed text-fg/60">
                  This links a real Google account so YouTwin can read your channel&apos;s videos — separate from your YouTwin login.
                </p>
                <div className="min-h-[44px] rounded-full" id="google-signin-button" />
                {!gsiReady && (
                  <p className="flex items-center gap-2 text-xs text-fg/45"><Spinner size={14} /> Loading Google Sign-In…</p>
                )}
                {authError && <Alert>{authError}</Alert>}
              </div>
            ) : (
              <Alert tone="info">
                <p className="font-medium">Google Sign-In isn&apos;t configured yet.</p>
                <p className="mt-1 text-fg/60">
                  Set <code className="rounded bg-sunk/30 px-1.5 py-0.5 font-mono-timecode text-[12px]">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in{" "}
                  <code className="rounded bg-sunk/30 px-1.5 py-0.5 font-mono-timecode text-[12px]">frontend/.env.local</code>, then restart the frontend.
                </p>
              </Alert>
            )
          ) : (
            <div className="flex flex-col gap-4">
              <Alert tone="success">Channel access authorized</Alert>
              {channelName ? (
                <div className="flex items-center gap-3 rounded-xl border border-tint/10 bg-tint/[0.03] p-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rec-500/15 text-rec-400">
                    <Icon name="play" size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-fg/45">Linked channel</p>
                    <p className="truncate text-sm font-medium text-fg">{channelName}</p>
                  </div>
                  <Icon name="check-circle" size={18} className="ml-auto text-verified-500" />
                </div>
              ) : channelLoading ? (
                <p className="flex items-center gap-2 text-sm text-fg/60"><Spinner size={15} /> Waiting for Google permission…</p>
              ) : (
                <div className="flex flex-col items-start gap-2">
                  <button onClick={fetchChannelName} className="btn btn-secondary">
                    <Icon name="youtube" size={16} /> Show my YouTube channel name
                  </button>
                  {channelError && <Alert>{channelError}</Alert>}
                </div>
              )}
              <Link href="/dashboard/twins" className="inline-flex w-fit items-center gap-1.5 text-sm text-coral-400 hover:text-coral-300">
                Managing multiple videos? See all your twins <Icon name="arrow-right" size={14} />
              </Link>
            </div>
          )}

        </div>

        {/* Linking visual */}
        <div className="surface-solid relative flex min-h-[380px] flex-col items-center justify-center overflow-hidden p-8 animate-fade-up" style={{ animationDelay: "160ms" }}>
          <div className="absolute inset-0 bg-dots opacity-40" />
          <div className="absolute h-72 w-72 rounded-full blur-[80px] opacity-40 transition-colors duration-700" style={{ background: ringColor }} />
          <div className="relative flex items-center">
            <div
              className={`flex h-28 w-28 items-center justify-center rounded-3xl border bg-gradient-to-b from-night-700 to-night-900 shadow-lift transition-all duration-700 ${
                linked ? "translate-x-3 border-verified-500/40" : "border-tint/10"
              }`}
            >
              <Logo />
            </div>
            <div className="relative mx-2 h-px w-16">
              <div className={`absolute inset-0 transition-all duration-700 ${linked ? "bg-gradient-to-r from-verified-400 to-verified-500 shadow-[0_0_12px_#10B981]" : "border-t border-dashed border-tint/20"}`} />
              <span
                className={`absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border transition-all duration-700 ${
                  linked ? "border-verified-500 bg-verified-500 text-white shadow-glow-green" : "border-tint/15 bg-night-800 text-fg/40"
                }`}
              >
                <Icon name={linked ? "check" : "link"} size={13} strokeWidth={2.25} />
              </span>
            </div>
            <div
              className={`flex h-28 w-28 items-center justify-center rounded-3xl border bg-gradient-to-b from-night-700 to-night-900 shadow-lift transition-all duration-700 ${
                linked ? "-translate-x-3 border-verified-500/40" : "border-tint/10"
              }`}
            >
              <span className="flex h-12 w-16 items-center justify-center rounded-xl bg-gradient-to-b from-[#FF3B30] to-[#C8302B] text-white shadow-glow">
                <Icon name="play" size={20} />
              </span>
            </div>
          </div>
          <p className="relative mt-10 font-display text-lg font-semibold text-fg">{linked ? "Linked and ready" : "Waiting for authorization"}</p>
          <ul className="relative mt-5 w-full max-w-xs space-y-2.5 text-sm text-fg/55">
            {[
              ["eye", "Read-only access to your channel's videos"],
              ["lock", "Separate from your YouTwin login"],
              ["upload", "Uploads always ask for their own permission"],
            ].map(([ic, t]) => (
              <li key={t} className="flex items-center gap-2.5">
                <Icon name={ic} size={15} className="text-fg/35" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <StageHandoff
        done={linked}
        doneTitle="Channel connected"
        doneBody={channelName ? `Your twin will learn from ${channelName}.` : "YouTube access is authorized for this account."}
        pendingHint="Authorize YouTube access to continue."
        nextHref="/dashboard/train"
        nextLabel="Continue to Knowledge"
      />
    </AppShell>
  );
}

ConnectStep.getLayout = withStudio;

function Logo() {
  return (
    <svg width="44" height="44" viewBox="0 0 40 40" fill="none" aria-hidden>
      <path d="M12 12L20 20L12 28" stroke="currentColor" className="text-fg" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 12L20 20L28 28" stroke="#E0483F" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
