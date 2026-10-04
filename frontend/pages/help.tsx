import Link from "next/link";
import Footer from "@/components/Footer";
import SiteNav from "@/components/SiteNav";
import { Backdrop, Eyebrow, Icon } from "@/components/ui";

const FAQS = [
  {
    q: "How do I train my twin on my own channel?",
    a: "Sign up, link your Google account on Step 1 (this authorizes YouTube channel access), then on Step 2 paste your channel URL, @handle, or ID and click “Ingest my channel.”",
  },
  {
    q: "Why does my twin sometimes say “I don't know”?",
    a: "That's the zero-hallucination guardrail working as intended. If nothing in your video library closely matches a question, the twin refuses to guess rather than invent an answer.",
  },
  {
    q: "My channel has no videos yet — what happens?",
    a: "Ingestion will fail with a clear message. Upload at least one real video first, or use “Load sample creator” to test the full pipeline with mock data in the meantime.",
  },
  {
    q: "Is my login the same as my Google account?",
    a: "No — your YouTwin account (username/mobile number + password) is separate from the Google account you link afterward. Google is only used to authorize YouTube channel access.",
  },  {
    q: "Is there a mobile app?",
    a: "YouTwin installs like an app — no app store needed. On Android (Chrome) or desktop Chrome/Edge, tap “Install app” in the menu. On iPhone/iPad (Safari), tap Share → Add to Home Screen. It then opens full-screen from its own icon and shows a friendly screen if you're offline.",
  },
  {
    q: "Can viewers chat while watching, without leaving YouTube?",
    a: "Yes — with the YouTwin browser sidebar (the “extension” folder in the project, loaded via chrome://extensions → Load unpacked). It finds your twin link in the video description, sends the moment the viewer is at with each question, and clicking a citation seeks the YouTube player to that second.",
  },
  {
    q: "Can I link to a specific moment of a video?",
    a: "Yes. On the Share step, paste a video URL and a time to get a timestamped deep link (…/chat?v=VIDEO&t=SECONDS). It opens the twin's chat on phones and desktops already tied to that moment — handy for pinned comments and mobile.",
  },
];

export default function Help() {
  return (
    <div className="overflow-x-clip relative isolate min-h-screen text-fg">
      <Backdrop accent="#E0AE4E" accent2="#C8302B" />
      <SiteNav />

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-16 sm:pt-24">
        <div className="text-center animate-fade-up">
          <Eyebrow tone="gold">Support</Eyebrow>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tightest sm:text-5xl text-gradient-soft">Help &amp; Support</h1>
          <p className="mt-4 text-fg/55">Common questions about setting up and using YouTwin.</p>
        </div>

        <div className="mt-14 space-y-3">
          {FAQS.map((f, i) => (
            <details
              key={f.q}
              className="surface group !rounded-2xl p-0 transition-colors open:border-tint/15 animate-fade-up"
              style={{ animationDelay: `${80 + i * 60}ms` }}
            >
              <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 font-medium text-fg [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-tint/[0.05] text-fg/50 transition-colors group-open:bg-coral-400/10 group-open:text-coral-400">
                  <Icon name="help" size={16} />
                </span>
                <span className="flex-1">{f.q}</span>
                <Icon name="plus" size={16} className="text-fg/35 transition-transform duration-300 group-open:rotate-45" />
              </summary>
              <p className="px-5 pb-5 pl-[4.25rem] text-sm leading-relaxed text-fg/60">{f.a}</p>
            </details>
          ))}
        </div>

        <div className="surface mt-12 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cited-400/10 text-cited-300">
            <Icon name="graduation" size={18} />
          </span>
          <p className="flex-1 text-sm leading-relaxed text-fg/60">
            Still stuck? This is an academic capstone project (CSE_C_06, GHRCE Nagpur) — reach out to the team via the details on
            the{" "}
            <Link href="/about" className="text-coral-400 hover:text-coral-300">About page</Link>.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
