import { ReactNode } from "react";

/** The glowing progress-ring visual anchor first introduced on the
 * Train step, extracted so other pages (Analytics, Create Video,
 * Agent) can use the same centerpiece instead of a plain card. */
export default function GlowRing({
  percent,
  color,
  size = 220,
  children,
}: {
  percent: number;
  color: string;
  size?: number;
  children: ReactNode;
}) {
  const r = size / 2 - 14;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <>
      <div
        className="absolute rounded-full blur-[60px] opacity-40 transition-colors duration-700"
        style={{ background: color, height: size * 1.3, width: size * 1.3 }}
      />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative">
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, percent / 100)))}
          transform={`rotate(-90 ${c} ${c})`}
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.5s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">{children}</div>
    </>
  );
}
