import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { api } from "@/lib/api";
import { ChatTurn } from "@/lib/api";
import ChatBubble from "@/components/ChatBubble";

export default function TwinChatPage() {
  const router = useRouter();
  const { handle } = router.query as { handle?: string };

  const [twinId, setTwinId] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!handle) return;
    api
      .get(`/twins/by-handle/${handle}`)
      .then(({ data }) => {
        setTwinId(data.twinId);
        setCreatorName(data.creatorName);
        setTurns([{ role: "twin", content: `Hi! Ask me anything from my videos.` }]);
      })
      .catch(() => setNotFound(true));
  }, [handle]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  async function send() {
    if (!input.trim() || !twinId || sending) return;
    const message = input.trim();
    setInput("");
    setTurns((t) => [...t, { role: "viewer", content: message }]);
    setSending(true);
    try {
      const { data } = await api.post("/chat", { twinId, message });
      setTurns((t) => [
        ...t,
        {
          role: "twin",
          content: data.answer,
          grounded: data.grounded,
          confidence: data.confidence,
          citations: data.citations,
        },
      ]);
    } catch {
      setTurns((t) => [...t, { role: "twin", content: "Sorry, something went wrong. Try again in a moment." }]);
    } finally {
      setSending(false);
    }
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center text-stone-500">
        No published twin found at youtwin.ai/{handle}.
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-8">
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-500">
        <span className="text-red-600">▶</span> youtwin.ai/{handle}
      </div>

      <div className="flex-1 rounded-xl border border-orange-200 bg-white p-4 flex flex-col gap-3 overflow-y-auto min-h-[400px]">
        <div className="text-xs font-medium text-stone-400">{creatorName ? `${creatorName}'s Twin` : "Creator Twin"}</div>
        {turns.map((t, i) => (
          <ChatBubble key={i} turn={t} />
        ))}
        {sending && <div className="text-xs text-stone-400">typing…</div>}
        <div ref={bottomRef} />
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message…"
          className="flex-1 rounded-full border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-orange-300"
        />
        <button
          onClick={send}
          disabled={sending}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white disabled:opacity-50"
          aria-label="Send"
        >
          →
        </button>
      </div>

      <button className="mt-3 rounded-full bg-orange-400 px-4 py-2 text-xs font-medium text-white hover:bg-orange-500">
        Unlock more with Twin+
      </button>
    </main>
  );
}
