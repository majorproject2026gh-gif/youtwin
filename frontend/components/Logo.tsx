export default function Logo({ size = 32, withWordmark = true, dark = false }: {
  size?: number;
  withWordmark?: boolean;
  dark?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="38" height="38" rx="11" fill="#1A1610" />
        <path d="M12 12L20 20L12 28" stroke="#F7F1E4" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M28 12L20 20L28 28" stroke="#C22A2A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {withWordmark && (
        <span className={`font-display text-lg font-semibold tracking-tight ${dark ? "text-paper-100" : "text-ink-900"}`}>
          YouTwin
        </span>
      )}
    </span>
  );
}
