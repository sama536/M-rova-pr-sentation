import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wand2, Loader2, Plus, X, Play, Pause, Save, Mic2, SlidersHorizontal, Sparkles, Disc3, RotateCcw } from 'lucide-react';
import { Page } from '../components/Layout.jsx';
import SectionHeader from '../components/ui/SectionHeader.jsx';
import Chip from '../components/ui/Chip.jsx';
import Waveform from '../components/ui/Waveform.jsx';
import ReferenceInput, { analyzePendingReferences } from '../components/beat/ReferenceInput.jsx';
import BeatParamsEditor from '../components/beat/BeatParamsEditor.jsx';
import { toast } from '../components/ui/Toaster.jsx';
import { useProject } from '../store/project.js';
import { api } from '../lib/api.js';
import { useSaveProject } from '../lib/useSave.js';
import { usePlayer, useProjectRender } from '../audio/usePlayer.js';
import { player } from '../audio/player.js';
import { sectionRanges } from '../audio/arranger.js';
import { STYLES, INSTRUMENTS, CREDIT_COSTS } from '@shared/catalog.js';
import { beatesTrack } from '../store/beates.js';

const EXAMPLES = [
  'Drill froide et mélancolique, flûte qui pleure, 808 qui glissent, ambiance Londres sous la pluie',
  'Afro solaire pour l\'été, guitare légère, groove qui donne envie de danser',
  'Rage beat agressif, lead synthé saturé, énergie de concert',
  'R&B nocturne, piano Rhodes, saxophone, très smooth et intime',
];

const STEPS = ['Analyse du prompt…', 'Claude écrit les paramètres de prod…', 'Arrangement des pistes…', 'Envoi à Suno pour l\'audio…'];

export default function BeatAI() {
  const s = useProject();
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const { save, saving } = useSaveProject();
  const { render, rendering, peaks } = useProjectRender();
  const p = usePlayer();
  const pollRef = useRef(null);
  const triesRef = useRef({ key: '', n: 0 });

  const toggle = (key, id) => s.setField({ [key]: s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id] });

  // Suivi de la génération Suno (asynchrone côté Suno)
  useEffect(() => {
    clearInterval(pollRef.current);
    const pending = s.suno?.clips?.filter((c) => !['complete', 'error'].includes(c.status));
    if (!pending?.length) return undefined;
    const key = s.suno.clips.map((c) => c.id).join();
    if (triesRef.current.key !== key) triesRef.current = { key, n: 0 };
    pollRef.current = setInterval(async () => {
      triesRef.current.n += 1;
      const tries = triesRef.current.n;
      try {
        const { clips } = await api.sunoStatus(s.suno.clips.map((c) => c.id));
        const done = clips.find((c) => c.status === 'complete' && c.audioUrl);
        useProject.getState().setSuno({ ...s.suno, clips, selectedId: s.suno.selectedId || done?.id || null });
        if (done) toast.success('Audio Suno prêt !');
      } catch (e) {
        if (tries > 3) { toast.error(`Suno : ${e.message}`); clearInterval(pollRef.current); }
      }
      if (tries > 60) clearInterval(pollRef.current);
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [s.suno]);

  const generate = async () => {
    if (!s.prompt.trim() && !s.styles.length && !s.references.length && !s.pendingRefs.length) return toast.error('Écris un prompt, choisis un style ou colle une référence YouTube.');
    setBusy(true);
    setStep(0);
    const timer = setInterval(() => setStep((x) => Math.min(x + 1, STEPS.length - 1)), 1600);
    try {
      // Les liens collés mais pas encore analysés sont analysés maintenant : ils comptent dans la génération
      let refs = s.references;
      if (useProject.getState().pendingRefs.length) {
        try { refs = await analyzePendingReferences(); } catch (e) { toast.error(`Références : ${e.message}`); }
      }
      const res = await api.generateBeat({
        prompt: s.prompt, styles: s.styles, instruments: [...s.instruments, ...s.customInstruments],
        references: refs.map(({ thumbnail, description, url, ...rest }) => rest),
        referenceWeight: useProject.getState().referenceWeight,
      });
      player.stop();
      s.setParams(res.params, { suno: res.suno ? { clips: res.suno, selectedId: null } : null });
      res.warnings?.forEach((w) => toast.info(w));
      beatesTrack('beat');
      toast.success(`« ${res.params.title} » généré${res.params.source === 'claude' ? ' par Claude' : ''} !`);
      setTimeout(() => render({ play: true, keepPosition: false }), 50);
    } catch (e) {
      toast.error(e.message);
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  };

  const sections = s.params ? sectionRanges(s.params) : [];
  const total = sections.at(-1)?.endBar || 1;
  const isProjectPlaying = p.playing && p.ownerId === 'project';

  return (
    <Page
      eyebrow="Beat AI"
      title="Décris ta prod, on la fabrique."
      intro="Prompt + références + styles + instruments. Claude calcule tous les paramètres, Suno génère l'audio, et tu gardes la main sur tout."
      actions={s.params && (
        <>
          <button type="button" className="btn-ghost" onClick={() => { if (confirm('Repartir d\'un projet vide ?')) { player.stop(); s.reset(); } }}><RotateCcw size={15} /> Nouveau</button>
          <button type="button" className="btn-ghost" onClick={() => save()} disabled={saving}><Save size={15} /> Sauvegarder</button>
        </>
      )}
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-6">
          <section className="panel p-6">
            <SectionHeader index="01" title="Ton idée" hint="Décris l'ambiance, les artistes qui t'inspirent, les sons, l'énergie. Plus c'est précis, mieux c'est." />
            <textarea
              className="input min-h-[120px] resize-y text-base leading-relaxed"
              value={s.prompt}
              onChange={(e) => s.setField({ prompt: e.target.value })}
              placeholder="ex. Une drill sombre avec une flûte mélancolique, des 808 qui glissent et un refrain planant…"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => s.setField({ prompt: ex })} className="rounded-full border border-white/[0.06] px-3 py-1 text-[11.5px] text-mute hover:border-neon/40 hover:text-zinc-200">
                  {ex.slice(0, 42)}…
                </button>
              ))}
            </div>
          </section>

          <section className="panel p-6">
            <SectionHeader index="02" title="Références YouTube" hint="Colle un ou plusieurs sons qui t'inspirent : BPM, flow, vibe, structure et mood sont analysés et servent de repère." />
            <ReferenceInput />
          </section>

          <section className="panel p-6">
            <SectionHeader index="03" title="Styles" hint="Sélectionne-en plusieurs pour les fusionner (ex. drill × jazz)." right={<span className="num text-xs text-mute">{s.styles.length} choisi(s)</span>} />
            <div className="flex flex-wrap gap-2">
              {STYLES.map((st) => (
                <Chip key={st.id} active={s.styles.includes(st.id)} onClick={() => toggle('styles', st.id)} title={st.hint}>{st.label}</Chip>
              ))}
            </div>
            {s.styles.length > 0 && (
              <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
                {s.styles.map((id) => { const st = STYLES.find((x) => x.id === id); return <p key={id} className="hint"><span className="text-zinc-300">{st.label}</span> — {st.hint} · <span className="num">{st.bpm[0]}–{st.bpm[1]} BPM</span></p>; })}
              </div>
            )}
          </section>

          <section className="panel p-6">
            <SectionHeader index="04" title="Instruments" hint="Choisis ceux que tu veux entendre, ou tape les tiens. Vide = l'IA choisit selon le style." />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {INSTRUMENTS.map((ins) => (
                <button key={ins.id} type="button" onClick={() => toggle('instruments', ins.id)} className={`flex items-baseline gap-2 rounded-xl border px-3 py-2 text-left transition ${s.instruments.includes(ins.id) ? 'border-neon bg-neon/10 shadow-neon' : 'border-white/[0.07] hover:border-neon/40'}`}>
                  <span className="text-sm font-semibold">{ins.label}</span>
                  <span className="hint truncate">{ins.hint}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {s.customInstruments.map((c) => (
                <span key={c} className="chip-on">{c}<X size={12} className="cursor-pointer" onClick={() => s.setField({ customInstruments: s.customInstruments.filter((x) => x !== c) })} /></span>
              ))}
              <div className="flex gap-2">
                <input className="input w-56 py-1.5" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Autre : kalimba, orgue, trompette…"
                  onKeyDown={(e) => { if (e.key === 'Enter' && custom.trim()) { s.setField({ customInstruments: [...new Set([...s.customInstruments, custom.trim().toLowerCase()])] }); setCustom(''); } }} />
                <button type="button" className="btn-ghost btn-sm" onClick={() => { if (custom.trim()) { s.setField({ customInstruments: [...new Set([...s.customInstruments, custom.trim().toLowerCase()])] }); setCustom(''); } }}><Plus size={13} /></button>
              </div>
            </div>
          </section>
        </div>

        <aside className="xl:sticky xl:top-6 h-fit grid gap-4">
          <div className="panel-hi p-6">
            <div className="label text-neon-soft">Générer</div>
            <p className="hint mt-1">Coûte {CREDIT_COSTS.beat} crédits. Tu pourras tout modifier ensuite.</p>
            <div className="mt-4 grid gap-1.5 text-xs text-zinc-400">
              <span>Styles : <span className="text-zinc-200">{s.styles.length ? s.styles.map((id) => STYLES.find((x) => x.id === id)?.label).join(' × ') : 'auto'}</span></span>
              <span>Instruments : <span className="text-zinc-200">{[...s.instruments, ...s.customInstruments].join(', ') || 'auto'}</span></span>
              <span>Références : <span className="text-zinc-200">{s.references.length}{s.pendingRefs.length ? ` (+${s.pendingRefs.length} à analyser)` : ''}</span>{(s.references.length > 0 || s.pendingRefs.length > 0) && <span className="text-mute"> · influence {Math.round(s.referenceWeight * 100)} %</span>}</span>
            </div>
            <button type="button" data-beates="generate" className="btn-primary mt-5 w-full py-3 text-base" onClick={generate} disabled={busy}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />} {s.params ? 'Regénérer' : 'Générer le beat'}
            </button>
            {busy && (
              <ol className="mt-4 grid gap-1.5">
                {STEPS.map((t, i) => (
                  <li key={t} className={`flex items-center gap-2 text-xs ${i < step ? 'text-zinc-500 line-through' : i === step ? 'text-neon-glow' : 'text-mute-dim'}`}>
                    {i === step ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {t}
                  </li>
                ))}
              </ol>
            )}
          </div>
          {s.suno?.clips?.length > 0 && (
            <div className="panel p-5">
              <div className="flex items-center gap-2 label"><Disc3 size={13} className="text-neon-soft" /> Audio Suno</div>
              <p className="hint mt-1">Suno compose en parallèle (1 à 3 min). Choisis la version à utiliser.</p>
              <div className="mt-3 grid gap-2">
                {s.suno.clips.map((c, i) => (
                  <button key={c.id} type="button" disabled={c.status !== 'complete'}
                    onClick={() => s.setSuno({ ...s.suno, selectedId: c.id })}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${s.suno.selectedId === c.id ? 'border-neon bg-neon/10' : 'border-white/[0.07]'}`}>
                    <span>Version {i + 1}</span>
                    <span className="num text-[11px] text-mute">{c.status === 'complete' ? 'prête' : c.status === 'error' ? 'échec' : <span className="inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> {c.status}</span>}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {s.params && (
        <section className="mt-8 panel-hi p-6 animate-rise">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="label text-neon-soft">Résultat {s.params.source === 'claude' ? '· Claude' : '· moteur local'}</div>
              <h2 className="title-xl mt-1 text-3xl">{s.params.title}</h2>
              <p className="mt-1 text-sm text-mute">{s.params.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => (isProjectPlaying ? player.pause() : render({ play: true }))}>
                {rendering ? <Loader2 size={16} className="animate-spin" /> : isProjectPlaying ? <Pause size={16} /> : <Play size={16} />} {isProjectPlaying ? 'Pause' : 'Écouter'}
              </button>
              <Link to="/voice" className="btn-ghost"><Mic2 size={15} /> Ajouter des voix</Link>
              <Link to="/studio" className="btn-ghost"><SlidersHorizontal size={15} /> Ouvrir le studio</Link>
            </div>
          </div>

          <div className="mt-10">
            <Waveform
              peaks={peaks}
              progress={p.ownerId === 'project' && p.duration ? p.time / p.duration : 0}
              onSeek={(r) => (p.ownerId === 'project' ? player.seek(r * p.duration) : render({ play: true }))}
              sections={sections.map((x) => ({ id: x.id, label: x.label, share: x.bars / total }))}
              height={84}
            />
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
            <BeatParamsEditor />
            <div className="grid h-fit gap-5">
              <div>
                <div className="label mb-2">Pistes</div>
                <div className="grid gap-1.5">
                  {s.params.tracks.filter((t) => t.role !== 'vocal').map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg bg-ink-800 px-3 py-2 text-sm">
                      <span className={t.mute ? 'text-mute line-through' : ''}>{t.name}</span>
                      <span className="hint">{t.kind === 'audio' ? 'audio' : `${t.notes?.length || 0} notes`}</span>
                    </div>
                  ))}
                </div>
              </div>
              {s.params.referenceNotes?.length > 0 && (
                <div className="rounded-xl border border-neon/30 bg-neon/5 p-3">
                  <div className="label mb-2 text-neon-soft">Repris de tes références</div>
                  <ul className="grid gap-1.5 text-[13px] text-zinc-300">{s.params.referenceNotes.map((n) => <li key={n} className="flex gap-2"><span className="text-neon-soft">▸</span>{n}</li>)}</ul>
                </div>
              )}
              <div>
                <div className="label mb-2">Notes de prod</div>
                <ul className="grid gap-1.5 text-[13px] text-zinc-300">{s.params.productionNotes?.map((n) => <li key={n} className="flex gap-2"><span className="text-neon-soft">▸</span>{n}</li>)}</ul>
              </div>
              <div>
                <div className="label mb-2">Mix <span className="num normal-case tracking-normal text-mute">· cible {s.params.mix?.loudness} LUFS</span></div>
                <ul className="grid gap-1.5 text-[13px] text-zinc-300">{s.params.mix?.notes?.map((n) => <li key={n} className="flex gap-2"><span className="text-neon-soft">▸</span>{n}</li>)}</ul>
              </div>
            </div>
          </div>
        </section>
      )}
    </Page>
  );
}
