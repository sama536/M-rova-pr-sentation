import { useMemo, useState } from 'react';
import { Loader2, Wand2, Play, Volume2, Trash2, Zap } from 'lucide-react';
import { useProject, VOICE_COLORS } from '../../store/project.js';
import { FLOW_MODES, VOICE_PARAMS, CREDIT_COSTS, flowById } from '@shared/catalog.js';
import Chip from '../ui/Chip.jsx';
import Toggle from '../ui/Toggle.jsx';
import { SliderParam } from '../ui/Param.jsx';
import { sectionRanges } from '../../audio/arranger.js';
import { secondsPerBar } from '../../audio/renderer.js';
import { countSyllables, useVocalActions } from '../../lib/vocals.js';

const FLOW_INTENSITY = { sung_slow: 0.25, spoken: 0.3, sung_fast: 0.5, rap_laid: 0.55, rap_fast: 0.8, rap_ultra: 1 };

export default function VocalTimeline() {
  const { params, voices, vocalTimeline, lyrics, takes, setSectionVocal, setSectionLines, setTake } = useProject();
  const sections = useMemo(() => (params ? sectionRanges(params) : []), [params]);
  const [selected, setSelected] = useState(null);
  const { synthesize, playTake, previewSpeech, busyKey } = useVocalActions();
  if (!params) return null;
  const total = sections.at(-1)?.endBar || 1;
  const current = sections.find((s) => s.id === selected) || sections[0];
  const tl = vocalTimeline[current.id] || { flow: 'rap_laid', voices: [1] };
  const flow = flowById(tl.flow) || FLOW_MODES[2];
  const lines = lyrics.sections[current.id]?.lines || [];
  const punchlines = new Set(lyrics.sections[current.id]?.punchlines || []);
  const syll = lines.reduce((a, l) => a + countSyllables(l), 0);
  const perBar = syll / current.bars;
  const target = flow.syllablesPerBeat * 4;
  const custom = ['autotune', 'energy', 'harmonies'].some((k) => tl[k] != null) || tl.backs != null;
  const seconds = current.bars * secondsPerBar(params.bpm);

  return (
    <div className="grid gap-5">
      {/* Bande de timeline */}
      <div className="overflow-x-auto">
        <div className="flex min-w-[640px] gap-1">
          {sections.map((s) => {
            const t = vocalTimeline[s.id] || {};
            const f = flowById(t.flow);
            const nLines = lyrics.sections[s.id]?.lines?.filter(Boolean).length || 0;
            const active = s.id === current.id;
            return (
              <button key={s.id} type="button" onClick={() => setSelected(s.id)} style={{ flexGrow: s.bars, flexBasis: 0 }}
                className={`relative min-w-[90px] overflow-hidden rounded-xl border p-2.5 text-left transition ${active ? 'border-neon shadow-neon' : 'border-white/[0.07] hover:border-neon/40'}`}>
                <span className="absolute inset-0 bg-neon" style={{ opacity: 0.05 + (FLOW_INTENSITY[t.flow] || 0.3) * 0.22 }} />
                <span className="relative block">
                  <span className="flex items-center justify-between gap-1">
                    <span className="text-[13px] font-semibold">{s.label}</span>
                    <span className="num text-[10px] text-mute">{s.bars}m</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-neon-glow">{f?.label || '—'}</span>
                  <span className="mt-2 flex items-center gap-1">
                    {(t.voices || []).map((slot) => (
                      <span key={slot} className="h-2.5 w-2.5 rounded-full" style={{ background: VOICE_COLORS[slot - 1], opacity: takes[`${s.id}:${slot}`] ? 1 : 0.35 }} title={takes[`${s.id}:${slot}`] ? 'Prise générée' : 'Pas encore générée'} />
                    ))}
                    <span className="ml-auto num text-[10px] text-mute">{nLines} l.</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-1 flex min-w-[640px] justify-between num text-[10px] text-mute-dim">
          <span>0:00</span><span>{total} mesures · {Math.round(total * secondsPerBar(params.bpm))} s</span>
        </div>
      </div>

      {/* Éditeur de la section */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-5">
          <div>
            <div className="flex items-baseline gap-2"><span className="label">Débit · {current.label}</span><span className="hint">Comment les paroles sont posées dans cette section</span></div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
              {FLOW_MODES.map((f) => (
                <button key={f.id} type="button" onClick={() => setSectionVocal(current.id, { flow: f.id })}
                  className={`rounded-lg border px-3 py-2 text-left transition ${tl.flow === f.id ? 'border-neon bg-neon/10' : 'border-white/[0.06] hover:border-neon/40'}`}>
                  <div className="text-[13px] font-semibold">{f.label}</div>
                  <div className="hint">{f.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex items-baseline gap-2"><span className="label">Paroles</span><span className="hint">Une ligne ≈ 2 mesures. Les punchlines sont surlignées.</span></span>
              <span className={`num text-[11px] ${Math.abs(perBar - target) > target * 0.45 && lines.length ? 'text-amber-300' : 'text-mute'}`}>
                {perBar.toFixed(1)} syll./mesure · cible ≈ {target}
              </span>
            </div>
            <textarea
              className="input mt-2 min-h-[180px] font-mono text-[13px] leading-7"
              value={lines.join('\n')}
              onChange={(e) => setSectionLines(current.id, e.target.value.split('\n'))}
              placeholder={`Écris ou colle les paroles de : ${current.label}\nUne ligne par phrase.`}
            />
            {punchlines.size > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[...punchlines].map((l) => <span key={l} className="inline-flex items-center gap-1 rounded-md bg-neon/15 px-2 py-0.5 text-[11.5px] text-neon-glow"><Zap size={11} />{l}</span>)}
              </div>
            )}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-600">
              <div className="h-full bg-neon transition-all" style={{ width: `${Math.min(100, (perBar / (target * 1.5)) * 100)}%` }} />
            </div>
            <p className="hint mt-1">Section de {seconds.toFixed(1)} s. Trop de syllabes pour le débit choisi = débit trop rapide, pas assez = trous.</p>
          </div>
        </div>

        <div className="grid h-fit gap-4">
          <div>
            <div className="flex items-baseline gap-2"><span className="label">Qui chante ?</span><span className="hint">Feat : plusieurs voix possibles</span></div>
            <div className="mt-2 flex flex-wrap gap-2">
              {voices.length === 0 && <span className="hint">Ajoute une voix au-dessus.</span>}
              {voices.map((v) => {
                const on = (tl.voices || []).includes(v.slot);
                return (
                  <Chip key={v.slot} active={on} onClick={() => setSectionVocal(current.id, { voices: on ? tl.voices.filter((x) => x !== v.slot) : [...(tl.voices || []), v.slot].sort() })}>
                    <span className="h-2 w-2 rounded-full" style={{ background: VOICE_COLORS[v.slot - 1] }} /> {v.name}
                  </Chip>
                );
              })}
            </div>
          </div>

          <Toggle label="Réglages propres" hint="Sinon : réglages de chaque voix" checked={custom}
            onChange={(on) => setSectionVocal(current.id, on ? { autotune: 50, energy: 70, harmonies: 1, backs: true } : { autotune: null, energy: null, harmonies: null, backs: null })} />
          {custom && (
            <div className="grid gap-3 rounded-xl border border-white/[0.06] p-3">
              {VOICE_PARAMS.filter((p) => ['autotune', 'energy', 'harmonies'].includes(p.key)).map((p) => (
                <SliderParam key={p.key} label={p.label} hint={p.hint} unit={p.unit} min={p.min} max={p.max} step={p.step}
                  value={tl[p.key] ?? 0} onChange={(v) => setSectionVocal(current.id, { [p.key]: v })} />
              ))}
              <Toggle label="Backs" hint="Doublages auto dans cette section" checked={!!tl.backs} onChange={(v) => setSectionVocal(current.id, { backs: v })} />
            </div>
          )}

          <div className="grid gap-2">
            <div className="flex items-baseline gap-2"><span className="label">Prises</span><span className="hint">{CREDIT_COSTS.voiceSynth} crédits par génération</span></div>
            {(tl.voices || []).map((slot) => {
              const v = voices.find((x) => x.slot === slot);
              if (!v) return null;
              const key = `${current.id}:${slot}`;
              const take = takes[key];
              return (
                <div key={slot} className="flex items-center gap-2 rounded-lg bg-ink-800 px-3 py-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: VOICE_COLORS[slot - 1] }} />
                  <span className="flex-1 truncate text-sm">{v.name}</span>
                  {take?.url && <button type="button" className="p-1.5 text-neon-soft hover:text-white" title="Écouter la prise traitée" onClick={() => playTake(current.id, slot)}><Play size={14} /></button>}
                  {take?.url && <button type="button" className="p-1.5 text-mute hover:text-red-400" title="Supprimer la prise" onClick={() => setTake(current.id, slot, null)}><Trash2 size={14} /></button>}
                  <button type="button" className="p-1.5 text-mute hover:text-white" title="Prévisualiser avec la voix du navigateur" onClick={() => previewSpeech(current.id, slot)}><Volume2 size={14} /></button>
                  <button type="button" className="btn-primary btn-sm" disabled={busyKey === key} onClick={() => synthesize(current.id, slot)}>
                    {busyKey === key ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} {take?.url ? 'Refaire' : 'Générer'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
