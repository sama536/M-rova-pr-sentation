import { useState } from 'react';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Logo from '../components/ui/Logo.jsx';
import { useAuth } from '../lib/auth.jsx';
import { STARTING_CREDITS } from '@shared/catalog.js';

export default function Login() {
  const { user, signIn, signUp, signInWithGoogle, isDemo } = useAuth();
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const nav = useNavigate();
  const loc = useLocation();
  const dest = loc.state?.from || '/beat';
  if (user) return <Navigate to={dest} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'signin') await signIn(form.email, form.password);
      else {
        if (form.password.length < 6) throw new Error('6 caractères minimum pour le mot de passe.');
        const r = await signUp(form.email, form.password, form.name);
        if (r?.needsConfirmation) { setInfo('Compte créé ! Confirme ton email via le lien reçu, puis connecte-toi.'); setMode('signin'); return; }
      }
      nav(dest, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError('');
    try { await signInWithGoogle(); } catch (err) { setError(err.message); }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-white/[0.06] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(600px_400px_at_30%_40%,rgba(139,92,246,.35),transparent)]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/"><Logo /></Link>
          <div>
            <p className="title-xl text-5xl leading-tight">Le studio<br />qui comprend<br /><span className="text-neon-soft">ce que tu entends.</span></p>
            <p className="mt-4 text-mute">{STARTING_CREDITS} crédits offerts à l'inscription.</p>
          </div>
          <div className="flex h-14 items-end gap-1">
            {Array.from({ length: 48 }, (_, i) => <span key={i} className="flex-1 rounded-sm bg-neon/60 origin-bottom animate-pulsebar" style={{ height: `${30 + ((i * 37) % 70)}%`, animationDelay: `${(i % 9) * 0.1}s` }} />)}
          </div>
        </div>
      </div>

      <div className="grid place-items-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Logo /></div>
          <h1 className="title-xl text-3xl">{mode === 'signin' ? 'Connexion' : 'Créer un compte'}</h1>
          <p className="hint mt-2">{isDemo ? 'Mode démo : ton compte est créé localement dans ce navigateur.' : 'Email ou Google, comme tu préfères.'}</p>

          <button type="button" onClick={google} className="btn-ghost mt-8 w-full" disabled={isDemo} title={isDemo ? 'Nécessite Supabase' : ''}>
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
            Continuer avec Google
          </button>
          <div className="my-6 flex items-center gap-3 text-xs text-mute-dim"><span className="h-px flex-1 bg-white/10" />ou<span className="h-px flex-1 bg-white/10" /></div>

          <div className="grid gap-4">
            {mode === 'signup' && (
              <label className="grid gap-1.5"><span className="label">Nom d'artiste</span>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex. Nyx 808" />
              </label>
            )}
            <label className="grid gap-1.5"><span className="label">Email</span>
              <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="toi@exemple.com" autoComplete="email" />
            </label>
            <label className="grid gap-1.5"><span className="label">Mot de passe</span>
              <input className="input" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="6 caractères minimum" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
            </label>
          </div>
          {error && <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
          {info && <p className="mt-4 rounded-lg border border-neon/30 bg-neon/10 px-3 py-2 text-sm text-neon-glow">{info}</p>}
          <button className="btn-primary mt-6 w-full" disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />}{mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
          </button>
          <p className="mt-6 text-center text-sm text-mute">
            {mode === 'signin' ? 'Pas encore de compte ?' : 'Déjà inscrit ?'}{' '}
            <button type="button" className="text-neon-soft hover:underline" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>
              {mode === 'signin' ? 'Créer un compte' : 'Se connecter'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
