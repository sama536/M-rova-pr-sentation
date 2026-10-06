import { useProject } from '../../store/project.js';
import Slider from '../ui/Slider.jsx';

export default function Mixer({ selectedId, onSelect }) {
  const params = useProject((s) => s.params);
  const masterVolume = useProject((s) => s.masterVolume);
  const setMaster = useProject((s) => s.setMaster);
  const updateTrack = useProject((s) => s.updateTrack);

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2"><span className="label">Mixer</span><span className="hint">Fader = volume, Pan = gauche/droite, M = muet, S = solo</span></div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {params.tracks.map((t) => (
          <div key={t.id} onClick={() => onSelect(t.id)}
            className={`flex w-[86px] shrink-0 cursor-pointer flex-col items-center gap-2 rounded-xl border px-2 py-3 ${selectedId === t.id ? 'border-neon bg-neon/[0.07]' : 'border-white/[0.07] bg-ink-800'}`}>
            <span className="w-full truncate text-center text-[11.5px] font-semibold" title={t.name}>{t.name}</span>
            <div className="w-full">
              <Slider value={Math.round((t.pan ?? 0) * 100)} min={-100} max={100} onChange={(v) => updateTrack(t.id, { pan: v / 100 })} ariaLabel={`Pan ${t.name}`} />
              <div className="num text-center text-[9.5px] text-mute">{t.pan ? `${t.pan < 0 ? 'G' : 'D'}${Math.abs(Math.round(t.pan * 100))}` : 'C'}</div>
            </div>
            <Slider vertical value={Math.round((t.volume ?? 0.8) * 100)} min={0} max={120} onChange={(v) => updateTrack(t.id, { volume: v / 100 })} ariaLabel={`Volume ${t.name}`} />
            <span className="num text-[10.5px] text-neon-glow">{Math.round((t.volume ?? 0.8) * 100)}</span>
            <div className="flex gap-1">
              <button type="button" onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { mute: !t.mute }); }} className={`h-6 w-6 rounded text-[10px] font-bold ${t.mute ? 'bg-red-500/80 text-white' : 'bg-white/[0.06] text-mute'}`}>M</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { solo: !t.solo }); }} className={`h-6 w-6 rounded text-[10px] font-bold ${t.solo ? 'bg-amber-400 text-ink' : 'bg-white/[0.06] text-mute'}`}>S</button>
            </div>
          </div>
        ))}
        <div className="flex w-[86px] shrink-0 flex-col items-center gap-2 rounded-xl border border-neon/50 bg-neon/10 px-2 py-3 shadow-neon">
          <span className="text-[11.5px] font-bold text-neon-glow">MASTER</span>
          <div className="h-[34px]" />
          <Slider vertical value={Math.round(masterVolume * 100)} min={0} max={120} onChange={(v) => setMaster(v / 100)} ariaLabel="Volume master" />
          <span className="num text-[10.5px] text-neon-glow">{Math.round(masterVolume * 100)}</span>
          <span className="hint text-center text-[10px]">Limiteur actif</span>
        </div>
      </div>
    </div>
  );
}
