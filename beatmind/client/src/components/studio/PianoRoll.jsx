import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useProject } from '../../store/project.js';
import { STEPS_PER_BAR, DRUM_NAMES, midiName, songBars } from '../../audio/arranger.js';

const ROW_H = 16;
const BARS_VISIBLE = 4;
let nid = 0;

// Piano roll visuel : clic sur une case vide = ajoute une note, clic sur une note = la supprime,
// glisser une note = la déplacer (temps et hauteur).
export default function PianoRoll({ track }) {
  const setNotes = useProject((s) => s.setNotes);
  const regenerate = useProject((s) => s.regenerateTrack);
  const params = useProject((s) => s.params);
  const [page, setPage] = useState(0);
  const [len, setLen] = useState(track.role === 'drums' ? 1 : 4);
  const ref = useRef(null);
  const drag = useRef(null);
  const notes = track.notes || [];
  const bars = songBars(params);
  const pages = Math.ceil(bars / BARS_VISIBLE);
  const isDrum = track.role === 'drums';

  const rows = useMemo(() => {
    if (isDrum) return Object.keys(DRUM_NAMES).map(Number).sort((a, b) => b - a);
    const ps = notes.map((n) => n.p);
    const lo = Math.max(12, (ps.length ? Math.min(...ps) : 48) - 5);
    const hi = Math.min(108, (ps.length ? Math.max(...ps) : 72) + 5);
    return Array.from({ length: hi - lo + 1 }, (_, i) => hi - i);
  }, [isDrum, notes]);

  useEffect(() => { setPage(0); setLen(track.role === 'drums' ? 1 : 4); }, [track.id, track.role]);

  const startStep = page * BARS_VISIBLE * STEPS_PER_BAR;
  const totalSteps = BARS_VISIBLE * STEPS_PER_BAR;
  const visible = notes.filter((n) => n.s + n.l > startStep && n.s < startStep + totalSteps && rows.includes(n.p));

  const pos = (e) => {
    const r = ref.current.getBoundingClientRect();
    const step = Math.floor(((e.clientX - r.left) / r.width) * totalSteps) + startStep;
    const row = Math.floor((e.clientY - r.top) / ROW_H);
    return { step, pitch: rows[Math.max(0, Math.min(rows.length - 1, row))] };
  };

  const onDown = (e) => {
    const { step, pitch } = pos(e);
    const hit = visible.find((n) => n.p === pitch && step >= Math.floor(n.s) && step < n.s + Math.max(1, n.l));
    if (hit) {
      drag.current = { id: hit.id, origin: { step, pitch }, moved: false, base: { s: hit.s, p: hit.p } };
      return;
    }
    setNotes(track.id, [...notes, { id: `u${(nid++).toString(36)}${Date.now().toString(36)}`, p: pitch, s: step, l: len, v: 0.8 }]);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const { step, pitch } = pos(e);
    const ds = step - drag.current.origin.step;
    const dp = rows.indexOf(drag.current.origin.pitch) - rows.indexOf(pitch);
    if (!ds && !dp) return;
    drag.current.moved = true;
    const newPitch = isDrum ? pitch : drag.current.base.p + dp;
    setNotes(track.id, notes.map((n) => (n.id === drag.current.id ? { ...n, s: Math.max(0, drag.current.base.s + ds), p: newPitch } : n)));
  };
  const onUp = () => {
    if (drag.current && !drag.current.moved) setNotes(track.id, notes.filter((n) => n.id !== drag.current.id));
    drag.current = null;
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2"><span className="label">Piano roll · {track.name}</span><span className="hint">Clic = ajouter / supprimer, glisser = déplacer</span></div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-mute">Durée
            <select className="rounded-md bg-ink-700 px-1.5 py-1 text-zinc-200 outline-none" value={len} onChange={(e) => setLen(Number(e.target.value))}>
              {[[1, '1/16'], [2, '1/8'], [4, '1/4'], [8, '1/2'], [16, '1 mesure']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <button type="button" className="btn-ghost btn-sm" onClick={() => regenerate(track.id)} title="Recalcule les notes à partir des paramètres"><RefreshCw size={12} /> Régénérer</button>
          <button type="button" className="btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={14} /></button>
          <span className="num text-xs text-mute">Mes. {page * BARS_VISIBLE + 1}–{Math.min(bars, (page + 1) * BARS_VISIBLE)} / {bars}</span>
          <button type="button" className="btn-ghost btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRight size={14} /></button>
        </div>
      </div>
      <div className="flex max-h-[360px] overflow-auto rounded-xl border border-white/[0.07] bg-ink-900">
        <div className="sticky left-0 z-10 shrink-0 border-r border-white/[0.07] bg-ink-850">
          {rows.map((p) => {
            const black = !isDrum && [1, 3, 6, 8, 10].includes(p % 12);
            return <div key={p} style={{ height: ROW_H }} className={`flex w-16 items-center justify-end pr-2 num text-[9.5px] ${black ? 'bg-ink-700 text-mute-dim' : 'text-mute'}`}>{isDrum ? DRUM_NAMES[p] : midiName(p)}</div>;
          })}
        </div>
        <div
          ref={ref}
          className="relative min-w-[640px] flex-1 cursor-crosshair select-none"
          style={{ height: rows.length * ROW_H }}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
        >
          {rows.map((p, i) => (
            <div key={p} className={`absolute inset-x-0 border-b border-white/[0.03] ${!isDrum && [1, 3, 6, 8, 10].includes(p % 12) ? 'bg-white/[0.02]' : ''}`} style={{ top: i * ROW_H, height: ROW_H }} />
          ))}
          {Array.from({ length: totalSteps }, (_, s) => (
            <div key={s} className={`absolute inset-y-0 ${s % 16 === 0 ? 'border-l border-neon/30' : s % 4 === 0 ? 'border-l border-white/[0.08]' : 'border-l border-white/[0.025]'}`} style={{ left: `${(s / totalSteps) * 100}%` }} />
          ))}
          {visible.map((n) => (
            <div key={n.id}
              className="absolute rounded-[3px] border border-neon-glow/60 bg-neon shadow-[0_0_8px_rgba(139,92,246,.6)]"
              style={{
                left: `${((n.s - startStep) / totalSteps) * 100}%`,
                width: `max(4px, calc(${(Math.max(0.5, n.l) / totalSteps) * 100}% - 1px))`,
                top: rows.indexOf(n.p) * ROW_H + 1,
                height: ROW_H - 2,
                opacity: 0.45 + (n.v ?? 0.8) * 0.55,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
