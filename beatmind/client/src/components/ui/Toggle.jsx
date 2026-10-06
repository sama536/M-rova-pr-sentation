export default function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
      <span className="flex items-baseline gap-2 min-w-0">
        <span className="label shrink-0">{label}</span>
        {hint && <span className="hint truncate">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-neon shadow-neon' : 'bg-ink-500'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}
