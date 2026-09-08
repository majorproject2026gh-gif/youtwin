import { useEffect, useState } from "react";
import Link from "next/link";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("youtwin_cookie_ack")) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem("youtwin_cookie_ack", "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="glass-nav fixed inset-x-0 bottom-0 z-50 border-t border-paper-300 px-6 py-4">
      <div className="mx-auto flex max-w-5xl flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-ink-500 max-w-2xl">
          YouTwin uses your browser&apos;s local storage to keep you signed in and remember your
          training progress — no third-party tracking.{" "}
          <Link href="/about" className="underline text-rec-500">Learn more</Link>
        </p>
        <div className="flex flex-shrink-0 gap-2">
          <button
            onClick={dismiss}
            className="rounded border border-paper-300 px-4 py-2 text-xs text-ink-500 hover:bg-paper-200 transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={dismiss}
            className="rounded bg-rec-500 px-4 py-2 text-xs font-medium text-white hover:bg-rec-600 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
