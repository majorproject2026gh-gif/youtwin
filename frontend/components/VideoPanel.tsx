import { useEffect, useRef, useState } from "react";
import { Citation } from "@/lib/api";

// Real ingested videos carry a bare 11-char YouTube ID (v=XXXX, youtu.be/XXXX,
// /shorts/XXXX are all normalized down to this in ingestion.py's
// _extract_video_id). The bundled sample/demo transcripts use fake IDs like
// "sample001" so the whole pipeline can run offline — those obviously can't
// be embedded, so we detect and show a friendly fallback instead of a
// broken player.
function isEmbeddableYoutubeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/* ---------------------------------------------------------------------------
 * YouTube IFrame Player API
 *
 * The previous version re-mounted a plain <iframe> with a new ?start= on
 * every click, which reloaded the whole player each time. Using the IFrame
 * API instead keeps ONE player alive: a citation from the same video seeks
 * instantly (no reload, no buffering flash), a citation from another video
 * swaps in place — the same "find the exact second" feel as the reference.
 * ------------------------------------------------------------------------- */

type YTPlayer = {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void;
  getCurrentTime(): number;
  destroy(): void;
};

type YTNamespace = {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT as YTNamespace);
      };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      // e.g. an ad-blocker or school/office network blocking youtube.com —
      // reset so a later mount can retry, and let the panel show a link.
      s.onerror = () => {
        ytApiPromise = null;
        s.remove();
        reject(new Error("YouTube IFrame API failed to load"));
      };
      document.head.appendChild(s);
    });
  }
  return ytApiPromise;
}

// How long after a cited timestamp we still treat that moment as "playing"
// for the highlight in the list below the player.
const CITED_WINDOW_SECONDS = 45;

export default function VideoPanel({
  active,
  citations,
  onSelect,
  onClose,
}: {
  active: Citation;
  citations: Citation[];
  onSelect: (c: Citation) => void;
  onClose?: () => void;
}) {
  const embeddable = isEmbeddableYoutubeId(active.video_id);

  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const loadedIdRef = useRef<string | null>(null);
  const latestRef = useRef<Citation>(active);
  latestRef.current = active;

  const [now, setNow] = useState(0);
  const [embedBlocked, setEmbedBlocked] = useState(false);

  /** Point the (already-created) player at a citation. */
  function sync(c: Citation) {
    const p = playerRef.current;
    if (!p || !readyRef.current) return; // onReady will pick up latestRef
    if (!isEmbeddableYoutubeId(c.video_id)) {
      try {
        p.pauseVideo();
      } catch {
        /* nothing loaded yet */
      }
      return;
    }
    setEmbedBlocked(false);
    const start = Math.max(0, c.timestamp_seconds);
    if (loadedIdRef.current === c.video_id) {
      p.seekTo(start, true);
      p.playVideo();
    } else {
      loadedIdRef.current = c.video_id;
      p.loadVideoById({ videoId: c.video_id, startSeconds: start });
    }
  }

  // Create the player once for the lifetime of the panel. (Written to be
  // safe under React Strict Mode's mount → unmount → mount in dev.)
  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      // YT swaps the element it's given for an <iframe>, so hand it a node
      // React doesn't own rather than the ref'd div itself.
      const mount = document.createElement("div");
      hostRef.current.appendChild(mount);

      const first = latestRef.current;
      const firstOk = isEmbeddableYoutubeId(first.video_id);
      loadedIdRef.current = firstOk ? first.video_id : null;
      const createdFor = first;

      playerRef.current = new YT.Player(mount, {
        width: "100%",
        height: "100%",
        videoId: firstOk ? first.video_id : undefined,
        playerVars: {
          start: firstOk ? Math.floor(first.timestamp_seconds) : 0,
          autoplay: firstOk ? 1 : 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            readyRef.current = true;
            // The viewer may have clicked another citation while the API
            // script was still loading.
            if (latestRef.current !== createdFor) sync(latestRef.current);
          },
          onError: (e: { data: number }) => {
            // 100 = removed/private, 101/150 = creator disabled embedding
            if (e.data === 100 || e.data === 101 || e.data === 150) setEmbedBlocked(true);
          },
        },
      });
    }).catch(() => {
      if (!cancelled) setEmbedBlocked(true);
    });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* already gone */
      }
      playerRef.current = null;
      readyRef.current = false;
      loadedIdRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seek / swap whenever a different citation is selected. The parent
  // passes a fresh object on every click, so clicking the same badge
  // twice also re-seeks.
  useEffect(() => {
    sync(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Live playback position → "now" readout + "playing" highlight.
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || !readyRef.current) return;
      try {
        setNow(p.getCurrentTime() || 0);
      } catch {
        /* player mid-swap */
      }
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  const isPlayingMoment = (c: Citation) =>
    loadedIdRef.current === c.video_id &&
    now >= c.timestamp_seconds - 1 &&
    now <= c.timestamp_seconds + CITED_WINDOW_SECONDS;

  const ytLink = `https://www.youtube.com/watch?v=${active.video_id}&t=${Math.floor(active.timestamp_seconds)}s`;

  return (
    <div className="surface-solid w-full p-3 lg:sticky lg:top-24 animate-scale-in">
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <p className="font-mono-timecode text-[10px] uppercase tracking-[0.2em] text-cited-400">
          ● Explained here
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close video"
            className="btn btn-ghost btn-icon btn-sm !h-7 !w-7 text-[11px] text-fg/60 hover:bg-tint/10 hover:text-fg/90 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      <div className="force-dark relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <div ref={hostRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />

        {!embeddable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black px-6 text-center text-xs text-fg/50">
            This citation is from a sample/demo transcript, so there&apos;s no real YouTube video to play.
          </div>
        )}

        {embeddable && embedBlocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center">
            <p className="text-xs text-fg/60">This video can&apos;t be played inside YouTwin.</p>
            <a
              href={ytLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm"
            >
              Watch at {formatTime(active.timestamp_seconds)} on YouTube ↗
            </a>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="line-clamp-1 text-sm font-medium text-fg/90">{active.video_title}</p>
        <span className="flex-shrink-0 font-mono-timecode text-[11px] text-cited-400">
          {formatTime(active.timestamp_seconds)}
        </span>
      </div>
      {active.snippet && (
        <p className="mt-1 line-clamp-2 text-[11px] text-fg/50">&ldquo;{active.snippet}&rdquo;</p>
      )}

      {embeddable && (
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          <span className="font-mono-timecode text-fg/40">now {formatTime(now)}</span>
          <div className="ml-auto flex gap-1.5">
            <button
              type="button"
              onClick={() => sync(active)}
              className="btn btn-secondary btn-sm !h-7 !px-2.5 !text-[11px] text-fg/60 hover:bg-tint/10 hover:text-fg/90 transition-colors"
            >
              ↺ Replay
            </button>
            <a
              href={ytLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm !h-7 !px-2.5 !text-[11px] text-fg/60 hover:bg-tint/10 hover:text-fg/90 transition-colors"
            >
              YouTube ↗
            </a>
          </div>
        </div>
      )}

      {citations.length > 1 && (
        <div className="mt-3 border-t border-tint/10 pt-3">
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-fg/40">Where this was explained</p>
          <div className="flex flex-col gap-1.5">
            {citations.map((c, i) => {
              const isActive = c.video_id === active.video_id && c.timestamp_seconds === active.timestamp_seconds;
              const playing = isPlayingMoment(c);
              return (
                <button
                  key={i}
                  onClick={() => onSelect(c)}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                    isActive ? "border-rec-400/60 bg-rec-500/10 shadow-[0_0_20px_-6px_rgba(224,72,63,0.6)]" : "border-tint/[0.06] bg-white/[0.03] hover:border-tint/15 hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="line-clamp-1 text-[11px] text-fg/90">{c.video_title}</span>
                    {c.snippet && (
                      <span className="line-clamp-1 text-[10px] text-fg/40">{c.snippet}</span>
                    )}
                  </span>
                  <span
                    className={`flex-shrink-0 rounded-full px-2 py-0.5 font-mono-timecode text-[10px] ${
                      playing ? "bg-gradient-to-b from-rec-400 to-rec-600 text-white shadow-[0_0_10px_rgba(224,72,63,0.6)]" : "bg-sunk/40 text-cited-300"
                    }`}
                  >
                    {playing ? "▶ " : "Go · "}
                    {formatTime(c.timestamp_seconds)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
