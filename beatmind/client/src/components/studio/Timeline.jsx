import { useEffect, useRef } from 'react';
import { useProject } from '../../store/project.js';
import { usePlayer } from '../../audio/usePlayer.js';
import { player } from '../../audio/player.js';
import { sectionRanges, songBars, STEPS_PER_BAR } from '../../audio/arranger.js';
import { secondsPerBar } from '../../audio/renderer.js';

function NotesLane({ track, bars, color }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);
    const total = bars * STEPS_PER_BAR;
    if (track.kind === 'audio') {
      g.fillStyle = `${color}40`;
      (track.clips || []).forEach((clip) => {
        const x = ((clip.startBar || 0) / bars) * w;
        g.fillRect(x, 4, Math.max(6, w - x), h - 8);
      });
      return;
    }
    const ps = (track.notes || []).map((n) => n.p);
    const lo = Math.min(...ps, 127);
    const hi = Math.max(...ps, 0);
    const range = Math.max(1, hi - lo);
    g.fillStyle = color;
    (track.notes || []).forEach((n) => {
      const x = (n.s / total) * w;
      const y = 4 + (1 - (n.p - lo) / range) * (h - 10);
      g.fillRect(x, y, Math.max(1.5, (n.l / total) * w - 0.5), 2.5);
    });
  }, [track, bars, color]);
  return <canvas ref={ref} className="h-full w-full" />;
}

export default function Timeline({ selectedId, onSelect }) {
  const params = useProject((s) => s.params);
  const updateTrack = useProject((s) => s.updateTrack);
  const p = usePlayer();
  const bars = songBars(params);
  const sections = sectionRanges(params);
  const progress = p.ownerId === 'project' && p.duration ? Math.min(1, p.time / (bars * secondsPerBar(params.bpm))) : 0;

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[180px_1fr] border-b border-white/[0.07] bg-ink-850">
          <div className="px-3 py-2 label">Pistes</div>
          <div className="relative h-8 cursor-pointer" onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            player.seek(((e.clientX - r.left) / r.width) * bars * secondsPerBar(params.bpm));
          }}>
            {sections.map((s) => (
              <div key={s.id} className="absolute inset-y-0 border-l border-neon/40 px-1.5 pt-1 text-[10.5px] font-semibold text-neon-glow" style={{ left: `${(s.startBar / bars) * 100}%`, width: `${(s.bars / bars) * 100}%` }}>
                {s.label}
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          {params.tracks.map((t) => (
            <div key={t.id} className={`grid grid-cols-[180px_1fr] border-b border-white/[0.04] ${selectedId === t.id ? 'bg-neon/[0.07]' : ''}`}>
              <button type="button" onClick={() => onSelect(t.id)} className="flex items-center gap-2 px-3 py-2 text-left">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color || '#8b5cf6' }} />
                <span className={`flex-1 truncate text-sm ${t.mute ? 'text-mute line-through' : ''}`}>{t.name}</span>
                <span onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { mute: !t.mute }); }} className={`rounded px-1.5 text-[10px] font-bold ${t.mute ? 'bg-red-500/70 text-white' : 'bg-white/[0.06] text-mute'}`}>M</span>
                <span onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { solo: !t.solo }); }} className={`rounded px-1.5 text-[10px] font-bold ${t.solo ? 'bg-amber-400 text-ink' : 'bg-white/[0.06] text-mute'}`}>S</span>
              </button>
              <div className="relative h-12 cursor-pointer" onClick={() => onSelect(t.id)}>
                {Array.from({ length: bars }, (_, b) => <div key={b} className={`absolute inset-y-0 border-l ${b % 4 === 0 ? 'border-white/[0.07]' : 'border-white/[0.025]'}`} style={{ left: `${(b / bars) * 100}%` }} />)}
                <NotesLane track={t} bars={bars} color={t.color || (t.mute ? '#5c5c66' : '#a78bfa')} />
              </div>
            </div>
          ))}
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-neon shadow-[0_0_10px_#8b5cf6]" style={{ left: `calc(180px + (100% - 180px) * ${progress})` }} />
        </div>
      </div>
    </div>
  );
}
