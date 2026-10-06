import { Link } from 'react-router-dom';
import { Wand2, Mic2, SlidersHorizontal, Users, ArrowRight, Youtube, Sparkles } from 'lucide-react';
import Logo from '../components/ui/Logo.jsx';
import { useAuth } from '../lib/auth.jsx';
import { STYLES } from '@shared/catalog.js';

const FEATURES = [
  { icon: Wand2, title: 'Beat AI', text: 'Décris ta prod, colle des liens YouTube en référence, mélange les styles. Claude écrit les paramètres, Suno génère l\'audio.', to: '/beat' },
  { icon: Mic2, title: 'Voice AI', text: '15 secondes de ta voix parlée suffisent. Jusqu\'à 3 voix en feat, presets, autotune, harmonies, timeline de flow.', to: '/voice' },
  { icon: SlidersHorizontal, title: 'Studio', text: 'Mode simple pour débuter, mode avancé façon DAW : pistes, mixer, piano roll, effets, export MP3/WAV/stems.', to: '/studio' },
  { icon: Users, title: 'Community', text: 'Partage tes prods en Creative Commons CC0. Écoute, like, télécharge gratuitement celles des autres.', to: '/community' },
];

export default function Home() {
  const { user } = useAuth();
  const cta = user ? '/beat' : '/login';
  return (
    <div className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link to="/community" className="btn-ghost btn-sm">Community</Link>
          <Link to={cta} className="btn-primary btn-sm">{user ? 'Ouvrir le studio' : 'Commencer'}</Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pt-14 pb-20">
        <div className="pointer-events-none absolute -top-20 right-0 h-[420px] w-[420px] rounded-full bg-neon/25 blur-[140px]" />
        <div className="label text-neon-soft flex items-center gap-2"><Sparkles size={13} /> Studio de création musicale assisté par IA</div>
        <h1 className="title-xl mt-5 text-5xl leading-[1.02] sm:text-7xl">
          Ta prod.<br />
          <span className="bg-gradient-to-r from-neon-soft via-neon to-neon-glow bg-clip-text text-transparent">Ta voix.</span><br />
          En une idée.
        </h1>
        <p className="mt-6 max-w-xl text-base text-zinc-400">
          Écris ce que tu entends dans ta tête. BeatMind génère le beat, clone ta voix, écrit et place les paroles,
          puis te donne un vrai studio pour tout retoucher.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={cta} className="btn-primary px-6 py-3">Créer mon premier beat <ArrowRight size={16} /></Link>
          <Link to="/community" className="btn-ghost px-6 py-3">Écouter la communauté</Link>
        </div>

        <div className="mt-14 panel p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <span className="label">Prompt</span>
            <span className="hint flex items-center gap-1.5"><Youtube size={13} /> + 2 références analysées</span>
          </div>
          <p className="mt-3 font-display text-lg sm:text-xl text-zinc-200">
            « Une drill froide à la Central Cee, flûte mélancolique, 808 qui glissent, refrain chanté façon Don Toliver »
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['142 BPM', 'F# mineur harmonique', 'Intro · Couplet · Refrain · Couplet · Refrain · Outro', 'Flûte · 808 · Strings · Perc'].map((t) => (
              <span key={t} className="num rounded-full border border-neon/40 bg-neon/10 px-3 py-1 text-xs text-neon-glow">{t}</span>
            ))}
          </div>
          <div className="mt-6 flex h-16 items-end gap-[3px]">
            {Array.from({ length: 96 }, (_, i) => (
              <span key={i} className="flex-1 rounded-sm bg-neon/70 origin-bottom animate-pulsebar" style={{ height: `${25 + Math.abs(Math.sin(i * 0.37) * 60) + (i % 7) * 2}%`, animationDelay: `${(i % 12) * 0.09}s`, opacity: 0.35 + (i % 5) * 0.13 }} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-16 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, text, to }, i) => (
          <Link key={title} to={user || to === '/community' ? to : '/login'} className="panel group p-6 transition hover:shadow-neon">
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-neon/15 text-neon-soft"><Icon size={20} /></span>
              <span className="num text-xs text-mute-dim">0{i + 1}</span>
            </div>
            <h3 className="mt-5 font-display text-xl font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-mute">{text}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm text-neon-soft opacity-0 transition group-hover:opacity-100">Ouvrir <ArrowRight size={14} /></span>
          </Link>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="label mb-4">15 styles, mélangeables à volonté</div>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => <span key={s.id} className="chip-off cursor-default">{s.label}</span>)}
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-8 text-center text-xs text-mute-dim">
        BeatMind — prods publiées sous licence Creative Commons CC0. Claude · Suno · ElevenLabs · YouTube Data API.
      </footer>
    </div>
  );
}
