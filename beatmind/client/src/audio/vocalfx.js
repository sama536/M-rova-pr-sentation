// Traitement vocal dans le navigateur : pitch shift (durée conservée), autotune (détection de
// hauteur + correction vers la gamme du morceau), harmonies empilées, backs selon le genre, timbre.
// Algorithme : overlap-add de grains rééchantillonnés + autocorrélation décimée pour la hauteur.
import { KEYS, SCALES, styleById } from '@shared/catalog.js';
import { getDecodeCtx } from './renderer.js';

const N = 2048;
const HOP = N / 4;
const DEC = 4;
const HANN = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
const cache = new Map();
let bufIds = new WeakMap();
let nextBufId = 1;

function bufferId(b) {
  if (!bufIds.has(b)) bufIds.set(b, nextBufId++);
  return bufIds.get(b);
}

function toMono(buffer) {
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] += d[i] / buffer.numberOfChannels;
  }
  return out;
}

function detectPitches(x, sr) {
  const frames = Math.ceil(x.length / HOP);
  const f0 = new Float32Array(frames);
  const W = N / DEC;
  const dsr = sr / DEC;
  const minLag = Math.floor(dsr / 900);
  const maxLag = Math.ceil(dsr / 70);
  const seg = new Float32Array(W + maxLag);
  for (let k = 0; k < frames; k++) {
    const start = k * HOP;
    let energy = 0;
    for (let i = 0; i < seg.length; i++) {
      const v = x[start + i * DEC] || 0;
      seg[i] = v;
      if (i < W) energy += v * v;
    }
    if (energy / W < 1e-5) continue; // silence
    let best = 0;
    let bestLag = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0;
      let e2 = 0;
      for (let i = 0; i < W; i++) {
        s += seg[i] * seg[i + lag];
        e2 += seg[i + lag] * seg[i + lag];
      }
      const r = s / Math.sqrt(energy * e2 + 1e-12);
      if (r > best) { best = r; bestLag = lag; }
    }
    if (best > 0.6 && bestLag) f0[k] = dsr / bestLag;
  }
  return f0;
}

function snapToScale(midi, params) {
  const root = KEYS.indexOf(params?.key || 'C');
  const steps = (SCALES[params?.scale] || SCALES.minor).steps;
  let best = midi;
  let dist = Infinity;
  for (let o = -1; o <= 1; o++) {
    const base = Math.floor(midi / 12) * 12 + o * 12;
    for (const s of steps) {
      const cand = base + ((root + s) % 12);
      const d = Math.abs(cand - midi);
      if (d < dist) { dist = d; best = cand; }
    }
  }
  return best;
}

// Ratio de transposition par grain (pitch global × correction autotune)
function ratios(f0, { pitch = 0, autotune = 0 }, params, extraSemis = 0) {
  const base = 2 ** ((pitch + extraSemis) / 12);
  const amount = autotune / 100;
  const speed = 0.12 + amount * 0.88; // vitesse de correction : 100 = instantanée (effet robot)
  const out = new Float32Array(f0.length);
  let corr = 0;
  for (let k = 0; k < f0.length; k++) {
    let target = 0;
    if (f0[k] > 0 && amount > 0) {
      const midi = 69 + 12 * Math.log2((f0[k] * base) / 440);
      target = (snapToScale(Math.round(midi * 4) / 4, params) - midi) * amount;
    }
    corr += (target - corr) * speed;
    out[k] = base * 2 ** (corr / 12);
  }
  return out;
}

// Pitch shift à durée constante :
// 1) rééchantillonnage à taux variable (hauteur × r, mais la durée change),
// 2) WSOLA : on recolle des fenêtres alignées par corrélation pour revenir à la durée d'origine.
const WN = 1536;
const WH = WN / 2;
const TOL = 320;
const WWIN = Float32Array.from({ length: WN }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / WN));

function shift(x, r) {
  const len = x.length;
  let allOne = true;
  for (let k = 0; k < r.length; k++) if (Math.abs(r[k] - 1) > 1e-4) { allOne = false; break; }
  if (allOne) return x.slice();

  // 1. Rééchantillonnage : y[j] = x(tau[j]), tau avance de r(tau) par échantillon
  const est = Math.ceil(len / Math.max(0.25, Math.min(...r))) + 2;
  const y = new Float32Array(est);
  const tau = new Float64Array(est);
  let t = 0;
  let n = 0;
  while (t < len - 1 && n < est) {
    const i0 = Math.floor(t);
    const f = t - i0;
    y[n] = x[i0] * (1 - f) + x[i0 + 1] * f;
    tau[n] = t;
    n++;
    t += r[Math.min(r.length - 1, Math.floor(t / HOP))] || 1;
  }

  // 2. WSOLA vers la durée d'origine
  const out = new Float32Array(len);
  const D = 4; // recherche grossière décimée puis affinage
  let j = 0;
  let prev = -1;
  for (let k = 0; k * WH < len; k++) {
    const tOut = k * WH;
    while (j < n - 1 && tau[j] < tOut) j++;
    let best = j;
    if (prev >= 0) {
      const target = prev + WH;
      let bestScore = -Infinity;
      const lo = Math.max(0, j - TOL);
      const hi = Math.min(n - WN - 1, j + TOL);
      const scan = (from, to, step, inner) => {
        for (let c = from; c <= to; c += step) {
          let sxy = 0;
          let syy = 1e-9;
          for (let i = 0; i < WH; i += inner) {
            const a = y[target + i] || 0;
            const b = y[c + i];
            sxy += a * b;
            syy += b * b;
          }
          const score = sxy / Math.sqrt(syy);
          if (score > bestScore) { bestScore = score; best = c; }
        }
      };
      if (hi > lo) {
        scan(lo, hi, D, D);
        const center = best;
        scan(Math.max(lo, center - D), Math.min(hi, center + D), 1, 1);
      }
    }
    for (let i = 0; i < WN; i++) {
      const o = tOut + i;
      if (o >= len) break;
      out[o] += (y[best + i] || 0) * WWIN[i];
    }
    prev = best;
  }
  return out;
}

function tilt(x, timbre, sr) {
  // timbre 0 = sombre (passe-bas), 100 = brillant (accent des aigus)
  const amt = (timbre - 50) / 50;
  if (Math.abs(amt) < 0.05) return x;
  const a = Math.exp((-2 * Math.PI * 1800) / sr);
  const out = new Float32Array(x.length);
  let lp = 0;
  for (let i = 0; i < x.length; i++) {
    lp = (1 - a) * x[i] + a * lp;
    out[i] = amt < 0 ? x[i] * (1 + amt) + lp * -amt : x[i] + (x[i] - lp) * amt * 1.2;
  }
  return out;
}

function addInto(dst, src, gain, delaySamples = 0) {
  for (let i = 0; i < src.length; i++) {
    const j = i + delaySamples;
    if (j >= 0 && j < dst.length) dst[j] += src[i] * gain;
  }
}

function softClip(x, drive) {
  if (drive <= 0) return x;
  const k = 1 + drive * 8;
  return x.map((v) => Math.tanh(v * k) / Math.tanh(k));
}

/**
 * @param settings  { pitch, autotune, harmonies, backs, energy, timbre, backsStyle }
 * Saturation et reverb sont appliquées ensuite par la chaîne d'effets de la piste.
 */
export async function processVocal(buffer, settings, params) {
  const key = `${bufferId(buffer)}|${JSON.stringify(settings)}|${params?.key}|${params?.scale}|${params?.bpm}`;
  if (cache.has(key)) return cache.get(key);
  await new Promise((r) => setTimeout(r, 0)); // laisse respirer l'interface
  const sr = buffer.sampleRate;
  const x = toMono(buffer);
  const f0 = detectPitches(x, sr);
  const lead = tilt(shift(x, ratios(f0, settings, params)), settings.timbre ?? 50, sr);
  const L = new Float32Array(x.length);
  const R = new Float32Array(x.length);
  const energyGain = 0.75 + ((settings.energy ?? 60) / 100) * 0.5;
  addInto(L, lead, energyGain);
  addInto(R, lead, energyGain);

  const minorish = params?.scale !== 'major';
  const intervals = minorish ? [3, 7, 12] : [4, 7, 12];
  for (let h = 0; h < Math.min(3, settings.harmonies || 0); h++) {
    const voice = shift(x, ratios(f0, settings, params, intervals[h]));
    const pan = h % 2 === 0 ? 0.75 : 0.25;
    addInto(L, voice, 0.32 * (1 - pan) * 2 * energyGain, Math.floor(sr * 0.008 * (h + 1)));
    addInto(R, voice, 0.32 * pan * 2 * energyGain, Math.floor(sr * 0.008 * (h + 1)));
  }

  if (settings.backs) {
    const style = settings.backsStyle || styleById(params?.styles?.[0])?.backs || 'trap';
    const beat = (60 / (params?.bpm || 120)) * sr;
    if (style === 'drill') {
      const low = softClip(shift(x, ratios(f0, settings, params, -12)), 0.4);
      addInto(L, low, 0.28, Math.floor(sr * 0.012)); addInto(R, low, 0.28, Math.floor(sr * 0.012));
    } else if (style === 'house') {
      [12, 7].forEach((s, i) => { const v = shift(x, ratios(f0, settings, params, s)); addInto(i ? R : L, v, 0.3, Math.floor(sr * 0.02)); addInto(i ? L : R, v, 0.12, Math.floor(sr * 0.03)); });
    } else if (style === 'afro') {
      const resp = shift(x, ratios(f0, settings, params, intervals[0]));
      addInto(L, resp, 0.26, Math.floor(beat * 2)); addInto(R, resp, 0.18, Math.floor(beat * 2));
    } else if (style === 'jazz') {
      const soft = tilt(shift(x, ratios(f0, settings, params, intervals[0])), 20, sr);
      addInto(L, soft, 0.18, Math.floor(sr * 0.03)); addInto(R, soft, 0.22, Math.floor(sr * 0.03));
    } else if (style === 'phonk') {
      const ch = softClip(shift(x, ratios(f0, settings, params, -12)), 0.8);
      addInto(L, ch, 0.22); addInto(R, ch, 0.22);
    } else if (style === 'cloud') {
      addInto(L, lead, 0.25, Math.floor(beat * 0.75)); addInto(R, lead, 0.25, Math.floor(beat * 1.5));
    } else {
      // trap / défaut : doublage court et saturé, légèrement décalé
      const dbl = softClip(lead, 0.6);
      addInto(L, dbl, 0.3, Math.floor(sr * 0.015)); addInto(R, dbl, 0.3, Math.floor(sr * 0.022));
    }
  }

  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  if (peak > 0.95) {
    const g = 0.95 / peak;
    for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; }
  }
  const out = getDecodeCtx().createBuffer(2, x.length, sr);
  out.copyToChannel(L, 0);
  out.copyToChannel(R, 1);
  cache.set(key, out);
  if (cache.size > 40) cache.delete(cache.keys().next().value);
  return out;
}

export function resetVocalCache() {
  cache.clear();
  bufIds = new WeakMap();
}
