// Synthèse des instruments avec Web Audio (aucun sample : tout est généré).
// Chaque fonction programme une note : (ctx, out, t, freq, dur, vel, extra).
import { midiToFreq, DRUM } from './arranger.js';

const noiseCache = new WeakMap();
function noise(ctx) {
  if (!noiseCache.has(ctx)) {
    const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return noiseCache.get(ctx);
}

function env(ctx, t, { a = 0.005, peak = 1, d = 0.2, s = 0.6, dur = 0.5, r = 0.2 }) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setTargetAtTime(peak * s, t + a, d / 3);
  const end = Math.max(t + a + 0.01, t + dur);
  g.gain.setTargetAtTime(0.0001, end, r / 3);
  return { g, stop: end + r * 1.5 };
}

function osc(ctx, type, freq, t, stop, detune = 0) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.detune.value = detune;
  o.start(t);
  o.stop(stop);
  return o;
}

function vibrato(ctx, target, t, stop, rate = 5.5, depth = 12, delay = 0.25) {
  const lfo = ctx.createOscillator();
  const lg = ctx.createGain();
  lfo.frequency.value = rate;
  lg.gain.setValueAtTime(0, t);
  lg.gain.linearRampToValueAtTime(depth, t + delay);
  lfo.connect(lg).connect(target);
  lfo.start(t);
  lfo.stop(stop);
}

function filter(ctx, type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function multiOsc(ctx, out, t, freq, dur, vel, { types, detunes, a, d, s, r, lp, q = 0.7, vib }) {
  const e = env(ctx, t, { a, d, s, dur, r, peak: vel });
  const f = filter(ctx, 'lowpass', lp, q);
  f.connect(e.g).connect(out);
  types.forEach((type, i) => {
    const o = osc(ctx, type, freq, t, e.stop, detunes[i] || 0);
    const g = ctx.createGain();
    g.gain.value = 1 / types.length;
    if (vib) vibrato(ctx, o.detune, t, e.stop, vib.rate, vib.depth);
    o.connect(g).connect(f);
  });
}

export const SYNTHS = {
  piano(ctx, out, t, freq, dur, vel) {
    const e = env(ctx, t, { a: 0.004, d: 1.2, s: 0.0001, dur: Math.min(dur + 0.4, 3), r: 0.25, peak: vel * 0.9 });
    const f = filter(ctx, 'lowpass', 1800 + vel * 3500);
    f.frequency.setTargetAtTime(900, t, 0.4);
    f.connect(e.g).connect(out);
    [['triangle', 1, 0.7], ['sine', 2, 0.25], ['sine', 3, 0.08]].forEach(([type, mult, lvl]) => {
      const g = ctx.createGain();
      g.gain.value = lvl;
      osc(ctx, type, freq * mult, t, e.stop).connect(g).connect(f);
    });
  },
  keys(ctx, out, t, freq, dur, vel) {
    const e = env(ctx, t, { a: 0.005, d: 0.8, s: 0.35, dur, r: 0.3, peak: vel * 0.8 });
    e.g.connect(out);
    const trem = ctx.createGain();
    trem.connect(e.g);
    osc(ctx, 'sine', freq, t, e.stop).connect(trem);
    const bell = ctx.createGain();
    bell.gain.value = 0.15;
    osc(ctx, 'sine', freq * 4, t, e.stop).connect(bell).connect(trem);
  },
  strings: (ctx, out, t, f, dur, vel) => multiOsc(ctx, out, t, f, dur, vel * 0.55, { types: ['sawtooth', 'sawtooth', 'sawtooth'], detunes: [-9, 0, 8], a: 0.18, d: 0.3, s: 0.85, r: 0.5, lp: 2600 }),
  violin: (ctx, out, t, f, dur, vel) => multiOsc(ctx, out, t, f, dur, vel * 0.6, { types: ['sawtooth', 'sawtooth'], detunes: [-4, 4], a: 0.09, d: 0.2, s: 0.9, r: 0.25, lp: 3200, q: 1.5, vib: { rate: 5.8, depth: 18 } }),
  pad: (ctx, out, t, f, dur, vel) => multiOsc(ctx, out, t, f, dur, vel * 0.45, { types: ['sawtooth', 'sawtooth', 'triangle'], detunes: [-14, 12, 0], a: 0.5, d: 0.6, s: 0.8, r: 1.1, lp: 1100 }),
  synth: (ctx, out, t, f, dur, vel) => multiOsc(ctx, out, t, f, dur, vel * 0.5, { types: ['square', 'sawtooth'], detunes: [-6, 6], a: 0.01, d: 0.25, s: 0.6, r: 0.18, lp: 3800, q: 2 }),
  brass: (ctx, out, t, f, dur, vel) => multiOsc(ctx, out, t, f, dur, vel * 0.55, { types: ['sawtooth', 'sawtooth'], detunes: [-5, 5], a: 0.06, d: 0.2, s: 0.8, r: 0.15, lp: 2200, q: 1.2 }),
  choir(ctx, out, t, freq, dur, vel) {
    const e = env(ctx, t, { a: 0.35, d: 0.5, s: 0.85, dur, r: 0.8, peak: vel * 0.9 });
    e.g.connect(out);
    [[800, 6], [1150, 7], [2900, 9]].forEach(([fq, q], i) => {
      const bp = filter(ctx, 'bandpass', fq, q);
      const g = ctx.createGain();
      g.gain.value = [1, 0.6, 0.2][i];
      bp.connect(g).connect(e.g);
      [-10, 0, 11].forEach((dt) => {
        const o = osc(ctx, 'sawtooth', freq, t, e.stop, dt);
        vibrato(ctx, o.detune, t, e.stop, 5, 8, 0.4);
        o.connect(bp);
      });
    });
  },
  sax(ctx, out, t, freq, dur, vel) {
    const e = env(ctx, t, { a: 0.05, d: 0.2, s: 0.8, dur, r: 0.12, peak: vel * 0.7 });
    const bp = filter(ctx, 'bandpass', 1100, 0.9);
    const lp = filter(ctx, 'lowpass', 3500);
    bp.connect(lp).connect(e.g).connect(out);
    const o = osc(ctx, 'sawtooth', freq, t, e.stop);
    vibrato(ctx, o.detune, t, e.stop, 5, 14, 0.2);
    o.connect(bp);
    const n = ctx.createBufferSource();
    n.buffer = noise(ctx);
    n.loop = true;
    const ng = ctx.createGain();
    ng.gain.value = 0.05;
    n.connect(filter(ctx, 'bandpass', 2500, 1)).connect(ng).connect(e.g);
    n.start(t);
    n.stop(e.stop);
  },
  flute(ctx, out, t, freq, dur, vel) {
    const e = env(ctx, t, { a: 0.07, d: 0.2, s: 0.85, dur, r: 0.15, peak: vel * 0.75 });
    e.g.connect(out);
    const o = osc(ctx, 'sine', freq, t, e.stop);
    vibrato(ctx, o.detune, t, e.stop, 5.2, 10, 0.3);
    o.connect(e.g);
    const h = ctx.createGain();
    h.gain.value = 0.12;
    osc(ctx, 'sine', freq * 2, t, e.stop).connect(h).connect(e.g);
    const n = ctx.createBufferSource();
    n.buffer = noise(ctx);
    n.loop = true;
    const ng = ctx.createGain();
    ng.gain.value = 0.06;
    n.connect(filter(ctx, 'bandpass', freq * 2, 3)).connect(ng).connect(e.g);
    n.start(t);
    n.stop(e.stop);
  },
  guitar(ctx, out, t, freq, dur, vel) {
    const e = env(ctx, t, { a: 0.002, d: 0.9, s: 0.0001, dur: Math.min(dur + 0.6, 2.2), r: 0.2, peak: vel * 0.8 });
    const lp = filter(ctx, 'lowpass', 5000, 1.5);
    lp.frequency.setTargetAtTime(700, t, 0.12);
    lp.connect(e.g).connect(out);
    osc(ctx, 'sawtooth', freq, t, e.stop).connect(lp);
    const g = ctx.createGain();
    g.gain.value = 0.5;
    osc(ctx, 'triangle', freq * 2, t, e.stop, 3).connect(g).connect(lp);
  },
  bell(ctx, out, t, freq, dur, vel) {
    const e = env(ctx, t, { a: 0.002, d: 1.5, s: 0.0001, dur: 1.8, r: 0.3, peak: vel * 0.6 });
    e.g.connect(out);
    osc(ctx, 'sine', freq, t, e.stop).connect(e.g);
    const g = ctx.createGain();
    g.gain.value = 0.35;
    osc(ctx, 'sine', freq * 2.76, t, e.stop).connect(g).connect(e.g);
  },
  bass(ctx, out, t, freq, dur, vel) {
    const e = env(ctx, t, { a: 0.005, d: 0.3, s: 0.7, dur, r: 0.08, peak: vel * 0.9 });
    const lp = filter(ctx, 'lowpass', 700, 2);
    lp.frequency.setTargetAtTime(280, t, 0.15);
    lp.connect(e.g).connect(out);
    osc(ctx, 'sawtooth', freq, t, e.stop).connect(lp);
    osc(ctx, 'sine', freq / 2, t, e.stop).connect(e.g);
  },
  '808'(ctx, out, t, freq, dur, vel) {
    const e = env(ctx, t, { a: 0.003, d: 1.6, s: 0.55, dur: Math.max(dur, 0.25), r: 0.12, peak: vel });
    e.g.connect(out);
    const o = osc(ctx, 'sine', freq * 2.2, t, e.stop);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
    o.connect(e.g);
    const h = ctx.createGain();
    h.gain.value = 0.18;
    const o2 = osc(ctx, 'triangle', freq * 2, t, e.stop);
    o2.connect(h).connect(e.g);
  },
  drums(ctx, out, t, _freq, _dur, vel, midi) {
    const hit = DRUM_SYNTHS[midi] || DRUM_SYNTHS[DRUM.rim];
    hit(ctx, out, t, vel);
  },
  perc(...args) { SYNTHS.drums(...args); },
};

function noiseHit(ctx, out, t, vel, { type, freq, q = 1, decay, gain = 1 }) {
  const n = ctx.createBufferSource();
  n.buffer = noise(ctx);
  const f = filter(ctx, type, freq, q);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel * gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  n.connect(f).connect(g).connect(out);
  n.start(t, Math.random() * 0.5);
  n.stop(t + decay + 0.02);
}

const DRUM_SYNTHS = {
  [DRUM.kick](ctx, out, t, vel) {
    const o = osc(ctx, 'sine', 160, t, t + 0.5);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 1.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(out);
    noiseHit(ctx, out, t, vel * 0.25, { type: 'highpass', freq: 3000, decay: 0.01 });
  },
  [DRUM.snare](ctx, out, t, vel) {
    noiseHit(ctx, out, t, vel * 0.8, { type: 'bandpass', freq: 1900, q: 0.8, decay: 0.2 });
    const o = osc(ctx, 'triangle', 200, t, t + 0.15);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.6, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(out);
  },
  [DRUM.clap](ctx, out, t, vel) {
    [0, 0.012, 0.024].forEach((dt) => noiseHit(ctx, out, t + dt, vel * 0.6, { type: 'bandpass', freq: 1300, q: 1.2, decay: 0.03 }));
    noiseHit(ctx, out, t + 0.03, vel * 0.7, { type: 'bandpass', freq: 1300, q: 1.2, decay: 0.18 });
  },
  [DRUM.hat]: (ctx, out, t, vel) => noiseHit(ctx, out, t, vel * 0.45, { type: 'highpass', freq: 7500, decay: 0.045 }),
  [DRUM.openhat]: (ctx, out, t, vel) => noiseHit(ctx, out, t, vel * 0.4, { type: 'highpass', freq: 6500, decay: 0.32 }),
  [DRUM.shaker]: (ctx, out, t, vel) => noiseHit(ctx, out, t, vel * 0.35, { type: 'bandpass', freq: 6000, q: 0.8, decay: 0.06 }),
  [DRUM.rim](ctx, out, t, vel) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.4, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc(ctx, 'square', 1750, t, t + 0.06).connect(filter(ctx, 'bandpass', 1750, 4)).connect(g).connect(out);
  },
  [DRUM.cowbell](ctx, out, t, vel) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    const bp = filter(ctx, 'bandpass', 800, 2);
    bp.connect(g).connect(out);
    osc(ctx, 'square', 540, t, t + 0.32).connect(bp);
    osc(ctx, 'square', 800, t, t + 0.32).connect(bp);
  },
  [DRUM.log](ctx, out, t, vel) {
    const o = osc(ctx, 'sine', 220, t, t + 0.45);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(out);
  },
};

export function playNote(ctx, out, synth, t, midi, dur, vel) {
  const fn = SYNTHS[synth] || SYNTHS.synth;
  fn(ctx, out, t, midiToFreq(midi), dur, vel, midi);
}
