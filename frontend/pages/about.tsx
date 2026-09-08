import Link from "next/link";
import Footer from "@/components/Footer";
import Logo from "@/components/Logo";

const TEAM = ["Mayank Bambal", "Sadiyanureen Hussain", "Virender Singh", "Harvinder Singh"];

export default function About() {
  return (
    <div className="min-h-screen bg-paper-100 text-ink-900">
      <nav className="sticky top-0 z-30 border-b border-paper-300/60 bg-paper-100/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/home"><Logo /></Link>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/help" className="text-ink-500 hover:text-ink-900 transition-colors">Help &amp; Support</Link>
            <Link href="/login" className="rounded bg-rec-500 px-4 py-2 text-paper-100 font-medium hover:bg-rec-600 transition-colors">
              Creator dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-20">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-paper-300 bg-paper-200 px-3 py-1 text-[10px] tracking-wide text-ink-500 font-mono-timecode">
          CSE_C_06 &middot; GHRCE NAGPUR
        </div>
        <h1 className="font-display text-3xl font-bold">
          YouTwin — A Digital Twin Based Interaction Framework for Content Generation
          and Validation using Generative AI
        </h1>
        <p className="mt-6 text-ink-500 leading-relaxed">
          YouTwin trains a digital twin of a YouTube creator on their own video library —
          captions, transcripts, and speaking style — and lets viewers chat with it. Every
          answer is grounded in a real moment from a real video and cited down to the second.
          If nothing in the creator&apos;s library backs up an answer, the twin refuses to
          guess rather than risk misrepresenting the person it&apos;s modeled on.
        </p>

        <h2 className="font-display text-xl font-semibold mt-12 mb-3">How it&apos;s built</h2>
        <p className="text-ink-500 leading-relaxed">
          The pipeline spans five modules: multimodal ingestion (YouTube Data API +
          faster-whisper transcription), stylometric persona extraction (spaCy), vector
          embedding and indexing (sentence-transformers + Qdrant), confidence-gated
          RAG inference (LangChain + Llama 3), and a serialization layer (Node/Express)
          that serves it all to a Next.js frontend.
        </p>

        <h2 className="font-display text-xl font-semibold mt-12 mb-3">Future scope</h2>
        <p className="text-ink-500 leading-relaxed">
          Beyond the current chat interaction, a natural extension is a creator-facing
          generative agent — one that could draft video outlines, scripts, or even short-form
          clips in the creator&apos;s established voice and visual style, using the same
          persona and stylometric profile already built during ingestion. This would turn
          YouTwin from a purely reactive Q&amp;A twin into an active content-assistance agent,
          while keeping the same grounding and guardrail principles: any generated content
          would still need to trace back to material the creator actually produced, and refuse
          to fabricate claims the creator never made.
        </p>

        <h2 className="font-display text-xl font-semibold mt-12 mb-4">Built by</h2>
        <div className="grid grid-cols-2 gap-3">
          {TEAM.map((name) => (
            <div key={name} className="rounded-lg border border-paper-300 bg-white px-4 py-3 text-sm text-ink-900">
              {name}
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
