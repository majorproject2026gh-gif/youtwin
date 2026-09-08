import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-paper-300 px-6 py-6">
      <div className="mx-auto flex max-w-5xl flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <p className="text-xs text-ink-300">
          YouTwin — CSE_C_06, GHRCE Nagpur · Built by Mayank Bambal, Sadiyanureen Hussain,
          Virender Singh &amp; Harvinder Singh
        </p>
        <div className="flex gap-4 text-xs text-ink-300">
          <Link href="/about" className="hover:text-ink-700 transition-colors">About</Link>
          <Link href="/help" className="hover:text-ink-700 transition-colors">Help &amp; Support</Link>
        </div>
      </div>
    </footer>
  );
}
