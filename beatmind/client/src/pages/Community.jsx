import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, X, BadgeCheck } from 'lucide-react';
import { Page } from '../components/Layout.jsx';
import Chip from '../components/ui/Chip.jsx';
import Param from '../components/ui/Param.jsx';
import EqBars from '../components/ui/EqBars.jsx';
import BeatCard from '../components/community/BeatCard.jsx';
import { toast } from '../components/ui/Toaster.jsx';
import { listBeats, myReactions, toggleReaction, deleteBeat } from '../lib/db.js';
import { useAuth } from '../lib/auth.jsx';
import { STYLES, INSTRUMENTS, KEYS, MOODS, CC_LICENSE } from '@shared/catalog.js';

const SORTS = [['recent', 'Récents'], ['popular', 'Populaires'], ['downloads', 'Téléchargés'], ['plays', 'Écoutés']];
const EMPTY = { search: '', styles: [], instruments: [], key: '', mood: '', bpmMin: 60, bpmMax: 200, sort: 'recent' };

export default function Community() {
  const { user } = useAuth();
  const [f, setF] = useState(EMPTY);
  const [tab, setTab] = useState('all');
  const [beats, setBeats] = useState(null);
  const [reactions, setReactions] = useState({ like: new Set(), save: new Set() });
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => { myReactions(user?.id).then(setReactions).catch(() => {}); }, [user?.id]);

  const query = useMemo(() => ({
    ...f,
    bpmMin: f.bpmMin > 60 ? f.bpmMin : undefined,
    bpmMax: f.bpmMax < 200 ? f.bpmMax : undefined,
    ids: tab === 'saved' ? [...reactions.save] : undefined,
  }), [f, tab, reactions.save]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      listBeats(query).then((b) => alive && setBeats(b)).catch((e) => { toast.error(e.message); setBeats([]); });
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  const react = async (beat, kind, on) => {
    if (!user) return toast.error('Connecte-toi pour liker ou sauvegarder.');
    const next = { like: new Set(reactions.like), save: new Set(reactions.save) };
    if (on) next[kind].add(beat.id); else next[kind].delete(beat.id);
    setReactions(next);
    const counter = kind === 'like' ? 'likes_count' : 'saves_count';
    setBeats((bs) => bs.map((b) => (b.id === beat.id ? { ...b, [counter]: Math.max(0, b[counter] + (on ? 1 : -1)) } : b)));
    try { await toggleReaction(user.id, beat.id, kind, on); } catch (e) { toast.error(e.message); }
  };

  const remove = async (beat) => {
    if (!confirm(`Retirer « ${beat.title} » de Community ?`)) return;
    await deleteBeat(beat.id);
    setBeats((bs) => bs.filter((b) => b.id !== beat.id));
  };

  const toggleIn = (k, v) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });
  const activeCount = f.styles.length + f.instruments.length + (f.key ? 1 : 0) + (f.mood ? 1 : 0) + (f.bpmMin > 60 || f.bpmMax < 200 ? 1 : 0);

  return (
    <Page
      eyebrow="BeatMind Community"
      title="Des prods libres. Pour tout le monde."
      intro="Chaque prod est publiée en Creative Commons CC0 : écoute, télécharge, utilise, monétise — sans droit d'auteur."
      actions={user && <Link to="/studio" className="btn-primary">Publier une prod</Link>}
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input className="input pl-9" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} placeholder="Rechercher un titre…" />
        </div>
        <div className="flex rounded-xl border border-white/[0.08] p-1">
          {[['all', 'Toutes'], ['saved', 'Mes sauvegardes']].map(([id, l]) => (
            <button key={id} type="button" onClick={() => (id === 'saved' && !user ? toast.error('Connecte-toi pour voir tes sauvegardes.') : setTab(id))} className={`rounded-lg px-3 py-1.5 text-sm ${tab === id ? 'bg-neon text-white' : 'text-mute hover:text-white'}`}>{l}</button>
          ))}
        </div>
        <select className="input w-auto" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}>
          {SORTS.map(([id, l]) => <option key={id} value={id}>Tri : {l}</option>)}
        </select>
        <button type="button" className="btn-ghost" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={15} /> Filtres {activeCount > 0 && <span className="num rounded bg-neon px-1.5 text-[11px]">{activeCount}</span>}</button>
      </div>

      <div className={`grid gap-6 ${showFilters ? 'lg:grid-cols-[280px_1fr]' : ''}`}>
        {showFilters && (
          <aside className="panel grid h-fit gap-5 p-5">
            <div className="flex items-center justify-between">
              <span className="label">Filtres</span>
              {activeCount > 0 && <button type="button" className="flex items-center gap-1 text-xs text-mute hover:text-white" onClick={() => setF({ ...EMPTY, search: f.search, sort: f.sort })}><X size={12} /> Effacer</button>}
            </div>
            <Param label="Style" hint="Un ou plusieurs">
              <div className="flex flex-wrap gap-1.5">{STYLES.map((s) => <Chip key={s.id} active={f.styles.includes(s.id)} onClick={() => toggleIn('styles', s.id)}>{s.label}</Chip>)}</div>
            </Param>
            <Param label="BPM" hint="Tempo" value={`${f.bpmMin}–${f.bpmMax}`}>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" className="input py-1.5 num" min={60} max={f.bpmMax} value={f.bpmMin} onChange={(e) => setF({ ...f, bpmMin: Number(e.target.value) || 60 })} />
                <input type="number" className="input py-1.5 num" min={f.bpmMin} max={200} value={f.bpmMax} onChange={(e) => setF({ ...f, bpmMax: Number(e.target.value) || 200 })} />
              </div>
            </Param>
            <Param label="Tonalité" hint="Note de base">
              <select className="input py-2" value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })}>
                <option value="">Toutes</option>
                {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </Param>
            <Param label="Mood" hint="Ambiance">
              <select className="input py-2" value={f.mood} onChange={(e) => setF({ ...f, mood: e.target.value })}>
                <option value="">Tous</option>
                {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Param>
            <Param label="Instruments" hint="Doit contenir">
              <div className="flex flex-wrap gap-1.5">{INSTRUMENTS.map((i) => <Chip key={i.id} active={f.instruments.includes(i.id)} onClick={() => toggleIn('instruments', i.id)}>{i.label}</Chip>)}</div>
            </Param>
            <div className="flex gap-2 rounded-xl border border-neon/20 bg-neon/5 p-3 text-[11.5px] text-zinc-400">
              <BadgeCheck size={15} className="shrink-0 text-neon-soft" /><span>{CC_LICENSE.label}. {CC_LICENSE.hint}</span>
            </div>
          </aside>
        )}
        <div>
          {beats === null ? (
            <div className="grid h-40 place-items-center"><EqBars /></div>
          ) : beats.length === 0 ? (
            <div className="panel p-10 text-center text-sm text-mute">Aucune prod ne correspond. {tab === 'saved' ? 'Sauvegarde des prods pour les retrouver ici.' : 'Élargis tes filtres.'}</div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {beats.map((b) => <BeatCard key={b.id} beat={b} liked={reactions.like.has(b.id)} saved={reactions.save.has(b.id)} onReact={react} onDelete={remove} />)}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
