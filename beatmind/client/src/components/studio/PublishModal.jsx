import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Share2, BadgeCheck } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Chip from '../ui/Chip.jsx';
import Param from '../ui/Param.jsx';
import { useProject } from '../../store/project.js';
import { useAuth } from '../../lib/auth.jsx';
import { publishBeat } from '../../lib/db.js';
import { encode } from '../../audio/exporter.js';
import { renderFor } from './ExportPanel.jsx';
import { toast } from '../ui/Toaster.jsx';
import { beatesTrack } from '../../store/beates.js';
import { MOODS, CC_LICENSE, INSTRUMENTS } from '@shared/catalog.js';

export default function PublishModal({ open, onClose }) {
  const { user } = useAuth();
  const s = useProject();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [moods, setMoods] = useState([]);
  const [what, setWhat] = useState('mix');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const publish = async () => {
    setBusy(true);
    try {
      const buf = await renderFor(what);
      const blob = await encode(buf, 'mp3');
      const instruments = [...new Set(s.params.tracks.map((t) => t.instrument).filter(Boolean))]
        .filter((i) => INSTRUMENTS.some((x) => x.id === i) || s.customInstruments.includes(i));
      await publishBeat(user.id, {
        blob, title: title || s.params.title, description, params: { ...s.params, tracks: [] },
        styles: s.params.styles?.length ? s.params.styles : s.styles,
        moods: moods.length ? moods : [s.params.mood?.split(/[ ,]/)[0]].filter(Boolean),
        instruments, projectId: s.projectId,
      });
      beatesTrack('published');
      toast.success('Prod publiée sur Community !');
      onClose();
      nav('/community');
    } catch (e) {
      toast.error(`Publication : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Publier sur BeatMind Community">
      <div className="grid gap-4">
        <Param label="Titre" hint="Visible par tous">
          <input className="input" value={title} placeholder={s.params?.title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </Param>
        <Param label="Description" hint="Optionnel : vibe, utilisation idéale">
          <textarea className="input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </Param>
        <Param label="Mood" hint="Aide les autres à trouver ta prod">
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((m) => <Chip key={m} active={moods.includes(m)} onClick={() => setMoods(moods.includes(m) ? moods.filter((x) => x !== m) : [...moods, m])}>{m}</Chip>)}
          </div>
        </Param>
        <Param label="Contenu" hint="Ce qui est publié">
          <div className="flex gap-2">
            <Chip active={what === 'mix'} onClick={() => setWhat('mix')}>Morceau complet</Chip>
            <Chip active={what === 'beat'} onClick={() => setWhat('beat')}>Beat seul (instrumental)</Chip>
          </div>
        </Param>
        <div className="flex gap-3 rounded-xl border border-neon/30 bg-neon/5 p-3">
          <BadgeCheck size={18} className="mt-0.5 shrink-0 text-neon-soft" />
          <p className="text-[12.5px] text-zinc-300">
            Publié automatiquement sous <a href={CC_LICENSE.url} target="_blank" rel="noreferrer" className="text-neon-soft underline">{CC_LICENSE.label}</a>. {CC_LICENSE.hint} En publiant, tu confirmes que la prod ne contient aucun sample protégé.
          </p>
        </div>
        <button type="button" className="btn-primary" disabled={busy} onClick={publish}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} Publier gratuitement
        </button>
      </div>
    </Modal>
  );
}
