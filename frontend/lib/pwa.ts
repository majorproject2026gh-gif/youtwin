/**
 * Installable-app (PWA) helpers.
 *
 * - registerServiceWorker(): production only; the worker (public/sw.js)
 *   adds an offline screen and caches hashed build assets — never pages
 *   or API responses.
 * - useInstallPrompt(): what the "Install app" button needs to know.
 *   Chrome/Edge/Android fire `beforeinstallprompt`, which we hold on to
 *   and replay when the user taps Install. iOS Safari has no such event,
 *   so there we show "Share → Add to Home Screen" instructions instead.
 */
import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") return;
  const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac with touch.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export type InstallState = {
  /** Show an Install control at all. */
  available: boolean;
  /** No native prompt — show Add-to-Home-Screen steps instead. */
  manualIOS: boolean;
  install: () => Promise<void>;
};

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function useInstallPrompt(): InstallState {
  const [, force] = useState(0);
  const [env, setEnv] = useState({ standalone: true, ios: false });

  useEffect(() => {
    setEnv({ standalone: isStandalone(), ios: isIOS() });
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    const e = deferred;
    deferred = null;
    await e.prompt();
    await e.userChoice.catch(() => undefined);
    force((n) => n + 1);
  }, []);

  if (env.standalone) return { available: false, manualIOS: false, install };
  if (deferred) return { available: true, manualIOS: false, install };
  return { available: env.ios, manualIOS: env.ios, install };
}
