import Link from "next/link";
import Footer from "@/components/Footer";
import SiteNav from "@/components/SiteNav";
import Reveal from "@/components/Reveal";
import { Backdrop, Eyebrow, Icon, spotlight } from "@/components/ui";

const TEAM = ["Mayank Bambal", "Sadiyanureen Hussain", "Virender Singh", "Harvinder Singh"];

const MODULES = [
  { icon: "youtube", title: "Multimodal ingestion", body: "YouTube Data API + faster-whisper transcription" },
  { icon: "wave", title: "Stylometric persona extraction", body: "spaCy" },
  { icon: "database", title: "Vector embedding & indexing", body: "sentence-transformers + Qdrant" },
  { icon: "cpu", title: "Confidence-gated RAG inference", body: "LangChain + Llama 3" },
  { icon: "globe", title: "Serialization layer", body: "Node/Express serving a Next.js frontend" },
];

export default function About() {
  return (
    <div className="overflow-x-clip relative isolate min-h-screen text-fg">
      <Backdrop accent="#C8302B" accent2="#2DD4BF" />
      <SiteNav />

      <main className="mx-auto max-w-4xl px-5 pb-24 pt-16 sm:pt-24">
        <div className="animate-fade-up">
          <Eyebrow>CSE_C_06 · GHRCE Nagpur</Eyebrow>
          <h1 className="mt-7 font-display text-4xl font-semibold leading-[1.05] tracking-tightest sm:text-6xl">
            <span className="text-gradient-soft">YouTwin</span>
            <span className="mt-3 block font-serif text-2xl font-normal italic leading-snug tracking-normal text-fg/65 sm:text-[2rem]">
              A Digital Twin Based Interaction Framework for Content Generation and Validation using Generative AI
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-[17px] leading-relaxed text-fg/65">
            YouTwin trains a digital twin of a YouTube creator on their own video library — captions, transcripts, and speaking
            style — and lets viewers chat with it. Every answer is grounded in a real moment from a real video and cited down to
            the second. If nothing in the creator&apos;s library backs up an answer, the twin refuses to guess rather than risk
            misrepresenting the person it&apos;s modeled on.
          </p>
        </div>

        <Reveal>
          <section className="mt-20">
            <h2 className="font-display text-2xl font-semibold">How it&apos;s built</h2>
            <p className="mt-3 max-w-2xl text-fg/55">
              The pipeline spans five modules, from raw YouTube audio to a grounded, cited answer.
            </p>
            <ol className="mt-8 space-y-2">
              {MODULES.map((m, i) => (
                <li key={m.title} className="surface flex items-center gap-4 !rounded-2xl p-4">
                  <span className="w-8 font-mono-timecode text-xs text-signal-400">M{i + 1}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-tint/[0.05] text-fg/70"><Icon name={m.icon} size={17} /></span>
                  <div className="min-w-0">
                    <p className="font-medium text-fg">{m.title}</p>
                    <p className="text-sm text-fg/50">{m.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>

        <Reveal>
          <section className="mt-20">
            <div className="surface-solid relative overflow-hidden p-8 sm:p-10">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cited-400/20 blur-3xl" />
              <Eyebrow tone="gold">Future scope</Eyebrow>
              <p className="relative mt-6 text-[16px] leading-relaxed text-fg/70">
                Beyond the current chat interaction, a natural extension is a creator-facing generative agent — one that could draft
                video outlines, scripts, or even short-form clips in the creator&apos;s established voice and visual style, using the
                same persona and stylometric profile already built during ingestion. This would turn YouTwin from a purely reactive
                Q&amp;A twin into an active content-assistance agent, while keeping the same grounding and guardrail principles: any
                generated content would still need to trace back to material the creator actually produced, and refuse to fabricate
                claims the creator never made.
              </p>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="mt-20">
            <h2 className="font-display text-2xl font-semibold">Built by</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {TEAM.map((name) => (
                <div key={name} onMouseMove={spotlight} className="surface surface-interactive spotlight flex items-center gap-4 p-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-coral-400 via-rec-500 to-cited-500 font-display font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                    {name.split(" ").map((p) => p[0]).join("")}
                  </span>
                  <div>
                    <p className="font-medium text-fg">{name}</p>
                    <p className="text-xs text-fg/45">Dept. of CSE · GHRCE Nagpur</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/login" className="btn btn-primary btn-lg">Creator dashboard <Icon name="arrow-right" size={15} strokeWidth={2.25} /></Link>
              <Link href="/help" className="btn btn-secondary btn-lg">Help &amp; Support</Link>
            </div>
          </section>
        </Reveal>
      </main>

      <Footer />
    </div>
  );
}
