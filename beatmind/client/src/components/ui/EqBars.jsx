export default function EqBars({ className = '', bars = 5 }) {
  return (
    <span className={`inline-flex items-end gap-[3px] h-4 ${className}`} aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className="w-[3px] h-full rounded-full bg-neon-soft origin-bottom animate-pulsebar" style={{ animationDelay: `${i * 0.13}s` }} />
      ))}
    </span>
  );
}
