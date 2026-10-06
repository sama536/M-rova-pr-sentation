import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Wand2, Loader2, ClipboardPaste, Users, Wand, Play } from 'lucide-react';
import { Page } from '../components/Layout.jsx';
import SectionHeader from '../components/ui/SectionHeader.jsx';
import Modal from '../components/ui/Modal.jsx';
import Param from '../components/ui/Param.jsx';
import Recorder from '../components/voice/Recorder.jsx';
import VoiceCard from '../components/voice/VoiceCard.jsx';
import VocalTimeline from '../components/voice/VocalTimeline.jsx';
import { toast } from '../components/ui/Toaster.jsx';
import { useProject } from '../store/project.js';
import { useAuth } from '../lib/auth.jsx';
import { listVoices, deleteVoice } from '../lib/db.js';
import { api } from '../lib/api.js';
import { useVocalActions } from '../lib/vocals.js';
import { renderProject } from '../audio/usePlayer.js';
import { generateBeatParams } from '@shared/generators.js';
import { STYLES, CREDIT_COSTS, BACKS_BY_GENRE, styleById } from '@shared/catalog.js';

export default function VoiceAI() {
  const { user } = useAuth();
  const s = useProject();
  const [profiles, setProfiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const { synthesizeAll } = useVocalActions();
  const [allBusy, setAllBusy] = useState(false);

  const refresh = () => listVoices(user.id).then(setProfiles).catch((e) => toast.error(e.message));
  useEffect(() => { refresh(); }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = s.lyrics.style || s.styles[0] || 'trap';
  const backs = BACKS_BY_GENRE[styleById(style)?.backs || 'trap'];

  const writeLyrics = async (existing = '') => {
    if (!s.params) return;
    setBusy(true);
    try {
      const res = await api.generateLyrics({
        theme: s.lyrics.theme, style, language: 'fr', voices: Math.max(1, s.voices.length), existing,
        sections: s.params.structure.map((sec) => ({ id: sec.id, type: sec.type, bars: sec.bars, flow: s.vocalTimeline[sec.id]?.flow || 'rap_laid' })),
      });
      s.applyGeneratedLyrics(res.lyrics);
      if (res.warning) toast.info(res.warning);
      toast.success(existing ? 'Paroles placées sur la timeline.' : 'Paroles écrites et placées sur la timeline.');
      setPasteOpen(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!s.params) {
    return (
      <Page eyebrow="Voice AI" title="Ta voix sur ta prod." intro="Clone ton timbre, écris tes paroles et place chaque phrase au bon débit.">
        <div className="panel-hi grid gap-4 p-8 text-center">
          <p className="text-zinc-300">Il faut une prod pour poser des voix : la timeline vocale suit la structure du beat.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/beat" className="btn-primary"><Wand2 size={16} /> Générer un beat</Link>
            <button type="button" className="btn-ghost" onClick={() => s.setParams(generateBeatParams({ prompt: 'base vocale', styles: s.styles.length ? s.styles : ['trap'] }))}>
              Commencer avec une structure par défaut
            </button>
          </div>
        </div>
        <section className="panel mt-6 p-6">
          <SectionHeader index="01" title="Clone ta voix" hint="Appuie, parle 15 secondes normalement. ElevenLabs apprend ton timbre." />
          <Recorder onCloned={refresh} />
        </section>
      </Page>
    );
  }

  return (
    <Page
      eyebrow="Voice AI"
      title="Ta voix sur ta prod."
      intro={`Sur « ${s.params.title} » — ${s.params.bpm} BPM. Clone ta voix, choisis tes presets, écris les paroles, règle le débit de chaque section.`}
      actions={<button type="button" className="btn-ghost" onClick={() => renderProject({ play: true })}><Play size={15} /> Écouter le morceau</button>}
    >
      <div className="grid gap-6">
        <section className="panel p-6">
          <SectionHeader index="01" title="Clone ta voix" hint="Appuie et parle 15 secondes normalement — pas besoin de chanter. Ta voix devient la base de toutes les générations." />
          <Recorder onCloned={(p) => { refresh(); if (s.voices.length < 3 && !s.voices.some((v) => v.profileId)) s.addVoice(p); }} />
          {profiles.length > 0 && (
            <div className="mt-6 border-t border-white/[0.06] pt-5">
              <div className="label mb-3">Mes voix</div>
              <div className="flex flex-wrap gap-2">
                {profiles.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-800 py-1.5 pl-3 pr-1.5 text-sm">
                    {p.name}
                    <span className="hint">{p.eleven_voice_id ? 'clonée' : 'locale'}</span>
                    <button type="button" className="btn-ghost btn-sm" disabled={s.voices.length >= 3} onClick={() => s.addVoice(p)}><Plus size={12} /> Utiliser</button>
                    <button type="button" className="p-1 text-mute hover:text-red-400" title="Supprimer" onClick={async () => { if (confirm(`Supprimer la voix « ${p.name} » ?`)) { await deleteVoice(p.id); refresh(); } }}><Trash2 size={13} /></button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <SectionHeader index="02" title="Voix sur la prod" hint="Jusqu'à 3 voix en feat, chacune avec ses réglages indépendants."
            right={<button type="button" className="btn-ghost btn-sm" disabled={s.voices.length >= 3} onClick={() => s.addVoice(null, s.voices.length ? 'drill_froid' : 'melodique_aigu')}><Users size={14} /> Ajouter une voix ({s.voices.length}/3)</button>} />
          {s.voices.length === 0 ? (
            <div className="panel grid place-items-center gap-3 p-8 text-center">
              <p className="text-sm text-mute">Aucune voix sur ce morceau.</p>
              <button type="button" className="btn-primary" onClick={() => s.addVoice(profiles[0] || null)}><Plus size={15} /> Ajouter la voix principale</button>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {s.voices.map((v) => <VoiceCard key={v.slot} voice={v} profiles={profiles} />)}
            </div>
          )}
        </section>

        <section className="panel p-6">
          <SectionHeader index="03" title="Paroles" hint="Écris-les toi-même dans la timeline, colle-les pour que l'IA les place, ou laisse Claude les écrire." />
          <div className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
            <Param label="Thème" hint="De quoi parle le morceau ?">
              <input className="input" value={s.lyrics.theme} onChange={(e) => s.setLyricsMeta({ theme: e.target.value })} placeholder="ex. sortir du quartier, une rupture, une nuit à Paris…" />
            </Param>
            <Param label="Style d'écriture" hint="Vocabulaire et flow">
              <select className="input" value={style} onChange={(e) => s.setLyricsMeta({ style: e.target.value })}>
                {STYLES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
              </select>
            </Param>
            <div className="flex gap-2">
              <button type="button" className="btn-primary" onClick={() => writeLyrics()} disabled={busy}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Wand size={15} />} Écrire avec Claude ({CREDIT_COSTS.lyrics})
              </button>
              <button type="button" className="btn-ghost" onClick={() => setPasteOpen(true)}><ClipboardPaste size={15} /> Coller</button>
            </div>
          </div>
          <p className="hint mt-3">Backs automatiques pour ce genre : <span className="text-zinc-300">{backs.label}</span> — {backs.hint}.</p>
        </section>

        <section className="panel p-6">
          <SectionHeader index="04" title="Timeline vocale" hint="Chaque section a son débit et ses réglages. Punchlines dans les parties rapides, mélodies dans les refrains."
            right={<button type="button" className="btn-ghost btn-sm" disabled={allBusy} onClick={async () => { setAllBusy(true); await synthesizeAll(); setAllBusy(false); }}>{allBusy ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Générer toutes les prises</button>} />
          <VocalTimeline />
        </section>
      </div>

      <Modal open={pasteOpen} onClose={() => setPasteOpen(false)} title="Coller mes paroles" width="max-w-2xl">
        <p className="hint mb-3">Colle ton texte complet. Claude le découpe et le place dans les sections selon le débit de chacune, sans changer tes mots.</p>
        <textarea className="input min-h-[260px] font-mono text-[13px]" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Colle tes paroles ici…" />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => {
            // Placement manuel sans IA : réparti proportionnellement aux mesures
            const lines = pasted.split('\n').map((l) => l.trim()).filter(Boolean);
            const total = s.params.structure.reduce((a, x) => a + x.bars, 0);
            let i = 0;
            s.params.structure.forEach((sec) => {
              const n = Math.max(1, Math.round((sec.bars / total) * lines.length));
              s.setSectionLines(sec.id, lines.slice(i, i + n));
              i += n;
            });
            setPasteOpen(false);
            toast.success('Paroles réparties sur les sections.');
          }}>Répartir sans IA</button>
          <button type="button" className="btn-primary" disabled={!pasted.trim() || busy} onClick={() => writeLyrics(pasted)}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} Placer avec Claude ({CREDIT_COSTS.lyrics})
          </button>
        </div>
      </Modal>
    </Page>
  );
}
