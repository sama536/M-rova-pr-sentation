// Rendu hors-ligne du morceau complet (OfflineAudioContext) : sert à la lecture, à l'export et aux stems.
import { STEPS_PER_BAR, songBars } from './arranger.js';
import { playNote } from './instruments.js';
import { processVocal } from './vocalfx.js';
import { resolveAudioUrl } from '../lib/idb.js';
import { proxiedAudio } from '../lib/api.js';

const SR = 44100;
let decodeCtx;
const bufferCache = new Map();

export function getDecodeCtx() {
  if (!decodeCtx) decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
  return decodeCtx;
}

export async function loadBuffer(url) {
  if (!url) return null;
  if (bufferCache.has(url)) return bufferCache.get(url);
  const p = (async () => {
    const real = await resolveAudioUrl(url);
    if (!real) return null;
    const res = await fetch(proxiedAudio(real));
    if (!res.ok) throw new Error(`Audio introuvable (${res.status})`);
    return getDecodeCtx().decodeAudioData(await res.arrayBuffer());
  })();
  bufferCache.set(url, p);
  try {
    return await p;
  } catch (e) {
    bufferCache.delete(url);
    throw e;
  }
}

export const secondsPerBar = (bpm) => (60 / bpm) * 4;
export const songDuration = (params) => songBars(params) * secondsPerBar(params.bpm);

function impulse(ctx, seconds = 1.8, decay = 2.6) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return b;
}

function distortionCurve(amount) {
  const k = amount * 120;
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

// Chaîne d'effets d'une piste : volume → distorsion → compresseur → pan → (envois reverb / delay)
function buildChain(ctx, track, bus) {
  const input = ctx.createGain();
  input.gain.value = track.volume ?? 0.8;
  let node = input;
  const fx = track.fx || {};
  if (fx.distortion > 0.01) {
    const ws = ctx.createWaveShaper();
    ws.curve = distortionCurve(fx.distortion);
    ws.oversample = '2x';
    const comp = ctx.createGain();
    comp.gain.value = 1 / (1 + fx.distortion * 1.5);
    node.connect(ws).connect(comp);
    node = comp;
  }
  if (fx.compressor > 0.01) {
    const c = ctx.createDynamicsCompressor();
    c.threshold.value = -6 - fx.compressor * 30;
    c.ratio.value = 2 + fx.compressor * 10;
    c.attack.value = 0.005;
    c.release.value = 0.15;
    const makeup = ctx.createGain();
    makeup.gain.value = 1 + fx.compressor * 0.8;
    node.connect(c).connect(makeup);
    node = makeup;
  }
  const pan = ctx.createStereoPanner();
  pan.pan.value = track.pan ?? 0;
  node.connect(pan);
  pan.connect(bus.master);
  if (fx.reverb > 0.01) {
    const s = ctx.createGain();
    s.gain.value = fx.reverb * 0.8;
    pan.connect(s).connect(bus.reverb);
  }
  if (fx.delay > 0.01) {
    const s = ctx.createGain();
    s.gain.value = fx.delay * 0.6;
    pan.connect(s).connect(bus.delay);
  }
  return input;
}

export function audibleTracks(tracks) {
  const anySolo = tracks.some((t) => t.solo);
  return tracks.filter((t) => !t.mute && (!anySolo || t.solo));
}

// Charge (et traite pour les voix) tous les buffers audio nécessaires au rendu.
export async function prepareAudio(params, onWarn) {
  const map = new Map();
  for (const t of params.tracks.filter((x) => x.kind === 'audio')) {
    for (const clip of t.clips || []) {
      try {
        const raw = await loadBuffer(clip.url);
        if (!raw) continue;
        const buf = t.vocal ? await processVocal(raw, { ...t.vocal, ...(clip.settings || {}) }, params) : raw;
        map.set(clip.id, buf);
      } catch (e) {
        onWarn?.(`${t.name} : ${e.message}`);
      }
    }
  }
  return map;
}

/**
 * @param params  paramètres du projet (pistes avec notes / clips)
 * @param opts.trackIds  ne rendre que ces pistes (stems)
 * @param opts.buffers   Map clipId -> AudioBuffer (voir prepareAudio)
 */
export async function renderSong(params, { trackIds, buffers = new Map(), masterVolume = 0.9, ignoreMute = false } = {}) {
  const spb = secondsPerBar(params.bpm);
  const stepDur = spb / STEPS_PER_BAR;
  let duration = songDuration(params);
  for (const t of params.tracks) {
    if (t.kind !== 'audio') continue;
    for (const c of t.clips || []) {
      const b = buffers.get(c.id);
      if (b) duration = Math.max(duration, (c.startBar || 0) * spb + b.duration);
    }
  }
  duration = Math.min(duration + 2, 60 * 8);
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);

  const master = ctx.createGain();
  master.gain.value = masterVolume;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 2;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.1;
  master.connect(limiter).connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx);
  const reverbIn = ctx.createGain();
  reverbIn.connect(reverb).connect(master);
  const delay = ctx.createDelay(2);
  delay.delayTime.value = (60 / params.bpm) * 0.75;
  const fb = ctx.createGain();
  fb.gain.value = 0.35;
  const dlp = ctx.createBiquadFilter();
  dlp.type = 'lowpass';
  dlp.frequency.value = 3500;
  const delayIn = ctx.createGain();
  delayIn.connect(delay).connect(dlp).connect(fb).connect(delay);
  dlp.connect(master);
  const bus = { master, reverb: reverbIn, delay: delayIn };

  let tracks = ignoreMute ? params.tracks : audibleTracks(params.tracks);
  if (trackIds) tracks = params.tracks.filter((t) => trackIds.includes(t.id));
  const swing = params.swing || 0;

  const events = [];
  for (const track of tracks) {
    const input = buildChain(ctx, track, bus);
    if (track.kind === 'audio') {
      for (const clip of track.clips || []) {
        const buf = buffers.get(clip.id);
        if (!buf) continue;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        g.gain.value = clip.gain ?? 1;
        src.connect(g).connect(input);
        src.start((clip.startBar || 0) * spb, clip.offset || 0, clip.maxDuration || undefined);
      }
      continue;
    }
    for (const n of track.notes || []) {
      const swingOffset = Math.floor(n.s) % 2 === 1 ? swing * stepDur : 0;
      const t = n.s * stepDur + swingOffset;
      if (t >= duration) continue;
      events.push({ t, run: () => playNote(ctx, input, track.synth, t, n.p, n.l * stepDur, n.v ?? 0.8) });
    }
  }

  // Les nœuds Web Audio coûtent tant qu'ils existent : on crée les notes au fil du rendu
  // (suspend/resume par fenêtres d'une seconde) plutôt que toutes d'avance.
  events.sort((x, y) => x.t - y.t);
  const WINDOW = 1;
  let i = 0;
  const scheduleUntil = (limit) => { while (i < events.length && events[i].t < limit) events[i++].run(); };
  if (typeof ctx.suspend === 'function') {
    scheduleUntil(WINDOW);
    for (let k = 1; k * WINDOW < duration; k++) {
      const at = k * WINDOW;
      ctx.suspend(at).then(() => { scheduleUntil(at + WINDOW); ctx.resume(); });
    }
  } else {
    scheduleUntil(Infinity);
  }
  return ctx.startRendering();
}

export function peaks(buffer, count = 600) {
  if (!buffer) return [];
  const data = buffer.getChannelData(0);
  const block = Math.max(1, Math.floor(data.length / count));
  const out = new Array(count).fill(0);
  for (let i = 0; i < count; i++) {
    let max = 0;
    const start = i * block;
    for (let j = 0; j < block; j += 8) {
      const v = Math.abs(data[start + j] || 0);
      if (v > max) max = v;
    }
    out[i] = max;
  }
  return out;
}
