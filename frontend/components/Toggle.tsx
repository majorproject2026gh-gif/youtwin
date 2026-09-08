export default function Toggle({
  checked,
  onChange,
  label,
  dark = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  dark?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-sm ${dark ? "text-paper-100" : "text-ink-700"}`}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`h-6 w-11 rounded-full transition-colors ${checked ? "bg-rec-500" : dark ? "bg-white/20" : "bg-paper-300"}`}
        aria-pressed={checked}
        aria-label={label}
      >
        <span
          className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
