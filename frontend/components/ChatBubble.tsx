import { ChatTurn } from "@/lib/api";

export default function ChatBubble({ turn }: { turn: ChatTurn }) {
  const isTwin = turn.role === "twin";
  return (
    <div className={`max-w-[85%] ${isTwin ? "" : "ml-auto"}`}>
      <div
        className={`rounded-lg border px-4 py-2.5 text-sm font-serif leading-relaxed ${
          isTwin
            ? "border-paper-300 bg-paper-200 text-ink-900"
            : "border-rec-600 bg-rec-500 text-paper-100"
        }`}
      >
        {turn.content}
      </div>
      {isTwin && turn.citations && turn.citations.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {turn.citations.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded bg-ink-950 px-2 py-0.5 font-mono-timecode text-[11px] text-cited-400"
            >
              cited &middot; {Math.floor(c.timestamp_seconds / 60)}:{String(c.timestamp_seconds % 60).padStart(2, "0")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
