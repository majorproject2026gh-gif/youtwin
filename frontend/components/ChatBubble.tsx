import { ChatTurn, Citation } from "@/lib/api";
import Logo from "@/components/Logo";
import { formatTime } from "@/components/VideoPanel";
import { Icon } from "@/components/ui";
import { useState } from "react";

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** A cited moment: thumbnail with the timestamp burned in, the video
 * title and the exact caption line the answer came from. */
function CitationCard({ c, active, onClick }: { c: Citation; active: boolean; onClick: () => void }) {
  const [thumbOk, setThumbOk] = useState(VIDEO_ID_RE.test(c.video_id));
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Jump to ${c.video_title} at ${formatTime(c.timestamp_seconds)}`}
      className={`group flex w-full min-w-0 items-center gap-2.5 rounded-xl p-1.5 pr-3 text-left transition-all duration-200 sm:w-[19rem] ${
        active
          ? "bg-rec-500/[0.12] ring-1 ring-rec-400/60 shadow-[0_0_18px_-4px_rgba(224,72,63,0.55)]"
          : "bg-tint/[0.04] ring-1 ring-tint/[0.08] hover:-translate-y-0.5 hover:bg-tint/[0.07] hover:ring-cited-400/40"
      }`}
    >
      <span className="force-dark relative h-[46px] w-[74px] flex-shrink-0 overflow-hidden rounded-lg bg-[radial-gradient(ellipse_at_30%_20%,rgba(242,96,63,0.55),transparent_60%),linear-gradient(135deg,#1a0f0d,#0b0b0e)]">
        {thumbOk && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://i.ytimg.com/vi/${c.video_id}/mqdefault.jpg`}
            alt=""
            loading="lazy"
            onError={() => setThumbOk(false)}
            className="h-full w-full object-cover opacity-90 transition-transform duration-300 group-hover:scale-105"
          />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/20">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full ${active ? "bg-rec-500 text-white" : "bg-white/90 text-rec-500"} shadow`}>
            <Icon name="play" size={8} />
          </span>
        </span>
        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 font-mono-timecode text-[9px] leading-[14px] text-white">
          {formatTime(c.timestamp_seconds)}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-fg/85">{c.video_title}</span>
        {c.snippet ? (
          <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-fg/45">&ldquo;{c.snippet}&rdquo;</span>
        ) : (
          <span className="mt-0.5 block font-mono-timecode text-[10px] text-cited-300">cited moment</span>
        )}
      </span>
    </button>
  );
}

/** How strongly the creator's videos back this answer. */
function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const tone = pct >= 75 ? "bg-verified-500" : pct >= 55 ? "bg-cited-400" : "bg-fg/40";
  return (
    <span className="mt-1.5 flex items-center gap-1.5 px-1 font-mono-timecode text-[10px] text-fg/35" title="How closely the cited moments match your question">
      <span className="h-1 w-12 overflow-hidden rounded-full bg-tint/10">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </span>
      {pct}% match
    </span>
  );
}

/** Client-only bookkeeping ChatTurn doesn't carry from the API:
 * when the message was appended (for the timestamp) and whether it
 * represents a network failure rather than a real twin reply (styled
 * distinctly from an in-character "I'm not sure" refusal). */
export type Turn = ChatTurn & { sentAt?: number; error?: boolean };

function formatClock(ms?: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ChatBubble({
  turn,
  creatorName,
  onCiteClick,
  activeCitation,
  showAvatar = true,
  showTimestamp = true,
  tight = false,
}: {
  turn: Turn;
  creatorName: string;
  onCiteClick?: (citation: Citation, siblings: Citation[]) => void;
  /** The citation currently playing in the side-by-side VideoPanel, so
   * its badge can be highlighted. */
  activeCitation?: Citation | null;
  /** Only the last bubble in a consecutive run from the same sender
   * gets an avatar + timestamp — grouping tightly-spaced messages like
   * this is what makes a thread read as a real conversation instead of
   * a flat list of cards. */
  showAvatar?: boolean;
  showTimestamp?: boolean;
  /** Reduced top margin for messages that follow one from the same
   * sender. */
  tight?: boolean;
}) {
  const isTwin = turn.role === "twin";
  // A refusal ("not sure, haven't covered that yet") is a legitimate,
  // in-character reply — not an error — so it gets its own quieter
  // styling rather than either the normal answer look or the error look.
  // Small talk ("hi!") is neither grounded nor a refusal. Older turns
  // without the refused flag fall back to grounded === false.
  const isRefusal = isTwin && !turn.error && (turn.refused ?? turn.grounded === false);
  const isError = isTwin && !!turn.error;

  return (
    <div className={`flex items-end gap-2.5 ${tight ? "mt-1" : "mt-4"} ${isTwin ? "" : "flex-row-reverse"} animate-bubble-in`}>
      {isTwin ? (
        showAvatar ? (
          <span className="flex-shrink-0" title={creatorName}><Logo size={28} withWordmark={false} /></span>
        ) : (
          <div className="w-[28px] flex-shrink-0" />
        )
      ) : null}

      <div className={`flex max-w-[80%] flex-col ${isTwin ? "items-start" : "items-end"}`}>
        <div
          className={`px-4 py-2.5 text-[14.5px] leading-relaxed ${
            isTwin
              ? `rounded-2xl ${showAvatar ? "rounded-bl-md" : ""} ${
                  isRefusal
                    ? "border border-dashed border-cited-400/40 bg-cited-400/[0.06] text-fg/75"
                    : isError
                    ? "border border-rec-400/30 bg-rec-500/[0.08] text-rec-300"
                    : "border border-tint/[0.08] bg-gradient-to-b from-tint/[0.08] to-tint/[0.04] text-fg/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                }`
              : "rounded-2xl rounded-br-md bg-gradient-to-br from-rec-400 to-rec-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_20px_-8px_rgba(200,48,43,0.7)]"
          }`}
        >
          {isRefusal && (
            <span className="mb-1 flex items-center gap-1.5 font-mono-timecode text-[10px] uppercase tracking-[0.14em] text-cited-300">
              <Icon name="shield" size={12} /> Not in my videos
            </span>
          )}
          {isError && (
            <span className="mb-1 flex items-center gap-1.5 font-mono-timecode text-[10px] uppercase tracking-[0.14em]">
              <Icon name="alert" size={12} /> Connection issue
            </span>
          )}
          {turn.content}
        </div>

        {isTwin && !isRefusal && !isError && turn.citations && turn.citations.length > 0 && (
          <div className="mt-2 flex w-full flex-col gap-1.5">
            <span className="flex items-center gap-1.5 px-1 font-mono-timecode text-[10px] uppercase tracking-[0.14em] text-fg/35">
              <Icon name="film" size={11} /> From {turn.citations.length === 1 ? "this moment" : `${turn.citations.length} moments`}
            </span>
            {turn.citations.map((c, i) => (
              <CitationCard
                key={i}
                c={c}
                active={!!activeCitation && activeCitation.video_id === c.video_id && activeCitation.timestamp_seconds === c.timestamp_seconds}
                onClick={() => onCiteClick?.(c, turn.citations!)}
              />
            ))}
          </div>
        )}

        {isTwin && !isRefusal && !isError && turn.grounded !== false && typeof turn.confidence === "number" && (
          <ConfidenceMeter value={turn.confidence} />
        )}

        {showTimestamp && turn.sentAt && (
          <span className="mt-1 px-1 font-mono-timecode text-[10px] text-fg/30">
            {formatClock(turn.sentAt)}
          </span>
        )}
      </div>
    </div>
  );
}
