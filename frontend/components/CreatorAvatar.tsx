/**
 * Branded creator avatar (YouTwin stores the channel name, not a photo):
 * the brand gradient with the creator's initial, a lit top edge and an
 * optional status ring — reads as a designed identity mark.
 */
export default function CreatorAvatar({
  name,
  size = 32,
  ring = false,
}: {
  name: string;
  size?: number;
  ring?: boolean;
}) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <div
      className={`relative flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-coral-400 via-rec-500 to-cited-500 font-display font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_12px_-2px_rgba(200,48,43,0.5)] ${
        ring ? "ring-2 ring-night-900 ring-offset-2 ring-offset-verified-500/60" : ""
      }`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial}
    </div>
  );
}
