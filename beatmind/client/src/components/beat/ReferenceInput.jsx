import { useState } from 'react';
import { Youtube, Plus, X, Loader2, Gauge, Activity, Music2, Smile, ListTree } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useProject } from '../../store/project.js';
import { toast } from '../ui/Toaster.jsx';
import { CREDIT_COSTS, styleById } from '@shared/catalog.js';

export default function ReferenceInput() {
  const references = useProject((s) => s.references);
  const setField = useProject((s) => s.setField);
  const [url, setUrl] = useState('');
  const [pending, setPending] = useState([]);
  const [busy, setBusy] = useState(false);

  const add = () => {
    const parts = url.split(/[\s,]+/).filter((u) => /youtu\.?be/.test(u));
    if (!parts.length) return toast.error('Colle un lien YouTube valide (youtube.com ou youtu.be).');
    setPending((p) => [...new Set([...p, ...parts])].slice(0, 5));
    setUrl('');
  };

  const analyze = async () => {
    if (!pending.length) return;
    setBusy(true);
    try {
      const { references: refs, errors } = await api.analyzeYouTube(pending);
      setField({ references: [...references.filter((r) => !refs.some((x) => x.id === r.id)), ...refs].slice(0, 5) });
      setPending([]);
      errors?.forEach((e) => toast.error(e));
      if (refs.length) toast.success(`${refs.length} référence(s) analysée(s)`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Youtube size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input className="input pl-9" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} placeholder="https://youtube.com/watch?v=… (un ou plusieurs liens)" />
        </div>
        <button type="button" className="btn-ghost" onClick={add}><Plus size={16} /> Ajouter</button>
      </div>
      {pending.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {pending.map((u) => (
            <span key={u} className="chip-off cursor-default max-w-xs">
              <span className="truncate">{u.replace(/^https?:\/\/(www\.)?/, '')}</span>
              <X size={12} className="cursor-pointer shrink-0" onClick={() => setPending((p) => p.filter((x) => x !== u))} />
            </span>
          ))}
          <button type="button" className="btn-primary btn-sm" onClick={analyze} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />} Analyser ({CREDIT_COSTS.analyze} crédit)
          </button>
        </div>
      )}
      {references.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {references.map((r) => (
            <div key={r.id} className="flex gap-3 rounded-xl border border-white/[0.07] bg-ink-800 p-3">
              {r.thumbnail && <img src={r.thumbnail} alt="" className="h-20 w-32 shrink-0 rounded-lg object-cover" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{r.title}</div>
                    <div className="hint truncate">{r.channel} · analysé par {r.source === 'claude' ? 'Claude' : 'heuristique locale'}</div>
                  </div>
                  <button type="button" onClick={() => setField({ references: references.filter((x) => x.id !== r.id) })} className="text-mute hover:text-white" aria-label="Retirer"><X size={14} /></button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
                  <span className="flex items-center gap-1.5"><Gauge size={12} className="text-neon-soft" /><span className="num">{r.bpm} BPM</span>{r.key && <span className="num text-mute">· {r.key}</span>}</span>
                  <span className="flex items-center gap-1.5"><Music2 size={12} className="text-neon-soft" />{styleById(r.style)?.label || r.style}</span>
                  <span className="flex items-center gap-1.5 col-span-2 text-zinc-300"><Activity size={12} className="text-neon-soft shrink-0" /><span className="truncate">{r.flow}</span></span>
                  <span className="flex items-center gap-1.5"><Smile size={12} className="text-neon-soft" />{r.mood} · {r.vibe}</span>
                  <span className="flex items-center gap-1.5 col-span-2 text-mute"><ListTree size={12} className="text-neon-soft shrink-0" /><span className="truncate">{r.structure}</span></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
