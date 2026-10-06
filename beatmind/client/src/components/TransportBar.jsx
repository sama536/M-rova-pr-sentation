import { Link } from 'react-router-dom';
import { Play, Pause, Loader2, SlidersHorizontal } from 'lucide-react';
import { usePlayer, useProjectRender, useAutoRender } from '../audio/usePlayer.js';
import { player } from '../audio/player.js';
import { useProject } from '../store/project.js';
import { fmtTime } from '../lib/format.js';
import Waveform from './ui/Waveform.jsx';

export default function TransportBar() {
  useAutoRender();
  const p = usePlayer();
  const params = useProject((s) => s.params);
  const { render, rendering, peaks } = useProjectRender();
  const isProject = p.ownerId === 'project' || !p.buffer;
  if (!params && !p.buffer) return null;

  const toggle = () => {
    if (isProject && params) {
      if (p.playing) player.pause();
      else render({ play: true });
    } else player.toggle();
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 lg:left-60 border-t border-white/[0.07] bg-ink/90 backdrop-blur-xl">
      <div className="flex items-center gap-4 px-4 py-2.5">
        <button type="button" onClick={toggle} className="grid place-items-center h-10 w-10 shrink-0 rounded-full bg-neon text-white shadow-neon hover:bg-neon-soft" aria-label={p.playing ? 'Pause' : 'Lecture'}>
          {rendering ? <Loader2 size={18} className="animate-spin" /> : p.playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <div className="min-w-0 w-40 sm:w-52">
          <div className="truncate text-sm font-semibold">{(isProject ? params?.title : p.label) || 'Sans titre'}</div>
          <div className="num text-[11px] text-mute">
            {fmtTime(p.time)} / {fmtTime(p.duration)}
            {isProject && params && <span className="ml-2 text-neon-soft">{params.bpm} BPM · {params.key} {params.scale === 'major' ? 'maj' : 'min'}</span>}
          </div>
        </div>
        <Waveform
          className="flex-1 hidden sm:block"
          height={36}
          peaks={isProject ? peaks : []}
          progress={p.duration ? p.time / p.duration : 0}
          onSeek={(r) => player.seek(r * p.duration)}
        />
        {rendering && <span className="hidden md:inline label text-neon-soft">Rendu…</span>}
        <Link to="/studio" className="btn-ghost btn-sm hidden sm:inline-flex"><SlidersHorizontal size={14} /> Studio</Link>
      </div>
    </div>
  );
}
