import { ReactNode } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Footer from "./Footer";
import Logo from "./Logo";
import { logout } from "@/lib/api";

export default function StepHeader({
  title,
  subtitle,
  step,
  totalSteps,
  stepLabels,
  onNext,
  nextLabel = "Next",
  nextDisabled = false,
  backHref,
  children,
}: {
  title: string;
  subtitle: string;
  step: number;
  totalSteps: number;
  stepLabels: string[];
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  backHref?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* YouTube Studio-style top bar — same shell as the homepage's
          YouTube-style nav, so moving between the two never feels like a
          different product. */}
      <nav className="glass-nav sticky top-0 z-30 flex items-center justify-between border-b border-[#e5e5e5] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link href="/home"><Logo /></Link>
          <span className="hidden sm:inline text-sm text-[#606060] border-l border-[#e5e5e5] pl-3">Studio</span>
        </div>
        <button
          onClick={async () => {
            await logout();
            router.push("/login");
          }}
          className="rounded-full border border-[#dadce0] px-4 py-1.5 text-xs font-medium text-[#606060] hover:bg-[#f2f2f2] transition-colors"
        >
          Log out
        </button>
      </nav>

      <div className="flex flex-1">
        {/* Left sidebar — YouTube Studio's exact pattern: white
            background, red accent on the active step, a checkmark for
            completed ones. */}
        <aside className="hidden lg:flex lg:w-64 flex-shrink-0 flex-col justify-between border-r border-[#f0f0f0] px-4 py-6">
          <div className="space-y-1">
            {stepLabels.map((label, i) => {
              const n = i + 1;
              const isActive = n === step;
              const isDone = n < step;
              return (
                <div
                  key={label}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${isActive ? "bg-[#f2f2f2]" : ""}`}
                >
                  <span
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-mono-timecode text-[10px] ${
                      isActive
                        ? "bg-rec-500 text-white"
                        : isDone
                        ? "bg-verified-500 text-white"
                        : "border border-[#dadce0] text-[#606060]"
                    }`}
                  >
                    {isDone ? "✓" : n}
                  </span>
                  <span className={`text-sm ${isActive ? "font-medium text-[#0f0f0f]" : "text-[#606060]"}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          <div>
            <Link
              href="/dashboard/create-video"
              className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[#606060] hover:bg-[#f2f2f2] transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-cited-500 animate-pulse" />
              AI video agent
            </Link>
            <Link
              href="/dashboard/analytics"
              className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[#606060] hover:bg-[#f2f2f2] transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-verified-500" />
              Analytics
            </Link>
            <p className="px-3 font-mono-timecode text-[10px] tracking-wide text-[#909090]">
              CC &middot; GROUNDED &middot; TIMESTAMPED
            </p>
          </div>
        </aside>

        {/* Right content */}
        <main className="flex flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center px-6 py-12">
            <div className="w-full max-w-md">
              <p className="font-mono-timecode text-xs text-[#606060] mb-2 lg:hidden">
                Step {step} of {totalSteps}
              </p>
              <h1 className="font-display text-3xl font-bold text-[#0f0f0f]">{title}</h1>
              <p className="mt-2 mb-8 text-base text-[#606060]">{subtitle}</p>

              <div className="rounded-xl border border-[#e5e5e5] p-6">
                {children}
              </div>

              <div className="mt-6 flex justify-between">
                {backHref ? (
                  <button
                    onClick={() => router.push(backHref)}
                    className="rounded-full border border-[#dadce0] px-5 py-2 text-sm text-[#606060] hover:bg-[#f2f2f2] transition-colors"
                  >
                    ← Back
                  </button>
                ) : (
                  <span />
                )}
                {onNext && (
                  <button
                    onClick={onNext}
                    disabled={nextDisabled}
                    className="rounded-full bg-rec-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-rec-600 disabled:opacity-40 transition-colors"
                  >
                    {nextLabel} →
                  </button>
                )}
              </div>
            </div>
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}
