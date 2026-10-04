/**
 * Decorative "twin" centerpiece: two soft, counter-drifting orbs in the
 * brand's coral and gold.
 *
 * This previously rendered a WebGL scene with three / @react-three/fiber /
 * @react-three/drei — but none of those packages are in package.json, so
 * any clean install (`npm ci`, Vercel, Docker) failed the TypeScript build
 * on this file even though no page imports it. This dependency-free CSS
 * version keeps the component available without the build break.
 */
export default function TwinOrb({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`relative h-64 w-64 ${className}`}>
      <div className="bg-orb-a absolute left-2 top-6 h-40 w-40 rounded-full bg-gradient-to-br from-coral-400 to-rec-500 opacity-80 blur-[2px] shadow-glow" />
      <div className="bg-orb-b absolute bottom-4 right-2 h-36 w-36 rounded-full bg-gradient-to-br from-cited-300 to-cited-500 opacity-75 blur-[2px] shadow-glow-gold" />
    </div>
  );
}
