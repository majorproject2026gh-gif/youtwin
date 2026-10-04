export default function Toggle({
  checked,
  onChange,
  label,
  description,
  dark = true,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  dark?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div className="min-w-0">
        <p className={`text-sm font-medium ${dark ? "text-fg" : "text-ink-700"}`}>{label}</p>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-fg/45">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        onClick={() => onChange(!checked)}
        aria-checked={checked}
        aria-label={label}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-all duration-300 before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[""] ${
          checked
            ? "bg-gradient-to-r from-rec-500 to-coral-400 shadow-[0_0_16px_rgba(242,96,63,0.45),inset_0_1px_0_rgba(255,255,255,0.25)]"
            : "bg-tint/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-out-expo ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
