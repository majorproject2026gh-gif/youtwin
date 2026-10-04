import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "./ui";

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
    <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:max-w-sm animate-fade-up">
      <div className="surface glass-nav p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cited-500/10 text-cited-300">
            <Icon name="lock" size={16} />
          </span>
          <p className="text-[13px] leading-relaxed text-fg/65">
            YouTwin uses your browser&apos;s local storage to keep you signed in and remember your training progress — no
            third-party tracking.{" "}
            <Link href="/about" className="text-coral-400 underline-offset-2 hover:underline">Learn more</Link>
          </p>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={dismiss} className="btn btn-ghost btn-sm">Dismiss</button>
          <button onClick={dismiss} className="btn btn-primary btn-sm">Accept</button>
        </div>
      </div>
    </div>
  );
}
