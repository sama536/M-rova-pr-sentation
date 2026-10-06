import { useEffect, useRef } from 'react';

// Forme d'onde cliquable (seek) avec tête de lecture.
export default function Waveform({ peaks = [], progress = 0, onSeek, height = 72, sections, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    c.width = w * dpr;
    c.height = height * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, height);
    const n = peaks.length || 1;
    const bw = w / n;
    const max = Math.max(0.05, ...peaks);
    peaks.forEach((p, i) => {
      const h = Math.max(1.5, (p / max) * (height - 6));
      const played = i / n < progress;
      g.fillStyle = played ? '#a78bfa' : 'rgba(255,255,255,0.16)';
      g.fillRect(i * bw, (height - h) / 2, Math.max(1, bw - 1), h);
    });
    if (!peaks.length) {
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(0, height / 2 - 1, w, 2);
    }
    g.fillStyle = '#8b5cf6';
    g.shadowColor = '#8b5cf6';
    g.shadowBlur = 10;
    g.fillRect(progress * w - 1, 0, 2, height);
  }, [peaks, progress, height]);

  return (
    <div className={`relative ${className}`}>
      {sections && (
        <div className="absolute inset-x-0 -top-5 flex text-[10px] font-mono uppercase tracking-wider text-mute-dim pointer-events-none">
          {sections.map((s) => (
            <span key={s.id} style={{ width: `${s.share * 100}%` }} className="truncate border-l border-white/10 pl-1">{s.label}</span>
          ))}
        </div>
      )}
      <canvas
        ref={ref}
        style={{ height }}
        className="w-full cursor-pointer rounded-lg"
        onClick={(e) => {
          if (!onSeek) return;
          const r = e.currentTarget.getBoundingClientRect();
          onSeek((e.clientX - r.left) / r.width);
        }}
      />
    </div>
  );
}
