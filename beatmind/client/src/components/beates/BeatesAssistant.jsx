import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Minus, X, ArrowRight, SkipForward, RotateCcw, Lightbulb } from 'lucide-react';
import BeatesBot from './BeatesBot.jsx';
import Spotlight from './Spotlight.jsx';
import { TUTORIAL, TIPS, IDLE } from './script.js';
import { useBeates } from '../../store/beates.js';
import { useProject } from '../../store/project.js';
import { useAuth } from '../../lib/auth.jsx';

const hasLyrics = (s) => Object.values(s.lyrics?.sections || {}).some((x) => x.lines?.some((l) => l.trim()));

export default function BeatesAssistant() {
  const { user } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const b = useBeates();
  const [bubble, setBubble] = useState(false);
  const [tipOffset, setTipOffset] = useState(0);
  const [celebrate, setCelebrate] = useState(null);
  const [talking, setTalking] = useState(false);

  const uid = user?.id || 'guest';
  useEffect(() => { b.load(uid); }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ce que l'utilisateur a fait dans le projet (beat généré, voix ajoutée, paroles écrites)
  useEffect(() => {
    const sync = (s) => {
      const { track } = useBeates.getState();
      if (!useBeates.getState().uid) return;
      if (s.params) track('beat');
      if (s.voices.length) track('voice');
      if (hasLyrics(s)) track('lyrics');
      if (s.references.length) track('references');
    };
    sync(useProject.getState());
    return useProject.subscribe(sync);
  }, [uid]);

  const active = b.tutorial.status === 'active';
  const step = active ? TUTORIAL[b.tutorial.step] : null;
  const route = `/${loc.pathname.split('/')[1]}`;
  const onRoute = step?.route && route === step.route;

  const nextIndex = (from) => {
    let i = from + 1;
    while (i < TUTORIAL.length && TUTORIAL[i].doneWhen && b.done[TUTORIAL[i].doneWhen]) i += 1;
    return i;
  };
  const advance = () => {
    const i = nextIndex(b.tutorial.step);
    if (i >= TUTORIAL.length) b.finishTutorial('done');
    else b.goToStep(i);
  };

  // Nouveaux utilisateurs connectés : le tuto démarre tout seul
  useEffect(() => {
    if (b.uid !== uid || !user || b.tutorial.status !== 'pending') return;
    if (b.done.beat && b.done.voice && b.done.published) b.finishTutorial('done');
    else { b.startTutorial(); setBubble(true); }
  }, [b.uid, uid, user, b.tutorial.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Étape réussie : petite célébration puis étape suivante
  useEffect(() => {
    if (!step?.doneWhen || !b.done[step.doneWhen]) return undefined;
    setCelebrate(step.success);
    setBubble(true);
    const t = setTimeout(() => { setCelebrate(null); advance(); }, 2600);
    return () => clearTimeout(t);
  }, [step?.id, b.done]); // eslint-disable-line react-hooks/exhaustive-deps

  // Conseils de la page, sans ceux déjà lus ni ceux devenus inutiles
  const tips = useMemo(
    () => (TIPS[route] || []).filter((t) => !b.seen.includes(t.id) && (!t.when || t.when(b.done))),
    [route, b.seen, b.done],
  );
  const tip = tips[tipOffset % Math.max(1, tips.length)];

  // Nouvelle page : on propose le conseil si Beates est ouvert
  useEffect(() => {
    setTipOffset(0);
    if (!active && b.mode === 'open' && tips.length) setBubble(true);
  }, [route]); // eslint-disable-line react-hooks/exhaustive-deps

  const content = celebrate ? 'celebrate' : active ? 'tutorial' : bubble && tip ? 'tip' : bubble ? 'idle' : null;

  // Animation « il parle » à chaque nouveau message
  useEffect(() => {
    if (!content) return undefined;
    setTalking(true);
    const t = setTimeout(() => setTalking(false), 1600);
    return () => clearTimeout(t);
  }, [content, step?.id, tip?.id, onRoute]);

  if (!b.uid || b.mode === 'closed') return null;

  const minimized = b.mode === 'min';
  const badge = !content && tips.length > 0;
  const idleText = IDLE[(b.seen.length + route.length) % IDLE.length];

  const openFromBot = () => {
    if (minimized) b.setMode('open');
    setBubble(!bubble || minimized);
  };

  return (
    <>
      {active && onRoute && step.target && !celebrate && <Spotlight target={step.target} />}
      <div className="fixed bottom-[88px] right-3 z-[46] flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 sm:right-5">
        {!minimized && content && (
          <div role="dialog" aria-label="Beates" className="panel-hi w-[min(330px,calc(100vw-1.5rem))] animate-rise p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="label text-neon-soft">
                {content === 'tutorial' ? (step.route ? `Tuto · ${b.tutorial.step}/3` : 'Tuto') : content === 'tip' ? 'Conseil' : 'Beates'}
              </span>
              <span className="flex items-center gap-0.5">
                <button type="button" onClick={() => { setBubble(false); b.setMode('min'); }} className="rounded p-1 text-mute hover:bg-white/5 hover:text-white" aria-label="Réduire Beates" title="Réduire"><Minus size={14} /></button>
                <button type="button" onClick={() => b.setMode('closed')} className="rounded p-1 text-mute hover:bg-white/5 hover:text-white" aria-label="Fermer Beates" title="Fermer (rappel possible depuis le menu)"><X size={14} /></button>
              </span>
            </div>

            {content === 'celebrate' && <p className="font-display text-[15px] font-semibold text-neon-glow">{celebrate}</p>}

            {content === 'tutorial' && (
              <>
                <p className="font-display text-[15px] font-semibold">{step.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-300">{step.route && !onRoute ? step.away : step.text}</p>
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3].map((n) => <span key={n} className={`h-1 flex-1 rounded-full ${n < b.tutorial.step || (n === b.tutorial.step && step.doneWhen && b.done[step.doneWhen]) ? 'bg-neon' : n === b.tutorial.step ? 'bg-neon/50' : 'bg-white/10'}`} />)}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {step.cta && <button type="button" className="btn-primary btn-sm" onClick={() => (step.id === 'end' ? b.finishTutorial('done') : advance())}>{step.cta} <ArrowRight size={13} /></button>}
                  {step.route && !onRoute && <button type="button" className="btn-primary btn-sm" onClick={() => nav(step.route)}>Y aller <ArrowRight size={13} /></button>}
                  {step.route && <button type="button" className="btn-ghost btn-sm" onClick={advance}>Passer l'étape</button>}
                  {step.id !== 'end' && <button type="button" className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-mute hover:text-white" onClick={() => b.finishTutorial('skipped')}><SkipForward size={12} /> Skip le tuto</button>}
                </div>
              </>
            )}

            {content === 'tip' && (
              <>
                <p className="flex gap-2 text-[13px] leading-relaxed text-zinc-200"><Lightbulb size={15} className="mt-0.5 shrink-0 text-neon-soft" />{tip.text}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button type="button" className="btn-primary btn-sm" onClick={() => { b.markSeen(tip.id); setBubble(false); }}>Compris</button>
                  {tips.length > 1 && <button type="button" className="btn-ghost btn-sm" onClick={() => { b.markSeen(tip.id); }}>Autre conseil</button>}
                </div>
              </>
            )}

            {content === 'idle' && (
              <>
                <p className="text-[13px] text-zinc-300">{idleText}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => { b.startTutorial(); setBubble(true); }}><RotateCcw size={12} /> Relancer le tuto</button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setBubble(false)}>OK</button>
                </div>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={openFromBot}
          className={`relative rounded-full transition hover:scale-105 ${minimized ? 'opacity-80 hover:opacity-100' : ''}`}
          aria-label={content ? 'Beates' : 'Parler à Beates'}
          title="Beates"
        >
          <BeatesBot size={minimized ? 44 : 64} mood={celebrate ? 'happy' : talking ? 'talking' : 'idle'} />
          {(badge || (minimized && (active || tips.length > 0))) && <span className="absolute right-1 top-2 h-3 w-3 rounded-full border-2 border-ink bg-neon-soft shadow-neon" />}
        </button>
      </div>
    </>
  );
}
