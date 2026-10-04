import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import { Backdrop, Icon } from "@/components/ui";

/** Branded, theme-aware 404 (Next's built-in one ignores the app theme). */
export default function NotFound() {
  return (
    <div className="overflow-x-clip relative isolate flex min-h-screen flex-col text-fg">
      <Backdrop accent="#C8302B" accent2="#E0AE4E" />
      <SiteNav />
      <main className="flex flex-1 items-center justify-center px-5 py-24">
        <div className="max-w-md text-center animate-fade-up">
          <p className="font-mono-timecode text-sm tracking-[0.3em] text-rec-400">404 · NO SIGNAL</p>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tightest text-gradient-soft sm:text-5xl">
            This page isn&apos;t in the library.
          </h1>
          <p className="mt-4 text-fg/55">The link may be mistyped, or the page was moved.</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/home" className="btn btn-primary btn-lg">
              <Icon name="home" size={16} /> Back to home
            </Link>
            <Link href="/help" className="btn btn-secondary btn-lg">Help &amp; Support</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
