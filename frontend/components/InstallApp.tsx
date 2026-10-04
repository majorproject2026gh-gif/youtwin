import { useEffect, useState } from "react";
import { useInstallPrompt } from "@/lib/pwa";
import { Icon } from "./ui";

/**
 * "Install app" control. Renders nothing when the browser can't install
 * the site or it's already running as an installed app.
 *   variant="button" — a compact nav button
 *   variant="row"    — a full-width menu row (mobile menus)
 *   variant="link"   — a plain text link (footer)
 */
export default function InstallApp({
  variant = "button",
  onDone,
}: {
  variant?: "button" | "row" | "link";
  onDone?: () => void;
}) {
  const { available, manualIOS, install } = useInstallPrompt();
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    if (!showSteps) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowSteps(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSteps]);

  if (!available) return null;

  const onClick = async () => {
    if (manualIOS) setShowSteps(true);
    else {
      await install();
      onDone?.();
    }
  };

  const trigger =
    variant === "row" ? (
      <button onClick={onClick} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-fg/75 hover:bg-tint/[0.05]">
        <Icon name="download" size={15} className="text-coral-400" /> Install YouTwin app
      </button>
    ) : variant === "link" ? (
      <button onClick={onClick} className="-my-2.5 inline-flex items-center gap-1.5 py-2.5 text-sm text-fg/60 transition-colors hover:text-fg sm:-my-1.5 sm:py-1.5">
        <Icon name="download" size={13} /> Install the app
      </button>
    ) : (
      <button onClick={onClick} className="btn btn-ghost btn-sm" aria-label="Install YouTwin app">
        <Icon name="download" size={14} /> <span className="hidden xl:inline">Install app</span>
      </button>
    );

  return (
    <>
      {trigger}
      {showSteps && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center" onClick={() => setShowSteps(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
            className="surface-solid w-full max-w-sm p-6 animate-fade-up"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <p id="install-title" className="font-display text-lg font-semibold text-fg">Add YouTwin to your Home Screen</p>
              <button onClick={() => setShowSteps(false)} className="btn btn-ghost btn-icon btn-sm -mr-2 -mt-1" aria-label="Close">
                <Icon name="x" size={15} />
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-fg/75">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-coral-400/15 text-xs font-semibold text-coral-400">1</span>
                <span>Tap the <strong className="text-fg">Share</strong> button in Safari&apos;s toolbar (the square with an arrow).</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-coral-400/15 text-xs font-semibold text-coral-400">2</span>
                <span>Choose <strong className="text-fg">Add to Home Screen</strong>, then tap <strong className="text-fg">Add</strong>.</span>
              </li>
            </ol>
            <p className="mt-4 text-xs text-fg/45">YouTwin then opens full-screen from its own icon, like any other app.</p>
          </div>
        </div>
      )}
    </>
  );
}
