import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, Loader2, Save, ChevronDown, ChevronUp, Wand2, Plus, Square, History } from 'lucide-react';
import { Page } from '../components/Layout.jsx';
import Waveform from '../components/ui/Waveform.jsx';
import SectionHeader from '../components/ui/SectionHeader.jsx';
import BeatParamsEditor from '../components/beat/BeatParamsEditor.jsx';
import Timeline from '../components/studio/Timeline.jsx';
import Mixer from '../components/studio/Mixer.jsx';
import PianoRoll from '../components/studio/PianoRoll.jsx';
import TrackFx from '../components/studio/TrackFx.jsx';
import ExportPanel from '../components/studio/ExportPanel.jsx';
import Slider from '../components/ui/Slider.jsx';
import { toast } from '../components/ui/Toaster.jsx';
import { useProject } from '../store/project.js';
import { usePlayer, useProjectRender } from '../audio/usePlayer.js';
import { player } from '../audio/player.js';
import { sectionRanges } from '../audio/arranger.js';
import { useSaveProject } from '../lib/useSave.js';
import { api } from '../lib/api.js';
import { fmtTime } from '../lib/format.js';
import { INSTRUMENTS, CREDIT_COSTS } from '@shared/catalog.js';

export default function Studio() {
  const s = useProject();
  const [advanced, setAdvanced] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [quickPrompt, setQuickPrompt] = useState('');
  const [regen, setRegen] = useState(false);
  const { render, rendering, peaks } = useProjectRender();
  const p = usePlayer();
  const { save, saving } = useSaveProject();

  if (!s.params) {
    return (
      <Page eyebrow="Studio" title="Le studio est vide.">
        <div className="panel-hi grid place-items-center gap-4 p-10 text-center">
          <p className="text-zinc-300">Commence par générer un beat, ou ouvre un projet de ta bibliothèque.</p>
          <div className="flex gap-3">
            <Link to="/beat" className="btn-primary"><Wand2 size={16} /> Beat AI</Link>
            <Link to="/library" className="btn-ghost">Bibliothèque</Link>
          </div>
        </div>
      </Page>
    );
  }

  const isMine = p.ownerId === 'project';
  const playing = p.playing && isMine;
  const sections = sectionRanges(s.params);
  const total = sections.at(-1).endBar;
  const selected = s.params.tracks.find((t) => t.id === selectedId) || s.params.tracks.find((t) => t.kind !== 'audio') || s.params.tracks[0];

  const quickRegen = async () => {
    if (!quickPrompt.trim()) return;
    setRegen(true);
    try {
      const res = await api.generateBeat({ prompt: `${s.prompt}\n${quickPrompt}`.trim(), styles: s.styles, instruments: [...s.instruments, ...s.customInstruments], references: s.references });
      player.stop();
      s.setField({ prompt: `${s.prompt}\n${quickPrompt}`.trim() });
      s.setParams(res.params, { suno: res.suno ? { clips: res.suno, selectedId: null } : null });
      setQuickPrompt('');
      toast.success('Nouvelle version générée.');
      render({ play: true, keepPosition: false });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRegen(false);
    }
  };

  return (
    <Page
      eyebrow={advanced ? 'Studio · mode avancé' : 'Studio · mode simple'}
      title={s.params.title}
      intro={`${s.params.bpm} BPM · ${s.params.key} ${s.params.scale} · ${total} mesures · ${s.params.tracks.length} pistes`}
      actions={(
        <>
          <button type="button" className="btn-ghost" onClick={() => save()} disabled={saving}><Save size={15} /> {s.projectId ? 'Nouvelle version' : 'Sauvegarder'}</button>
          {s.projectId && <Link to="/library" className="btn-ghost"><History size={15} /> Historique</Link>}
        </>
      )}
    >
      {/* Transport + forme d'onde */}
      <section className="panel-hi p-5">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => (playing ? player.pause() : render({ play: true }))} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-neon shadow-neon-lg hover:bg-neon-soft" aria-label="Lecture">
            {rendering ? <Loader2 size={22} className="animate-spin" /> : playing ? <Pause size={22} /> : <Play size={22} className="ml-1" />}
          </button>
          <button type="button" onClick={() => player.stop()} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-mute hover:text-white" aria-label="Stop"><Square size={14} /></button>
          <div className="num text-2xl font-semibold tabular-nums">{fmtTime(isMine ? p.time : 0)}<span className="text-base text-mute"> / {fmtTime(isMine ? p.duration : 0)}</span></div>
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <span className="label">Master</span>
            <div className="w-32"><Slider value={Math.round(s.masterVolume * 100)} min={0} max={120} onChange={(v) => s.setMaster(v / 100)} ariaLabel="Volume master" /></div>
          </div>
        </div>
        <div className="mt-8">
          <Waveform peaks={peaks} height={96} progress={isMine && p.duration ? p.time / p.duration : 0}
            onSeek={(r) => (isMine ? player.seek(r * p.duration) : render({ play: true }))}
            sections={sections.map((x) => ({ id: x.id, label: x.label, share: x.bars / total }))} />
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="grid gap-6">
          {/* Prompt rapide */}
          <section className="panel p-5">
            <div className="flex items-baseline gap-2"><span className="label">Prompt</span><span className="hint">Demande une variation : « plus sombre », « ajoute des strings », « refrain plus long »… ({CREDIT_COSTS.beat} crédits)</span></div>
            <div className="mt-2 flex gap-2">
              <input className="input" value={quickPrompt} onChange={(e) => setQuickPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && quickRegen()} placeholder="Ce que tu veux changer…" />
              <button type="button" className="btn-primary" onClick={quickRegen} disabled={regen || !quickPrompt.trim()}>{regen ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} Varier</button>
            </div>
          </section>

          {!advanced && (
            <section className="panel p-6">
              <SectionHeader title="Réglages essentiels" hint="Tempo, tonalité, groove et structure. Le mode avancé donne accès à chaque piste, note et effet." />
              <BeatParamsEditor compact />
              <div className="mt-6 grid gap-2">
                <div className="flex items-baseline gap-2"><span className="label">Volumes</span><span className="hint">Équilibre rapide des pistes</span></div>
                {s.params.tracks.map((t) => (
                  <div key={t.id} className="grid grid-cols-[130px_1fr_40px] items-center gap-3">
                    <span className={`truncate text-sm ${t.mute ? 'text-mute line-through' : ''}`}>{t.name}</span>
                    <Slider value={Math.round(t.volume * 100)} min={0} max={120} onChange={(v) => s.updateTrack(t.id, { volume: v / 100 })} ariaLabel={t.name} />
                    <span className="num text-right text-xs text-mute">{Math.round(t.volume * 100)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <button type="button" onClick={() => setAdvanced(!advanced)}
            className={`flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition ${advanced ? 'border-neon bg-neon/10 shadow-neon' : 'border-white/[0.08] bg-ink-850 hover:border-neon/50'}`}>
            <span>
              <span className="font-display text-base font-semibold">{advanced ? 'Revenir au mode simple' : 'Mode avancé'}</span>
              <span className="hint block">Timeline complète, pistes séparées, mixer, piano roll, effets par piste</span>
            </span>
            {advanced ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {advanced && (
            <div className="grid gap-6 animate-rise">
              <section className="panel p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2"><span className="label">Timeline</span><span className="hint">Clique une piste pour l'éditer, clique la règle pour te déplacer</span></div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="hint mr-1">Ajouter :</span>
                    {INSTRUMENTS.map((i) => <button key={i.id} type="button" className="rounded-md border border-white/[0.07] px-2 py-0.5 text-[11px] text-mute hover:border-neon/50 hover:text-white" onClick={() => s.addTrack(i.id)}><Plus size={10} className="inline" /> {i.label}</button>)}
                  </div>
                </div>
                <Timeline selectedId={selected?.id} onSelect={setSelectedId} />
              </section>
              <section className="panel p-5"><Mixer selectedId={selected?.id} onSelect={setSelectedId} /></section>
              {selected && (
                <section className="panel grid gap-6 p-5 lg:grid-cols-[1fr_280px]">
                  {selected.kind === 'audio'
                    ? <div className="grid place-items-center rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-mute">Piste audio ({selected.role === 'vocal' ? 'voix' : 'Suno'}) : pas de notes MIDI. Règle ses effets à droite{selected.role === 'vocal' ? ', et ses prises dans Voice AI' : ''}.</div>
                    : <PianoRoll track={selected} />}
                  <TrackFx track={selected} />
                </section>
              )}
              <section className="panel p-6">
                <SectionHeader title="Paramètres de prod" hint="Tout ce que Claude a généré reste modifiable." />
                <BeatParamsEditor />
              </section>
            </div>
          )}
        </div>
        <aside className="h-fit xl:sticky xl:top-6"><section className="panel p-5"><ExportPanel /></section></aside>
      </div>
    </Page>
  );
}
