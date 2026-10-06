import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Disc3, Download, Heart, Headphones } from 'lucide-react';
import { Page } from '../components/Layout.jsx';
import EqBars from '../components/ui/EqBars.jsx';
import BeatCard from '../components/community/BeatCard.jsx';
import { toast } from '../components/ui/Toaster.jsx';
import { getProducer, listBeats, myReactions, toggleReaction } from '../lib/db.js';
import { useAuth } from '../lib/auth.jsx';
import { fmtNum, fmtDate, coverFor } from '../lib/format.js';

export function Avatar({ profile, size = 80 }) {
  const name = profile?.display_name || profile?.username || '?';
  if (profile?.avatar_url) return <img src={profile.avatar_url} alt="" className="rounded-2xl object-cover" style={{ width: size, height: size }} />;
  return (
    <span className="grid place-items-center rounded-2xl font-display font-extrabold text-white shadow-neon" style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg, ${coverFor(name)}, #121214)` }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export default function Producer() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(undefined);
  const [beats, setBeats] = useState([]);
  const [reactions, setReactions] = useState({ like: new Set(), save: new Set() });

  useEffect(() => {
    getProducer(id).then(async (d) => {
      setData(d);
      if (d) setBeats(await listBeats({ userId: d.profile.id, sort: 'recent' }));
    }).catch((e) => { toast.error(e.message); setData(null); });
  }, [id]);
  useEffect(() => { myReactions(user?.id).then(setReactions).catch(() => {}); }, [user?.id]);

  if (data === undefined) return <div className="grid h-[50vh] place-items-center"><EqBars /></div>;
  if (!data) return <Page title="Producteur introuvable" />;

  const react = async (beat, kind, on) => {
    if (!user) return toast.error('Connecte-toi pour réagir.');
    const next = { like: new Set(reactions.like), save: new Set(reactions.save) };
    if (on) next[kind].add(beat.id); else next[kind].delete(beat.id);
    setReactions(next);
    await toggleReaction(user.id, beat.id, kind, on).catch((e) => toast.error(e.message));
  };

  const stats = [
    { icon: Disc3, label: 'Prods postées', value: data.stats.beats_count },
    { icon: Download, label: 'Téléchargements', value: data.stats.total_downloads },
    { icon: Heart, label: 'Likes', value: data.stats.total_likes },
    { icon: Headphones, label: 'Écoutes', value: data.stats.total_plays },
  ];

  return (
    <Page>
      <section className="panel-hi relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-neon/25 blur-[90px]" />
        <div className="relative flex flex-wrap items-center gap-6">
          <Avatar profile={data.profile} size={96} />
          <div className="min-w-0 flex-1">
            <div className="label text-neon-soft">Producteur</div>
            <h1 className="title-xl mt-1 text-3xl sm:text-4xl">{data.profile.display_name}</h1>
            <div className="mt-1 text-sm text-mute">@{data.profile.username}{data.profile.created_at && ` · sur BeatMind depuis ${fmtDate(data.profile.created_at)}`}</div>
            {data.profile.bio && <p className="mt-3 max-w-xl text-sm text-zinc-300">{data.profile.bio}</p>}
          </div>
        </div>
        <div className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-white/[0.07] bg-ink-800/70 p-4">
              <Icon size={16} className="text-neon-soft" />
              <div className="num mt-2 text-2xl font-semibold">{fmtNum(value)}</div>
              <div className="hint">{label}</div>
            </div>
          ))}
        </div>
      </section>
      <h2 className="mt-8 mb-4 font-display text-lg font-semibold">Prods ({beats.length})</h2>
      {beats.length === 0 ? <p className="hint">Aucune prod publiée pour l'instant.</p> : (
        <div className="grid gap-3 xl:grid-cols-2">
          {beats.map((b) => <BeatCard key={b.id} beat={b} liked={reactions.like.has(b.id)} saved={reactions.save.has(b.id)} onReact={react} />)}
        </div>
      )}
    </Page>
  );
}
