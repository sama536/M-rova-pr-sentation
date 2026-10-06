import { Plus, Trash2, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import { useProject } from '../../store/project.js';
import Param, { SliderParam } from '../ui/Param.jsx';
import { KEYS, SCALES, SECTION_TYPES } from '@shared/catalog.js';
import { degreeToMidi, midiName } from '../../audio/arranger.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const DRUM_PATTERNS = [
  ['trap', 'Trap', 'Snare sur le 3, hats rapides'], ['drill', 'Drill', 'Snares décalées, hats en triolets'],
  ['four', 'Four on the floor', 'Kick sur chaque temps (house/techno)'], ['boombap', 'Boom bap', 'Kick/snare 90s'],
  ['swing', 'Swing jazz', 'Ride et rimshot feutrés'], ['afro', 'Afro', 'Percus syncopées + shaker'],
  ['dembow', 'Dembow', 'Reggaeton'], ['rnb', 'R&B', 'Groove posé'], ['phonk', 'Phonk', 'Cowbell + 808'],
  ['hyperpop', 'Hyperpop', 'Kick serré, énergie max'], ['amapiano', 'Amapiano', 'Log drum + shakers'], ['rage', 'Rage', 'Kick agressif'],
];

export default function BeatParamsEditor({ compact = false }) {
  const params = useProject((s) => s.params);
  const update = useProject((s) => s.updateParams);
  if (!params) return null;

  const setSection = (i, patch) => update({ structure: params.structure.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const moveSection = (i, d) => {
    const st = [...params.structure];
    const j = i + d;
    if (j < 0 || j >= st.length) return;
    [st[i], st[j]] = [st[j], st[i]];
    update({ structure: st });
  };
  const chordName = (deg) => midiName(degreeToMidi(params, deg, 4)).replace(/\d/, '');

  return (
    <div className="grid gap-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Param label="Titre" hint="Nom du morceau">
          <input className="input" value={params.title} onChange={(e) => update({ title: e.target.value })} />
        </Param>
        <SliderParam label="BPM" hint="Vitesse : 70 lent, 140 trap, 125 house" value={params.bpm} min={60} max={200} step={1} onChange={(bpm) => update({ bpm })} />
        <Param label="Tonalité" hint="Note de base du morceau">
          <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-2">
            <select className="input" value={params.key} onChange={(e) => update({ key: e.target.value })}>
              {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <select className="input" value={params.scale} onChange={(e) => update({ scale: e.target.value })}>
              {Object.entries(SCALES).map(([id, s]) => <option key={id} value={id}>{s.label} — {s.hint}</option>)}
            </select>
          </div>
        </Param>
        <SliderParam label="Swing" hint="Décale les contretemps : groove humain" value={Math.round((params.swing || 0) * 100)} min={0} max={50} unit="%" onChange={(v) => update({ swing: v / 100 })} />
      </div>

      {!compact && (
        <div className="grid gap-5 md:grid-cols-3">
          <Param label="Rythme" hint="Motif de batterie">
            <select className="input" value={params.drums?.pattern} onChange={(e) => update({ drums: { ...params.drums, pattern: e.target.value } })}>
              {DRUM_PATTERNS.map(([id, label, hint]) => <option key={id} value={id}>{label} — {hint}</option>)}
            </select>
          </Param>
          <SliderParam label="Rolls" hint="Rafales de hi-hats" value={Math.round((params.drums?.hatRolls ?? 0) * 100)} min={0} max={100} unit="%" onChange={(v) => update({ drums: { ...params.drums, hatRolls: v / 100 } })} />
          <SliderParam label="Densité" hint="Nombre de coups de hats" value={Math.round((params.drums?.density ?? 0.7) * 100)} min={0} max={100} unit="%" onChange={(v) => update({ drums: { ...params.drums, density: v / 100 } })} />
        </div>
      )}

      <Param label="Progression d'accords" hint="Un accord par mesure, en boucle. Clique pour changer le degré.">
        <div className="flex flex-wrap items-center gap-2">
          {params.progression.map((deg, i) => (
            <div key={i} className="flex flex-col items-center rounded-xl border border-white/[0.08] bg-ink-800 px-1 py-1">
              <select
                className="bg-transparent text-center font-display text-lg font-semibold text-neon-glow outline-none"
                value={deg}
                onChange={(e) => update({ progression: params.progression.map((d, j) => (j === i ? Number(e.target.value) : d)) })}
              >
                {ROMAN.map((r, d) => <option key={r} value={d} className="bg-ink">{r}</option>)}
              </select>
              <span className="num text-[10px] text-mute">{chordName(deg)}</span>
            </div>
          ))}
          {params.progression.length < 8 && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => update({ progression: [...params.progression, params.progression[0]] })}><Plus size={13} /></button>
          )}
          {params.progression.length > 2 && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => update({ progression: params.progression.slice(0, -1) })}><Trash2 size={13} /></button>
          )}
        </div>
      </Param>

      <Param label="Structure" hint="Sections du morceau, leur longueur et leur énergie (qui joue quand)">
        <div className="grid gap-2">
          {params.structure.map((s, i) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-ink-800 px-3 py-2 sm:grid sm:grid-cols-[auto_150px_110px_1fr_auto]">
              <span className="num text-[11px] text-mute-dim w-5">{String(i + 1).padStart(2, '0')}</span>
              <select className="bg-transparent text-sm font-semibold outline-none" value={s.type} onChange={(e) => setSection(i, { type: e.target.value, label: SECTION_TYPES.find((t) => t.id === e.target.value).label })}>
                {SECTION_TYPES.map((t) => <option key={t.id} value={t.id} className="bg-ink">{t.label}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-mute">
                <input type="number" min={1} max={32} className="w-12 rounded-md bg-ink-700 px-1.5 py-1 text-center num text-zinc-100 outline-none" value={s.bars} onChange={(e) => setSection(i, { bars: Math.max(1, Math.min(32, Number(e.target.value) || 1)) })} />
                mesures
              </label>
              <div className="hidden sm:flex items-center gap-2">
                <span className="hint">Énergie</span>
                <input type="range" className="bm-range" style={{ '--fill': `${s.energy * 100}%` }} min={0} max={100} value={Math.round(s.energy * 100)} onChange={(e) => setSection(i, { energy: Number(e.target.value) / 100 })} />
              </div>
              <div className="ml-auto flex items-center gap-1">
                <button type="button" onClick={() => moveSection(i, -1)} className="p-1 text-mute hover:text-white" aria-label="Monter"><ChevronUp size={14} /></button>
                <button type="button" onClick={() => moveSection(i, 1)} className="p-1 text-mute hover:text-white" aria-label="Descendre"><ChevronDown size={14} /></button>
                <button type="button" onClick={() => params.structure.length > 1 && update({ structure: params.structure.filter((_, j) => j !== i) })} className="p-1 text-mute hover:text-red-400" aria-label="Supprimer"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {SECTION_TYPES.map((t) => (
              <button key={t.id} type="button" className="btn-ghost btn-sm" onClick={() => update({ structure: [...params.structure, { id: `sec_${Date.now().toString(36)}`, type: t.id, label: t.label, bars: t.defaultBars, energy: t.id === 'refrain' ? 0.95 : 0.6 }] })}>
                <Plus size={12} /> {t.label}
              </button>
            ))}
            <button type="button" className="btn-ghost btn-sm ml-auto" title="Recalcule les notes des pistes non modifiées à la main" onClick={() => update({ structure: [...params.structure] })}>
              <RefreshCw size={12} /> Réarranger
            </button>
          </div>
        </div>
      </Param>
    </div>
  );
}
