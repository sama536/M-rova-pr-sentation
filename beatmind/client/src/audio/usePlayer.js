import { useEffect, useState, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { player } from './player.js';
import { renderSong, prepareAudio, peaks as computePeaks } from './renderer.js';
import { useProject } from '../store/project.js';
import { toast } from '../components/ui/Toaster.jsx';

let snap = { ...player.state };
const subscribe = (fn) => player.subscribe(() => { snap = { ...player.state }; fn(); });

export function usePlayer() {
  const s = useSyncExternalStore(subscribe, () => snap);
  const [time, setTime] = useState(player.time());
  useEffect(() => {
    let raf;
    const loop = () => { setTime(player.time()); raf = requestAnimationFrame(loop); };
    if (s.playing) loop();
    else setTime(player.time());
    return () => cancelAnimationFrame(raf);
  }, [s.playing, s.offset, s.buffer]);
  return { ...s, time, duration: s.buffer?.duration || 0 };
}

// Rend le projet courant dans le player. État partagé entre tous les composants (un seul rendu à la fois).
export const useRenderState = create(() => ({ rendering: false, peaks: [], revision: -1 }));
let cachedBuffer = null;
let inflight = null;

export async function renderProject({ play = false, keepPosition = true } = {}) {
  const p = useProject.getState().params;
  if (!p) return null;
  const rev = useProject.getState().revision;
  const rs = useRenderState.getState();
  if (rs.revision === rev && cachedBuffer) {
    if (player.state.buffer !== cachedBuffer) player.load(cachedBuffer, { label: p.title, ownerId: 'project', keepPosition });
    if (play) player.play();
    return cachedBuffer;
  }
  if (inflight) {
    await inflight;
    return renderProject({ play, keepPosition });
  }
  useRenderState.setState({ rendering: true });
  inflight = (async () => {
    try {
      const warned = new Set();
      const buffers = await prepareAudio(p, (w) => { if (!warned.has(w)) { warned.add(w); toast.error(w); } });
      const buffer = await renderSong(p, { buffers, masterVolume: useProject.getState().masterVolume });
      cachedBuffer = buffer;
      useRenderState.setState({ revision: rev, peaks: computePeaks(buffer, 700) });
      player.load(buffer, { label: p.title, ownerId: 'project', keepPosition });
    } catch (e) {
      toast.error(`Rendu impossible : ${e.message}`);
    } finally {
      useRenderState.setState({ rendering: false });
      inflight = null;
    }
  })();
  await inflight;
  if (play && cachedBuffer && useRenderState.getState().revision === rev) player.play();
  return cachedBuffer;
}

export function useProjectRender() {
  const revision = useProject((s) => s.revision);
  const { rendering, peaks, revision: renderedRev } = useRenderState();
  return { render: renderProject, rendering, peaks, upToDate: renderedRev === revision };
}

// À monter une seule fois (barre de transport) : re-rend automatiquement après une modification.
export function useAutoRender() {
  const revision = useProject((s) => s.revision);
  const hasParams = useProject((s) => !!s.params);
  useEffect(() => {
    if (!hasParams || useRenderState.getState().revision === revision) return undefined;
    const t = setTimeout(() => {
      if (player.state.ownerId === 'project' && player.state.buffer) renderProject({ keepPosition: true });
    }, 500);
    return () => clearTimeout(t);
  }, [revision, hasParams]);
}
