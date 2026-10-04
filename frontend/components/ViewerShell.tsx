import { ReactNode } from "react";
import Link from "next/link";
import InstallApp from "./InstallApp";
import Logo from "./Logo";
import { Backdrop, Stepper } from "./ui";

export const VIEWER_STEPS = ["Find link", "Your name", "Chat", "Upgrade"];

/**
 * Shell for the public, viewer-facing twin pages (/twin/[handle]/…):
 * minimal chrome, the viewer journey stepper, and a "Powered by" mark —
 * the page belongs to the creator, YouTwin stays quietly in the corner.
 */
export default function ViewerShell({
  step,
  children,
  accent,
  accent2,
  accent3,
}: {
  step: number;
  children: ReactNode;
  accent?: string;
  accent2?: string;
  accent3?: string;
}) {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-x-clip text-fg">
      <Backdrop accent={accent} accent2={accent2} accent3={accent3} />
      <header className="glass-nav sticky top-0 z-30 border-b border-tint/[0.06]">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/home"><Logo /></Link>
          <Stepper steps={VIEWER_STEPS} current={step} className="mx-auto hidden md:flex" />
          <span className="ml-auto hidden items-center gap-1.5 text-xs text-fg/40 sm:flex md:ml-0">
            Hosted on <span className="font-mono-timecode text-fg/60">youtwin.ai</span>
          </span>
          <span className="ml-auto sm:ml-0">
            <InstallApp />
          </span>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
