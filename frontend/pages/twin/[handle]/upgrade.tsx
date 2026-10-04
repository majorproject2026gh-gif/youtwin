import { useRouter } from "next/router";
import ViewerShell from "@/components/ViewerShell";
import Logo from "@/components/Logo";
import { Eyebrow, Icon } from "@/components/ui";

const PERKS = [
  { icon: "sparkles", text: "Deeper access to the twin" },
  { icon: "clock", text: "One tap from the video to the chat" },
  { icon: "check-circle", text: "No widget, no install" },
];

export default function UpgradeStep() {
  const router = useRouter();
  const { handle } = router.query as { handle?: string };

  return (
    <ViewerShell step={4} accent="#E0AE4E" accent2="#C8302B">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-14 px-5 py-14 lg:grid-cols-[1fr_1fr] lg:gap-20">
        <div className="text-center lg:text-left animate-fade-up">
          <Eyebrow tone="gold">Step 4 of 4 · Upgrade</Eyebrow>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1] tracking-tightest sm:text-6xl">
            <span className="text-gradient-soft">Keep</span>{" "}
            <span className="font-serif italic font-normal text-cited-300">chatting.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-fg/55 lg:mx-0">
            Or unlock deeper access with Twin+. One tap on the description link takes the viewer straight from the video to the
            twin&apos;s own chat page — no widget, no install.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <button onClick={() => router.push(`/twin/${handle}/chat`)} className="btn btn-secondary btn-lg">
              <Icon name="arrow-left" size={15} /> Back to live chat
            </button>
            <button className="btn btn-gold btn-xl">
              <Icon name="star" size={16} /> Unlock Twin+
            </button>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md animate-fade-up" style={{ animationDelay: "120ms" }}>
          <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-gradient-to-br from-cited-400/30 to-rec-500/15 blur-3xl" />
          <div className="surface-solid border-gradient overflow-hidden rounded-[1.75rem] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Logo size={36} withWordmark={false} />
                <div className="text-left">
                  <p className="text-sm font-medium text-fg">My YouTwin</p>
                  <p className="flex items-center gap-1.5 text-[11px] text-fg/45">
                    <span className="h-1.5 w-1.5 rounded-full bg-verified-500 animate-glow" /> Active now
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-gradient-to-r from-cited-300 to-cited-500 px-2.5 py-1 font-mono-timecode text-[10px] font-semibold text-[#1A1406] shadow-glow-gold">
                TWIN+
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-rec-400 to-rec-600 px-4 py-2.5 text-[14px] text-white shadow-[0_6px_18px_-6px_rgba(200,48,43,0.7)]">
                Best camera for vlogging?
              </div>
              <div className="flex items-end gap-2">
                <Logo size={24} withWordmark={false} />
                <div className="max-w-[82%] rounded-2xl rounded-bl-md border border-tint/[0.07] bg-white/[0.05] px-4 py-2.5 text-[14px] text-fg/90">
                  The Sony ZV-1 II — I used it in my March vlog.
                  <span className="mt-2 flex w-fit items-center gap-1 rounded-md bg-sunk/40 px-2 py-0.5 font-mono-timecode text-[10.5px] text-cited-300 ring-1 ring-cited-400/25">
                    <Icon name="play" size={8} /> 12:45 cited
                  </span>
                </div>
              </div>
            </div>

            <ul className="mt-6 space-y-2.5 border-t border-tint/[0.06] pt-5">
              {PERKS.map((p) => (
                <li key={p.text} className="flex items-center gap-3 text-sm text-fg/70">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cited-400/10 text-cited-300"><Icon name={p.icon} size={14} /></span>
                  {p.text}
                </li>
              ))}
            </ul>

            <button className="btn btn-gold btn-lg mt-6 w-full">Unlock more with Twin+</button>
          </div>
        </div>
      </div>
    </ViewerShell>
  );
}
