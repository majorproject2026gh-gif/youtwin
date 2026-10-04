import { Eyebrow, Icon, spotlight } from "./ui";
import { useInView } from "./useInView";

/**
 * Landing-page section with the measured effect of the retrieval upgrade.
 * Numbers come from ai-service/eval (python -m eval.run_eval): 62 viewer
 * questions + 24 off-topic ones over four test videos. "Before" is the
 * original pipeline at its deployed guardrail setting.
 */
const METRICS = [
  { label: "Right moment ranked first", before: 44, after: 86 },
  { label: "Right moment in what the LLM reads", before: 82, after: 98 },
  { label: "Valid questions answered", before: 94, after: 97 },
  { label: "Off-topic stopped before the LLM", before: 63, after: 79 },
];

const STAGES = [
  { icon: "search", title: "Hybrid search", body: "Meaning (BGE embeddings) + exact words (BM25), fused" },
  { icon: "gauge", title: "Evidence gate", body: "Weak match → refuse before any text is generated" },
  { icon: "shield", title: "Answer check", body: "The LLM must cite a passage or reply NOT_IN_CONTEXT" },
  { icon: "play", title: "Exact moment", body: "Each citation jumps to the caption line it came from" },
];

function Bar({ label, before, after, show, delay }: { label: string; before: number; after: number; show: boolean; delay: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-fg/70">{label}</p>
        <p className="flex items-baseline gap-2 font-mono-timecode tabular-nums">
          <span className="text-xs text-fg/35 line-through decoration-fg/25">{before}%</span>
          <span className="text-lg font-semibold text-fg">{after}%</span>
        </p>
      </div>
      <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-tint/[0.07]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-tint/20 transition-[width] duration-1000 ease-out"
          style={{ width: show ? `${before}%` : "0%", transitionDelay: `${delay}ms` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-rec-500 via-coral-400 to-cited-400 shadow-[0_0_14px_rgba(255,130,102,0.45)] transition-[width] duration-[1400ms] ease-out"
          style={{ width: show ? `${after}%` : "0%", transitionDelay: `${delay + 250}ms`, mixBlendMode: "normal" }}
        />
        <div
          className="absolute inset-y-0 w-px bg-fg/60 transition-[left] duration-1000 ease-out"
          style={{ left: show ? `${before}%` : "0%", transitionDelay: `${delay}ms` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

export default function AccuracySection() {
  const { ref, inView } = useInView<HTMLDivElement>(0.25);
  return (
    <section id="accuracy" className="scroll-mt-24 px-4 py-20 sm:px-6">
      <div ref={ref} className="mx-auto max-w-6xl">
        <div className={`reveal ${inView ? "reveal-visible" : ""} flex flex-col gap-4 md:flex-row md:items-end md:justify-between`}>
          <div className="max-w-xl">
            <Eyebrow tone="green">Measured, not claimed</Eyebrow>
            <h2 className="mt-5 font-display text-3xl font-semibold leading-tight sm:text-5xl">
              <span className="text-gradient-soft">Finds the right moment</span>{" "}
              <span className="font-serif italic font-normal text-fg/70">twice as often.</span>
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-fg/55">
            Scored on 62 real-style viewer questions and 24 it should refuse, across four test videos. The test
            ships with the code, so anyone can re-run it.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-5">
          <div onMouseMove={spotlight} className="surface spotlight relative overflow-hidden p-6 sm:p-8 lg:col-span-3">
            <div className="mb-7 flex items-center gap-4 font-mono-timecode text-[10px] uppercase tracking-[0.14em] text-fg/40">
              <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-tint/25" /> Before</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-gradient-to-r from-rec-500 to-cited-400" /> Now</span>
            </div>
            <div className="space-y-6">
              {METRICS.map((m, i) => (
                <Bar key={m.label} {...m} show={inView} delay={i * 140} />
              ))}
            </div>
            <p className="mt-8 flex items-center gap-2 font-mono-timecode text-[11px] text-fg/35">
              <Icon name="cpu" size={12} /> ai-service · python -m eval.run_eval
            </p>
          </div>

          <div className="surface relative overflow-hidden p-6 sm:p-8 lg:col-span-2">
            <p className="font-display text-lg font-semibold text-fg">Every answer passes four steps</p>
            <ol className="relative mt-6 space-y-5">
              <span className="absolute bottom-3 left-[17px] top-3 w-px bg-gradient-to-b from-coral-400/60 via-tint/15 to-verified-500/50" aria-hidden />
              {STAGES.map((s, i) => (
                <li
                  key={s.title}
                  className={`reveal ${inView ? "reveal-visible" : ""} relative flex gap-4`}
                  style={{ transitionDelay: `${300 + i * 120}ms` }}
                >
                  <span className="relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-tint/10 bg-night-900 text-coral-400 shadow-card">
                    <Icon name={s.icon} size={16} />
                  </span>
                  <span className="pt-0.5">
                    <span className="block text-sm font-medium text-fg">{s.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-fg/50">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
