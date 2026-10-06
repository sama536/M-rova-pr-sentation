// Beates : même dessin que brand/beates.svg, animé par brand/beates.css.
// mood : idle | talking | happy
export default function BeatesBot({ size = 72, mood = 'idle', className = '', title = 'Beates' }) {
  const moodClass = mood === 'talking' ? 'bt-talking' : mood === 'happy' ? 'bt-happy' : '';
  return (
    <svg viewBox="0 0 120 140" width={size} height={(size * 140) / 120} className={`${moodClass} ${className}`} role="img" aria-label={title}>
      <defs>
        <linearGradient id="bt-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c1630" />
          <stop offset="1" stopColor="#121214" />
        </linearGradient>
        <filter id="bt-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <ellipse className="bt-shadow" cx="60" cy="133" rx="24" ry="4" fill="#8b5cf6" opacity="0.3" />
      <g className="bt-float">
        <g className="bt-antenna">
          <line x1="60" y1="24" x2="60" y2="11" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" />
          <circle className="bt-tip" cx="60" cy="8" r="5" fill="#c4b5fd" filter="url(#bt-glow)" />
        </g>
        <rect x="13" y="40" width="10" height="24" rx="5" fill="#8b5cf6" filter="url(#bt-glow)" />
        <rect x="97" y="40" width="10" height="24" rx="5" fill="#8b5cf6" filter="url(#bt-glow)" />
        <rect x="21" y="23" width="78" height="58" rx="21" fill="url(#bt-body)" stroke="#8b5cf6" strokeWidth="3" />
        <rect x="31" y="34" width="58" height="35" rx="14" fill="#0a0a0a" stroke="#a78bfa" strokeOpacity="0.25" />
        <g filter="url(#bt-glow)">
          <rect className="bt-eye" x="43" y="42" width="10" height="17" rx="5" fill="#ddd6fe" />
          <rect className="bt-eye" x="67" y="42" width="10" height="17" rx="5" fill="#ddd6fe" />
        </g>
        <rect x="53" y="80" width="14" height="8" rx="3" fill="#2e2e33" />
        <rect x="36" y="87" width="48" height="33" rx="13" fill="url(#bt-body)" stroke="#6d28d9" strokeWidth="3" />
        <g fill="#a78bfa" filter="url(#bt-glow)">
          <rect className="bt-bar" x="49" y="96" width="5" height="15" rx="2.5" />
          <rect className="bt-bar" x="57.5" y="96" width="5" height="15" rx="2.5" />
          <rect className="bt-bar" x="66" y="96" width="5" height="15" rx="2.5" />
        </g>
      </g>
    </svg>
  );
}
