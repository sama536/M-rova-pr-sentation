import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, ExternalLink, Loader2, Save } from 'lucide-react';
import { Page } from '../components/Layout.jsx';
import Param from '../components/ui/Param.jsx';
import { Avatar } from './Producer.jsx';
import { toast } from '../components/ui/Toaster.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useCredits } from '../store/credits.js';
import { getMyProfile, updateProfile, getProducer } from '../lib/db.js';
import { fmtNum } from '../lib/format.js';
import { CREDIT_COSTS } from '@shared/catalog.js';

const COST_LABELS = { beat: 'Générer un beat', analyze: 'Analyser des références YouTube', lyrics: 'Écrire / placer des paroles', voiceClone: 'Cloner une voix', voiceSynth: 'Générer une prise vocale' };

export default function Profile() {
  const { user, updateLocalProfile, isDemo } = useAuth();
  const balance = useCredits((s) => s.balance);
  const [form, setForm] = useState(null);
  const [stats, setStats] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyProfile(user.id).then((p) => setForm({
      display_name: p?.display_name || user.display_name || '', username: p?.username || user.username || '',
      bio: p?.bio || '', avatar_url: p?.avatar_url || user.avatar_url || '',
    }));
    getProducer(user.id).then((d) => setStats(d?.stats || null)).catch(() => {});
  }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      const p = await updateProfile(user.id, form);
      updateLocalProfile({ display_name: p.display_name, username: p.username, avatar_url: p.avatar_url });
      toast.success('Profil mis à jour.');
    } catch (e) {
      toast.error(e.message.includes('duplicate') ? 'Ce nom d\'utilisateur est déjà pris.' : e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return null;
  return (
    <Page eyebrow="Profil" title="Ton compte." actions={<Link to={`/producer/${form.username || user.id}`} className="btn-ghost"><ExternalLink size={15} /> Voir mon profil public</Link>}>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="panel grid gap-5 p-6">
          <div className="flex items-center gap-4">
            <Avatar profile={{ ...form }} size={72} />
            <div>
              <div className="font-display text-xl font-semibold">{form.display_name || 'Sans nom'}</div>
              <div className="hint">{user.email}</div>
            </div>
          </div>
          <Param label="Nom d'artiste" hint="Affiché sur tes prods">
            <input className="input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} maxLength={50} />
          </Param>
          <Param label="Nom d'utilisateur" hint="Ton adresse publique : /producer/…">
            <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '') })} maxLength={30} />
          </Param>
          <Param label="Bio" hint="Ton univers en deux phrases">
            <textarea className="input min-h-[90px]" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={280} />
          </Param>
          <Param label="Avatar" hint="URL d'une image (optionnel)">
            <input className="input" value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://…" />
          </Param>
          <button type="button" className="btn-primary w-fit" onClick={save} disabled={saving}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer</button>
        </section>
        <aside className="grid h-fit gap-4">
          <section className="panel-hi p-5">
            <div className="flex items-center gap-2 label"><Coins size={14} className="text-neon-soft" /> Crédits</div>
            <div className="num mt-2 text-4xl font-semibold text-neon-glow">{balance ?? '—'}</div>
            <p className="hint mt-1">{isDemo ? 'Mode démo : solde local, rechargé à 100 sur un nouveau compte.' : 'Débités côté serveur à chaque génération IA, remboursés en cas d\'échec.'}</p>
            <div className="mt-4 grid gap-1.5">
              {Object.entries(CREDIT_COSTS).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm"><span className="text-zinc-400">{COST_LABELS[k]}</span><span className="num text-zinc-200">{v}</span></div>
              ))}
            </div>
          </section>
          {stats && (
            <section className="panel grid grid-cols-2 gap-3 p-5">
              {[['Prods', stats.beats_count], ['Téléchargements', stats.total_downloads], ['Likes', stats.total_likes], ['Écoutes', stats.total_plays]].map(([l, v]) => (
                <div key={l}><div className="num text-xl font-semibold">{fmtNum(v)}</div><div className="hint">{l}</div></div>
              ))}
            </section>
          )}
        </aside>
      </div>
    </Page>
  );
}
