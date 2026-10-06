import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { Wand2, Mic2, SlidersHorizontal, FolderOpen, Users, User, LogOut, Coins, Menu, X } from 'lucide-react';
import Logo from './ui/Logo.jsx';
import TransportBar from './TransportBar.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useCredits } from '../store/credits.js';
import { getCreditsBalance, rememberDemoUser } from '../lib/db.js';

const NAV = [
  { to: '/beat', label: 'Beat AI', icon: Wand2, hint: 'Génère la prod' },
  { to: '/voice', label: 'Voice AI', icon: Mic2, hint: 'Voix, paroles, flow' },
  { to: '/studio', label: 'Studio', icon: SlidersHorizontal, hint: 'Mix et export' },
  { to: '/library', label: 'Bibliothèque', icon: FolderOpen, hint: 'Tes projets' },
  { to: '/community', label: 'Community', icon: Users, hint: 'Prods libres de droits' },
];

export default function Layout() {
  const { user, signOut, isDemo } = useAuth();
  const balance = useCredits((s) => s.balance);
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (!user) return;
    rememberDemoUser(user);
    if (isDemo) useCredits.getState().init(user.id);
    else getCreditsBalance(user.id).then((b) => useCredits.getState().init(user.id, b)).catch(() => {});
  }, [user, isDemo]);

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-4">
      <Link to="/" className="mb-6 px-2" onClick={() => setOpen(false)}><Logo /></Link>
      {NAV.map(({ to, label, icon: Icon, hint }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => setOpen(false)}
          className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${isActive ? 'bg-neon/15 text-white shadow-[inset_2px_0_0_#8b5cf6]' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'}`}
        >
          <Icon size={18} className="shrink-0" />
          <span className="grid leading-tight">
            <span className="text-sm font-semibold">{label}</span>
            <span className="text-[11px] text-mute-dim group-hover:text-mute">{hint}</span>
          </span>
        </NavLink>
      ))}
      <div className="mt-auto grid gap-3">
        {isDemo && (
          <div className="rounded-xl border border-neon/30 bg-neon/5 p-3">
            <div className="label text-neon-soft">Mode démo</div>
            <p className="hint mt-1">Données stockées dans ce navigateur. Ajoute tes clés dans <code className="text-zinc-300">.env</code> pour activer Supabase et les IA.</p>
          </div>
        )}
        {user ? (
          <>
            <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2">
              <span className="flex items-center gap-2 text-sm"><Coins size={15} className="text-neon-soft" /> Crédits</span>
              <span className="num text-sm text-neon-glow">{balance ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <NavLink to="/profile" onClick={() => setOpen(false)} className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.04]">
                <User size={16} /> <span className="truncate">{user.display_name || user.email}</span>
              </NavLink>
              <button type="button" onClick={async () => { await signOut(); nav('/'); }} className="p-2 text-mute hover:text-white" title="Déconnexion"><LogOut size={16} /></button>
            </div>
          </>
        ) : (
          <Link to="/login" className="btn-primary" onClick={() => setOpen(false)}>Se connecter</Link>
        )}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-white/[0.06] bg-ink/80 backdrop-blur-xl lg:block">{sidebar}</aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-ink/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link to="/"><Logo /></Link>
        <button type="button" onClick={() => setOpen(true)} className="p-2" aria-label="Menu"><Menu size={20} /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-72 border-r border-white/10 bg-ink" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setOpen(false)} className="absolute right-4 top-4 p-2" aria-label="Fermer"><X size={20} /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <main className="lg:pl-60 pb-28 overflow-x-clip">
        <Outlet />
      </main>
      <TransportBar />
    </div>
  );
}

export function Page({ eyebrow, title, intro, actions, children }) {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8 py-8 animate-rise">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          {eyebrow && <div className="label text-neon-soft mb-2">{eyebrow}</div>}
          <h1 className="title-xl text-3xl sm:text-4xl">{title}</h1>
          {intro && <p className="mt-2 max-w-2xl text-sm text-mute">{intro}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
