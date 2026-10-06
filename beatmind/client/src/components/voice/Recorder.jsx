import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { api } from '../../lib/api.js';
import { addVoiceLocal } from '../../lib/db.js';
import { useAuth } from '../../lib/auth.jsx';
import { toast } from '../ui/Toaster.jsx';
import { CREDIT_COSTS } from '@shared/catalog.js';

const DURATION = 15;
const SCRIPT = "Salut, c'est moi. Je teste ma voix pour BeatMind. Je parle normalement, sans forcer, comme si je racontais ma journée à un ami. Aujourd'hui il fait beau, j'ai écouté de la musique et j'ai envie de créer un son qui me ressemble.";

function pickMime() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return types.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
}

export default function Recorder({ onCloned }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState('idle'); // idle | recording | done | uploading
  const [left, setLeft] = useState(DURATION);
  const [level, setLevel] = useState(0);
  const [blob, setBlob] = useState(null);
  const [name, setName] = useState('Ma voix');
  const rec = useRef(null);
  const stream = useRef(null);
  const raf = useRef(null);
  const blobUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => blobUrl && URL.revokeObjectURL(blobUrl), [blobUrl]);
  const timer = useRef(null);

  const cleanup = () => {
    cancelAnimationFrame(raf.current);
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
  };
  useEffect(() => cleanup, []);

  const start = async () => {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      return toast.error('Micro inaccessible : autorise l\'accès au micro dans ton navigateur.');
    }
    const ac = new AudioContext();
    const analyser = ac.createAnalyser();
    analyser.fftSize = 512;
    ac.createMediaStreamSource(stream.current).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
      setLevel(peak);
      raf.current = requestAnimationFrame(loop);
    };
    loop();
    const mime = pickMime();
    const chunks = [];
    rec.current = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
    rec.current.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.current.onstop = () => {
      cleanup();
      ac.close();
      setBlob(new Blob(chunks, { type: rec.current.mimeType || 'audio/webm' }));
      setPhase('done');
    };
    rec.current.start();
    setPhase('recording');
    setLeft(DURATION);
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const remaining = DURATION - Math.floor((Date.now() - t0) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) stop();
    }, 200);
  };

  const stop = () => {
    clearInterval(timer.current);
    if (rec.current?.state === 'recording') rec.current.stop();
  };

  const clone = async () => {
    setPhase('uploading');
    try {
      const { profile, warning } = await api.cloneVoice(blob, name);
      const saved = await addVoiceLocal(user.id, profile, blob);
      if (warning) toast.info(warning);
      toast.success(`Voix « ${name} » ${profile.eleven_voice_id ? 'clonée' : 'enregistrée'} !`);
      onCloned?.(saved);
      setBlob(null);
      setPhase('idle');
    } catch (e) {
      toast.error(e.message);
      setPhase('done');
    }
  };

  const progress = phase === 'recording' ? (DURATION - left) / DURATION : 0;

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr] items-center">
      <div className="relative mx-auto grid h-52 w-52 place-items-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="46" fill="none" stroke="#222226" strokeWidth="3" />
          <circle cx="50" cy="50" r="46" fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${progress * 289} 289`} style={{ filter: 'drop-shadow(0 0 6px #8b5cf6)' }} />
        </svg>
        <button
          type="button"
          onClick={phase === 'recording' ? stop : start}
          disabled={phase === 'uploading'}
          className={`relative grid h-32 w-32 place-items-center rounded-full transition ${phase === 'recording' ? 'bg-red-500/90' : 'bg-neon hover:bg-neon-soft'} shadow-neon-lg`}
          style={{ transform: `scale(${1 + level * 0.25})` }}
          aria-label={phase === 'recording' ? 'Arrêter' : 'Enregistrer'}
        >
          {phase === 'recording' ? <Square size={34} fill="white" /> : <Mic size={40} />}
        </button>
        {phase === 'recording' && <span className="absolute -bottom-1 num text-2xl font-semibold text-neon-glow">{left}s</span>}
      </div>

      <div>
        {phase === 'idle' || phase === 'recording' ? (
          <>
            <div className="label text-neon-soft">Lis ce texte, naturellement</div>
            <p className="mt-2 font-display text-[17px] leading-relaxed text-zinc-200">{SCRIPT}</p>
            <p className="hint mt-3">15 secondes de voix parlée suffisent — pas besoin de chanter. Place-toi dans un endroit calme, à 20 cm du micro.</p>
          </>
        ) : (
          <div className="grid gap-4">
            <div className="label text-neon-soft">Ton enregistrement</div>
            {blobUrl && <audio controls src={blobUrl} className="w-full" />}
            <label className="grid gap-1.5">
              <span className="label">Nom de la voix <span className="hint normal-case tracking-normal">— pour la retrouver plus tard</span></span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={clone} disabled={phase === 'uploading'}>
                {phase === 'uploading' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Cloner ma voix ({CREDIT_COSTS.voiceClone} crédits)
              </button>
              <button type="button" className="btn-ghost" onClick={() => { setBlob(null); setPhase('idle'); }}><RotateCcw size={15} /> Recommencer</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
