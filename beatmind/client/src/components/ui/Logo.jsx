export default function Logo({ size = 'md' }) {
  const h = size === 'lg' ? 'h-10' : 'h-7';
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg viewBox="0 0 32 32" className={`${h} w-auto drop-shadow-[0_0_10px_rgba(139,92,246,.7)]`} aria-hidden>
        <rect width="32" height="32" rx="8" fill="#121214" stroke="rgba(167,139,250,.4)" />
        <g fill="#a78bfa">
          <rect x="6" y="12" width="3" height="8" rx="1.5" className="origin-center animate-pulsebar" style={{ animationDelay: '0s' }} />
          <rect x="11" y="7" width="3" height="18" rx="1.5" className="origin-center animate-pulsebar" style={{ animationDelay: '.2s' }} />
          <rect x="16" y="10" width="3" height="12" rx="1.5" fill="#8b5cf6" className="origin-center animate-pulsebar" style={{ animationDelay: '.4s' }} />
          <rect x="21" y="5" width="3" height="22" rx="1.5" className="origin-center animate-pulsebar" style={{ animationDelay: '.6s' }} />
        </g>
      </svg>
      <span className={`font-display font-extrabold tracking-tight ${size === 'lg' ? 'text-2xl' : 'text-[17px]'}`}>
        BEAT<span className="text-neon-soft">MIND</span>
      </span>
    </span>
  );
}
