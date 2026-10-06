// Transport audio global : lit un AudioBuffer rendu, gère play/pause/seek et notifie l'UI.
import { getDecodeCtx } from './renderer.js';

const listeners = new Set();
const state = { buffer: null, playing: false, offset: 0, startedAt: 0, source: null, label: '', ownerId: null, loop: false };

const emit = () => listeners.forEach((fn) => fn());

function ctx() {
  const c = getDecodeCtx();
  if (c.state === 'suspended') c.resume();
  return c;
}

export const player = {
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  get state() { return state; },
  time() {
    if (!state.buffer) return 0;
    if (!state.playing) return state.offset;
    return Math.min(state.buffer.duration, ctx().currentTime - state.startedAt + state.offset);
  },
  load(buffer, { label = '', ownerId = null, keepPosition = false } = {}) {
    const wasPlaying = state.playing;
    const pos = keepPosition ? player.time() : 0;
    player.stop(true);
    state.buffer = buffer;
    state.label = label;
    state.ownerId = ownerId;
    state.offset = Math.min(pos, buffer?.duration || 0);
    emit();
    if (wasPlaying && keepPosition) player.play();
  },
  play(at) {
    if (!state.buffer) return;
    const c = ctx();
    if (state.source) { state.source.onended = null; state.source.stop(); }
    const offset = at ?? (state.offset >= state.buffer.duration - 0.05 ? 0 : state.offset);
    const src = c.createBufferSource();
    src.buffer = state.buffer;
    src.connect(c.destination);
    src.onended = () => {
      if (state.source !== src) return;
      state.playing = false;
      state.offset = 0;
      state.source = null;
      emit();
    };
    src.start(0, offset);
    state.source = src;
    state.startedAt = c.currentTime;
    state.offset = offset;
    state.playing = true;
    emit();
  },
  pause() {
    if (!state.playing) return;
    state.offset = player.time();
    state.source.onended = null;
    state.source.stop();
    state.source = null;
    state.playing = false;
    emit();
  },
  toggle() { (state.playing ? player.pause : player.play)(); },
  seek(t) {
    const clamped = Math.max(0, Math.min(t, state.buffer?.duration || 0));
    if (state.playing) player.play(clamped);
    else { state.offset = clamped; emit(); }
  },
  stop(silent) {
    if (state.source) { state.source.onended = null; try { state.source.stop(); } catch { /* déjà arrêté */ } }
    state.source = null;
    state.playing = false;
    state.offset = 0;
    if (!silent) emit();
  },
};
