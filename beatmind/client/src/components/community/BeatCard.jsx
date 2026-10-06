import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, Heart, Bookmark, MessageCircle, Download, Loader2, BadgeCheck, Send, Trash2 } from 'lucide-react';
import { usePlayer } from '../../audio/usePlayer.js';
import { player } from '../../audio/player.js';
import { playBeat, beatBlob } from './beatAudio.js';
import { listComments, addComment, trackStat } from '../../lib/db.js';
import { download } from '../../audio/exporter.js';
import { fmtNum, fmtAgo, slug, coverFor } from '../../lib/format.js';
import { useAuth } from '../../lib/auth.jsx';
import { toast } from '../ui/Toaster.jsx';
import { styleById, CC_LICENSE } from '@shared/catalog.js';

const playedOnce = new Set();

export default function BeatCard({ beat, liked, saved, onReact, onDelete }) {
  const { user } = useAuth();
  const p = usePlayer();
  const [loading, setLoading] = useState(false);
  const [dl, setDl] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [count, setCount] = useState(beat.comments_count || 0);
  const mine = p.ownerId === beat.id;
  const playing = mine && p.playing;
  const color = coverFor(beat.title + beat.id);

  useEffect(() => {
    if (showComments) listComments(beat.id).then(setComments).catch((e) => toast.error(e.message));
  }, [showComments, beat.id]);

  const play = async () => {
    setLoading(true);
    try {
      await playBeat(beat);
      if (!playedOnce.has(beat.id)) { playedOnce.add(beat.id); trackStat(beat.id, 'plays').catch(() => {}); }
    } catch (e) {
      toast.error(`Lecture : ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const doDownload = async () => {
    setDl(true);
    try {
      download(await beatBlob(beat), `${slug(beat.title)}_${slug(beat.user?.display_name || 'beatmind')}_CC0.mp3`);
      trackStat(beat.id, 'downloads').catch(() => {});
    } catch (e) {
      toast.error(`Téléchargement : ${e.message}`);
    } finally {
      setDl(false);
    }
  };

  const send = async () => {
    if (!user) return toast.error('Connecte-toi pour commenter.');
    try {
      const c = await addComment(user.id, beat.id, text);
      if (c) { setComments((x) => [...x, c]); setCount((n) => n + 1); setText(''); }
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <article className={`panel overflow-hidden transition ${playing ? 'shadow-neon' : ''}`}>
      <div className="flex gap-4 p-4">
        <button type="button" onClick={play} className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl" style={{ background: `radial-gradient(circle at 30% 20%, ${color}, #121214 75%)` }} aria-label={playing ? 'Pause' : 'Lecture'}>
          <span className="absolute inset-x-2 bottom-2 flex h-8 items-end gap-[2px] opacity-60">
            {Array.from({ length: 14 }, (_, i) => <span key={i} className={`flex-1 rounded-sm bg-white/80 origin-bottom ${playing ? 'animate-pulsebar' : ''}`} style={{ height: `${30 + ((i * 53 + beat.title.length * 7) % 70)}%`, animationDelay: `${i * 0.08}s` }} />)}
          </span>
          <span className="relative grid h-10 w-10 place-items-center rounded-full bg-ink/80 backdrop-blur">
            {loading ? <Loader2 size={18} className="animate-spin" /> : playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-display text-base font-semibold">{beat.title}</h3>
              <Link to={`/producer/${beat.user?.username || beat.user_id}`} className="text-sm text-neon-soft hover:underline">{beat.user?.display_name || 'Producteur'}</Link>
              <span className="hint"> · {fmtAgo(beat.created_at)}</span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-neon/30 px-1.5 py-0.5 text-[10px] font-semibold text-neon-glow" title={CC_LICENSE.hint}><BadgeCheck size={11} /> CC0</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {beat.bpm && <span className="num rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-zinc-300">{beat.bpm} BPM</span>}
            {beat.key && <span className="num rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-zinc-300">{beat.key}</span>}
            {beat.styles?.map((s) => <span key={s} className="rounded-md bg-neon/10 px-1.5 py-0.5 text-[11px] text-neon-glow">{styleById(s)?.label || s}</span>)}
            {beat.moods?.slice(0, 2).map((m) => <span key={m} className="rounded-md bg-white/[0.03] px-1.5 py-0.5 text-[11px] text-mute">{m}</span>)}
          </div>
          {mine && p.duration > 0 && (
            <div className="mt-2.5 h-1 cursor-pointer overflow-hidden rounded-full bg-ink-600" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); player.seek(((e.clientX - r.left) / r.width) * p.duration); }}>
              <div className="h-full bg-neon" style={{ width: `${(p.time / p.duration) * 100}%` }} />
            </div>
          )}
          <div className="mt-3 flex items-center gap-1 text-[12px] text-mute">
            <button type="button" onClick={() => onReact(beat, 'like', !liked)} className={`flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/[0.04] ${liked ? 'text-pink-400' : ''}`}><Heart size={14} fill={liked ? 'currentColor' : 'none'} /> {fmtNum(beat.likes_count)}</button>
            <button type="button" onClick={() => onReact(beat, 'save', !saved)} className={`flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/[0.04] ${saved ? 'text-neon-soft' : ''}`}><Bookmark size={14} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Sauvé' : 'Sauver'}</button>
            <button type="button" onClick={() => setShowComments(!showComments)} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/[0.04]"><MessageCircle size={14} /> {count}</button>
            <button type="button" onClick={doDownload} className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-zinc-300 hover:bg-white/[0.04]">
              {dl ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {fmtNum(beat.downloads)}
            </button>
            {onDelete && user?.id === beat.user_id && <button type="button" onClick={() => onDelete(beat)} className="rounded-md p-1 hover:text-red-400" title="Supprimer"><Trash2 size={14} /></button>}
          </div>
        </div>
      </div>
      {showComments && (
        <div className="border-t border-white/[0.06] bg-ink-900/50 p-4">
          <div className="grid max-h-60 gap-2.5 overflow-auto">
            {comments.length === 0 && <p className="hint">Aucun commentaire. Lance la discussion !</p>}
            {comments.map((c) => (
              <div key={c.id} className="text-sm">
                <span className="font-semibold text-neon-soft">{c.user?.display_name || 'Anonyme'}</span>
                <span className="hint"> · {fmtAgo(c.created_at)}</span>
                <p className="text-zinc-300">{c.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input className="input py-2" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={user ? 'Ton commentaire…' : 'Connecte-toi pour commenter'} disabled={!user} maxLength={1000} />
            <button type="button" className="btn-primary btn-sm" onClick={send} disabled={!text.trim()}><Send size={13} /></button>
          </div>
        </div>
      )}
    </article>
  );
}
