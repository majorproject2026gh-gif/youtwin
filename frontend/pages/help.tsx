import Link from "next/link";
import Footer from "@/components/Footer";
import Logo from "@/components/Logo";

const FAQS = [
  {
    q: "How do I train my twin on my own channel?",
    a: "Sign up, link your Google account on Step 1 (this authorizes YouTube channel access), then on Step 2 paste your channel URL, @handle, or ID and click \u201cIngest my channel.\u201d",
  },
  {
    q: "Why does my twin sometimes say \u201cI don't know\u201d?",
    a: "That's the zero-hallucination guardrail working as intended. If nothing in your video library closely matches a question, the twin refuses to guess rather than invent an answer.",
  },
  {
    q: "My channel has no videos yet \u2014 what happens?",
    a: "Ingestion will fail with a clear message. Upload at least one real video first, or use \u201cLoad sample creator\u201d to test the full pipeline with mock data in the meantime.",
  },
  {
    q: "Is my login the same as my Google account?",
    a: "No \u2014 your YouTwin account (username/mobile number + password) is separate from the Google account you link afterward. Google is only used to authorize YouTube channel access.",
  },
];

export default function Help() {
  return (
    <div className="min-h-screen bg-paper-100 text-ink-900">
      <nav className="sticky top-0 z-30 border-b border-paper-300/60 bg-paper-100/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/home"><Logo /></Link>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/about" className="text-ink-500 hover:text-ink-900 transition-colors">About</Link>
            <Link href="/login" className="rounded bg-rec-500 px-4 py-2 text-paper-100 font-medium hover:bg-rec-600 transition-colors">
              Creator dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="font-display text-3xl font-bold">Help &amp; Support</h1>
        <p className="mt-2 text-ink-500">Common questions about setting up and using YouTwin.</p>

        <div className="mt-10 space-y-4">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-lg border border-paper-300 bg-white p-5 open:shadow-sm transition-shadow">
              <summary className="cursor-pointer list-none font-display font-medium text-ink-900 flex items-center justify-between">
                {f.q}
                <span className="text-ink-300 group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="mt-3 text-sm text-ink-500 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-12 rounded-lg border border-paper-300 bg-paper-200 p-5 text-sm text-ink-500">
          Still stuck? This is an academic capstone project (CSE_C_06, GHRCE Nagpur) — reach out
          to the team via the details on the{" "}
          <Link href="/about" className="text-rec-500 underline">About page</Link>.
        </div>
      </main>

      <Footer />
    </div>
  );
}
