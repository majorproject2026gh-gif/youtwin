import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Script from "next/script";
import { api, authHeader, logout } from "@/lib/api";
import Logo from "@/components/Logo";

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
    const c = localStorage.getItem("youtwin_creator");
    if (!s || !c) {
      router.replace("/login");
      return;
    }
    setSession(s);
    setCreator(JSON.parse(c));
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
      setAuthError(err?.response?.data?.error ?? "Couldn't link that Google account. Try again.");
    }
  }

  useEffect(() => {
    if (!gsiReady || !GOOGLE_CLIENT_ID || !creator || creator.googleLinked) return;
    if (!window.google) return;
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredentialResponse });
    window.google.accounts.id.renderButton(document.getElementById("google-signin-button"), { theme: "filled_black", size: "large", width: 300 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gsiReady, creator]);

  if (!creator) return null;
  const linked = creator.googleLinked;
  const ringColor = linked ? "#10B981" : "#FF8266";

  return (
    <div className="min-h-screen relative overflow-hidden bg-ink-950 flex flex-col">
      {GOOGLE_CLIENT_ID && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGsiReady(true)} />}

      <div className="bg-orb-a pointer-events-none absolute -left-32 top-[15%] h-[520px] w-[520px] rounded-full opacity-40 blur-[120px]" style={{ background: `radial-gradient(circle, ${ringColor} 0%, transparent 70%)` }} />
      <div className="bg-orb-b pointer-events-none absolute right-[-20%] bottom-[10%] h-[480px] w-[480px] rounded-full opacity-30 blur-[120px]" style={{ background: "radial-gradient(circle, #D9A441 0%, transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />

      <nav className="relative flex items-center justify-between px-8 py-6">
        <Link href="/home"><Logo dark /></Link>
        <button onClick={async () => { await logout(); router.push("/login"); }} className="glass-pill rounded-full border border-white/15 px-4 py-2 text-xs text-paper-300 hover:bg-white/10 transition-colors">
          Log out
        </button>
      </nav>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        <span className="font-mono-timecode text-xs tracking-[0.25em] text-paper-300 mb-4">STEP 1 OF 4 &middot; CONNECT</span>
        <h1 className="font-display text-5xl sm:text-6xl font-bold text-paper-100 mb-3">Connect your channel</h1>
        <p className="text-lg text-paper-300 mb-12 max-w-md">
          Signed in as {creator.displayName} — now authorize channel access.
        </p>

        {/* Two-ring "linking" visual — unlinked shows separate dashed
            rings, linked shows them merged and glowing solid. */}
        <div className="relative flex items-center justify-center mb-10 h-[220px] w-[260px]">
          <div className="absolute h-64 w-64 rounded-full blur-[60px] opacity-40 transition-colors duration-700" style={{ background: ringColor }} />
          <svg width="260" height="180" viewBox="0 0 260 180" className="relative">
            <circle cx="95" cy="90" r="70" fill="none" stroke={linked ? ringColor : "rgba(255,255,255,0.15)"} strokeWidth="8" strokeDasharray={linked ? undefined : "6 8"} style={{ transition: "all 0.6s ease" }} />
            <circle cx="165" cy="90" r="70" fill="none" stroke={linked ? ringColor : "rgba(255,255,255,0.15)"} strokeWidth="8" strokeDasharray={linked ? undefined : "6 8"} style={{ transition: "all 0.6s ease" }} />
          </svg>
          <div className="absolute flex flex-col items-center">
            {linked ? <span className="text-5xl">✓</span> : <span className="text-3xl">🎬</span>}
          </div>
        </div>

        <div className="w-full max-w-md">
          {!linked ? (
            GOOGLE_CLIENT_ID ? (
              <div className="glass-panel rounded-2xl border border-white/15 bg-white/10 p-6 flex flex-col items-center gap-3">
                <div id="google-signin-button" />
                {authError && <p className="text-sm text-rec-400">{authError}</p>}
                <p className="text-xs text-paper-300/70 max-w-xs">
                  This links a real Google account so YouTwin can read your channel&apos;s videos —
                  separate from your YouTwin login.
                </p>
              </div>
            ) : (
              <div className="glass-panel rounded-2xl border border-white/15 bg-white/10 p-6 text-sm text-paper-300 space-y-2">
                <p className="font-medium text-rec-400">Google Sign-In isn&apos;t configured yet.</p>
                <p>Set <code className="bg-black/30 px-1 rounded">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in <code className="bg-black/30 px-1 rounded">frontend/.env.local</code>, then restart the frontend.</p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="text-lg font-medium text-paper-100">Channel access authorized</p>
              <Link href="/dashboard/create-video" className="text-sm text-cited-400 underline hover:text-cited-300">
                Or, create an AI video for your channel →
              </Link>
              {channelName ? (
                <div className="glass-pill flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2">
                  <span className="text-rec-500">▶</span>
                  <span className="text-sm font-medium text-paper-100">{channelName}</span>
                </div>
              ) : channelLoading ? (
                <p className="text-sm text-paper-300">Waiting for Google permission…</p>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <button onClick={fetchChannelName} className="glass-pill rounded-full border border-white/15 px-4 py-2 text-sm text-paper-300 hover:bg-white/10 transition-colors">
                    ▶ Show my YouTube channel name
                  </button>
                  {channelError && <p className="max-w-xs text-xs leading-relaxed text-rec-400">{channelError}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-14 flex items-center gap-4">
          <span />
          <button
            onClick={() => router.push("/dashboard/train")}
            disabled={!linked}
            className="rounded-full bg-gradient-to-r from-rec-500 to-rec-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rec-500/30 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 transition-all"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
