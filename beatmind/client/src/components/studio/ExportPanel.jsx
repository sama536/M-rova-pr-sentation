import { useState } from 'react';
import { Download, Loader2, FileAudio, Layers, Mic2, Drum, Share2 } from 'lucide-react';
import { useProject } from '../../store/project.js';
import { prepareAudio, renderSong, audibleTracks } from '../../audio/renderer.js';
import { encode, zipFiles, download } from '../../audio/exporter.js';
import { slug } from '../../lib/format.js';
import { toast } from '../ui/Toaster.jsx';
import PublishModal from './PublishModal.jsx';

export async function renderFor(kind) {
  const params = useProject.getState().params;
  const masterVolume = useProject.getState().masterVolume;
  const buffers = await prepareAudio(params, (w) => toast.error(w));
  const audible = audibleTracks(params.tracks);
  const ids = {
    mix: null,
    vocals: audible.filter((t) => t.role === 'vocal' && t.clips?.length).map((t) => t.id),
    beat: audible.filter((t) => t.role !== 'vocal').map((t) => t.id),
  }[kind];
  if (ids && !ids.length) throw new Error(kind === 'vocals' ? 'Aucune prise vocale générée (Voice AI → Générer).' : 'Aucune piste instrumentale active.');
  return renderSong(params, { trackIds: ids || undefined, buffers, masterVolume });
}

const ITEMS = [
  { id: 'mp3', label: 'MP3', hint: 'Mix complet, 192 kbps — pour partager', icon: FileAudio },
  { id: 'wav', label: 'WAV', hint: 'Mix complet, 16 bits sans perte — pour le mastering', icon: FileAudio },
  { id: 'stems', label: 'Stems', hint: 'Une piste WAV par instrument / voix (ZIP)', icon: Layers },
  { id: 'vocals', label: 'Voix seule', hint: 'Toutes les voix traitées, sans le beat', icon: Mic2 },
  { id: 'beat', label: 'Beat seul', hint: 'Instrumental, sans les voix', icon: Drum },
];

export default function ExportPanel() {
  const title = useProject((s) => s.params?.title || 'beatmind');
  const [busy, setBusy] = useState(null);
  const [publishOpen, setPublishOpen] = useState(false);

  const run = async (id) => {
    setBusy(id);
    try {
      const name = slug(title);
      if (id === 'stems') {
        const params = useProject.getState().params;
        const buffers = await prepareAudio(params, (w) => toast.error(w));
        const files = [];
        for (const t of params.tracks) {
          if (t.kind === 'audio' ? !t.clips?.length : !t.notes?.length) continue;
          // eslint-disable-next-line no-await-in-loop
          const buf = await renderSong(params, { trackIds: [t.id], buffers, masterVolume: 1 });
          // eslint-disable-next-line no-await-in-loop
          files.push({ name: `${name}_${slug(t.name)}.wav`, blob: await encode(buf, 'wav') });
        }
        download(await zipFiles(files), `${name}_stems.zip`);
      } else {
        const kind = id === 'mp3' || id === 'wav' ? 'mix' : id;
        const buf = await renderFor(kind);
        const fmt = id === 'wav' ? 'wav' : 'mp3';
        download(await encode(buf, fmt), `${name}${kind === 'mix' ? '' : `_${kind === 'vocals' ? 'voix' : 'beat'}`}.${fmt}`);
      }
      toast.success('Export terminé.');
    } catch (e) {
      toast.error(`Export : ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-baseline gap-2"><span className="label">Export</span><span className="hint">Rendu dans ton navigateur, rien n'est envoyé</span></div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {ITEMS.map(({ id, label, hint, icon: Icon }) => (
          <button key={id} type="button" disabled={!!busy} onClick={() => run(id)}
            className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-ink-800 px-3 py-2.5 text-left transition hover:border-neon/50 disabled:opacity-50">
            {busy === id ? <Loader2 size={16} className="shrink-0 animate-spin text-neon-soft" /> : <Icon size={16} className="shrink-0 text-neon-soft" />}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{label}</span>
              <span className="hint block truncate">{hint}</span>
            </span>
            <Download size={14} className="shrink-0 text-mute" />
          </button>
        ))}
      </div>
      <button type="button" className="btn-primary mt-1" onClick={() => setPublishOpen(true)}><Share2 size={15} /> Publier sur Community</button>
      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} />
    </div>
  );
}
