// Transforme les paramètres de prod (BPM, gamme, progression, structure, pistes)
// en notes concrètes, éditables ensuite dans le piano roll.
// Grille : 16 pas par mesure (doubles-croches). Une note = { id, p (MIDI), s (pas), l (durée en pas), v (vélocité 0-1) }.
import { KEYS, SCALES } from '@shared/catalog.js';
import { seededRandom, hashString } from '@shared/generators.js';

export const STEPS_PER_BAR = 16;
export const DRUM = { kick: 36, rim: 37, snare: 38, clap: 39, hat: 42, shaker: 44, openhat: 46, cowbell: 56, log: 60 };
export const DRUM_NAMES = { 36: 'Kick', 37: 'Rim', 38: 'Snare', 39: 'Clap', 42: 'Hat', 44: 'Shaker', 46: 'Open hat', 56: 'Cowbell', 60: 'Log drum' };

let nid = 0;
const note = (p, s, l, v = 0.8) => ({ id: `n${(nid++).toString(36)}`, p, s, l, v });

export function songBars(params) {
  return params.structure.reduce((a, s) => a + s.bars, 0);
}

export function sectionAtBar(params, bar) {
  let acc = 0;
  for (const s of params.structure) {
    if (bar < acc + s.bars) return { section: s, start: acc };
    acc += s.bars;
  }
  return { section: params.structure.at(-1), start: acc };
}

export function sectionRanges(params) {
  let acc = 0;
  return params.structure.map((s) => {
    const r = { ...s, startBar: acc, endBar: acc + s.bars };
    acc += s.bars;
    return r;
  });
}

export function degreeToMidi(params, degree, octave) {
  const steps = (SCALES[params.scale] || SCALES.minor).steps;
  const root = KEYS.indexOf(params.key);
  const o = Math.floor(degree / 7);
  const d = ((degree % 7) + 7) % 7;
  return 12 * (octave + 1) + root + steps[d] + 12 * o;
}

const DRUM_PATTERNS = {
  trap: { kick: [0, 7, 10], snare: [8], hat: 'eighths', clap: [8] },
  rage: { kick: [0, 3, 10], snare: [8], hat: 'eighths', clap: [8] },
  drill: { kick: [0, 11], snare: [8], snareAlt: [6, 14], hat: [0, 3, 6, 8, 11, 14], rim: [] },
  four: { kick: [0, 4, 8, 12], clap: [4, 12], hat: [2, 6, 10, 14], openhat: [2, 10] },
  boombap: { kick: [0, 7, 10], snare: [4, 12], hat: 'eighths' },
  swing: { kick: [0, 10], rim: [4, 12], hat: [0, 4, 7, 8, 12, 15] },
  afro: { kick: [0, 6, 10], rim: [3, 7, 11, 14], shaker: 'sixteenths', clap: [8] },
  dembow: { kick: [0, 4, 8, 12], snare: [3, 6, 11, 14], hat: 'eighths' },
  rnb: { kick: [0, 9, 10], snare: [4, 12], hat: 'eighths' },
  phonk: { kick: [0, 10], snare: [8], cowbell: [0, 3, 6, 10, 12], hat: 'sixteenths' },
  hyperpop: { kick: [0, 4, 8, 11, 12], snare: [4, 12], hat: 'sixteenths' },
  amapiano: { kick: [0, 4, 8, 12], rim: [3, 7, 11, 15], shaker: 'sixteenths', log: [0, 3, 6, 10, 13] },
};

function steps(spec) {
  if (spec === 'eighths') return [0, 2, 4, 6, 8, 10, 12, 14];
  if (spec === 'sixteenths') return Array.from({ length: 16 }, (_, i) => i);
  return spec || [];
}

function trackActive(role, section) {
  const e = section.energy ?? 0.7;
  const t = section.type;
  if (role === 'drums') return e >= 0.45 && t !== 'intro' && t !== 'outro';
  if (role === 'bass808' || role === 'bass') return e >= 0.5 && t !== 'intro';
  if (role === 'lead') return t === 'refrain' || t === 'intro' || e >= 0.85;
  if (role === 'arp') return e >= 0.4;
  return true; // chords, pad
}

// Comment jouent la basse et les accords. Les anciens projets (sans « arrangement ») le déduisent du rythme.
const ARRANGEMENT_BY_PATTERN = {
  trap: { bass: '808', chords: 'arp' }, rage: { bass: '808', chords: 'arp' }, phonk: { bass: '808', chords: 'halfbar' },
  drill: { bass: '808glide', chords: 'halfbar' }, four: { bass: 'offbeat', chords: 'stabs' }, swing: { bass: 'walking', chords: 'comp' },
  boombap: { bass: 'root', chords: 'comp' }, afro: { bass: 'root', chords: 'pluck' }, amapiano: { bass: 'log', chords: 'comp' },
  dembow: { bass: 'dembow', chords: 'stabs' }, rnb: { bass: 'root', chords: 'sustain' }, hyperpop: { bass: 'reese', chords: 'arp' },
};
export function arrangementOf(params) {
  return { ...(ARRANGEMENT_BY_PATTERN[params.drums?.pattern] || { bass: '808', chords: 'sustain' }), ...(params.arrangement || {}) };
}

export function arrangeTrack(params, track) {
  const rand = seededRandom(hashString(track.id + params.key + params.bpm));
  const bars = songBars(params);
  const prog = params.progression?.length ? params.progression : [0, 5, 2, 6];
  const notes = [];
  const pattern = DRUM_PATTERNS[params.drums?.pattern] || DRUM_PATTERNS.trap;
  const arr = arrangementOf(params);
  const density = params.drums?.density ?? 0.7;
  const motif = Array.from({ length: 8 }, () => ({ deg: Math.floor(rand() * 7), on: rand() < 0.75 }));

  for (let bar = 0; bar < bars; bar++) {
    const { section, start } = sectionAtBar(params, bar);
    if (!trackActive(track.role, section)) continue;
    const base = bar * STEPS_PER_BAR;
    const chord = prog[bar % prog.length];
    const isLastOfSection = bar === start + section.bars - 1;
    const energy = section.energy ?? 0.7;

    switch (track.role) {
      case 'drums': {
        steps(pattern.kick).forEach((s) => notes.push(note(DRUM.kick, base + s, 2, 0.95)));
        const snares = pattern.snareAlt && bar % 2 === 1 ? pattern.snareAlt : pattern.snare;
        steps(snares).forEach((s) => notes.push(note(DRUM.snare, base + s, 2, 0.9)));
        steps(pattern.clap).forEach((s) => notes.push(note(DRUM.clap, base + s, 2, 0.6)));
        steps(pattern.rim).forEach((s) => notes.push(note(DRUM.rim, base + s, 1, 0.6)));
        steps(pattern.cowbell).forEach((s) => notes.push(note(DRUM.cowbell, base + s, 2, 0.55)));
        steps(pattern.log).forEach((s) => notes.push(note(DRUM.log, base + s, 3, 0.8)));
        steps(pattern.openhat).forEach((s) => notes.push(note(DRUM.openhat, base + s, 2, 0.45)));
        steps(pattern.shaker).forEach((s) => notes.push(note(DRUM.shaker, base + s, 1, s % 2 ? 0.25 : 0.4)));
        const hats = steps(pattern.hat);
        hats.forEach((s) => {
          const rollHere = (params.drums?.hatRolls ?? 0) > rand() && s >= 12 && (bar % 2 === 1 || isLastOfSection);
          if (rollHere) {
            const div = rand() > 0.5 ? 3 : 4;
            for (let k = 0; k < div; k++) notes.push(note(DRUM.hat, base + s + (k * 2) / div, 0.5, 0.35 + k * 0.08));
          } else if (rand() < 0.55 + density * 0.45) notes.push(note(DRUM.hat, base + s, 1, s % 4 === 0 ? 0.55 : 0.38));
        });
        if (isLastOfSection && energy > 0.6) {
          [12, 13, 14, 15].forEach((s, k) => notes.push(note(DRUM.snare, base + s, 1, 0.4 + k * 0.12)));
        }
        break;
      }
      case 'bass808': {
        const root = degreeToMidi(params, chord, track.octave ?? 1);
        const nextRoot = degreeToMidi(params, prog[(bar + 1) % prog.length], track.octave ?? 1);
        const hits = steps(pattern.kick).filter((s) => s < 16);
        hits.forEach((s, i) => {
          const end = hits[i + 1] ?? 16;
          const last = i === hits.length - 1;
          let p = root;
          if (arr.bass === '808glide' && i > 0 && rand() > 0.55) p = degreeToMidi(params, chord + (rand() > 0.5 ? 4 : 2), track.octave ?? 1);
          else if (last && rand() > 0.6) p = root + 12;
          const n = note(p, base + s, Math.max(1, end - s), 0.9);
          // Drill : la dernière 808 de la mesure glisse vers la note suivante
          if (arr.bass === '808glide' && last && nextRoot !== p) n.g = nextRoot;
          notes.push(n);
        });
        break;
      }
      case 'bass': {
        const oct = track.octave ?? 2;
        const deg = (d) => degreeToMidi(params, chord + d, oct);
        const root = deg(0);
        const nextRoot = degreeToMidi(params, prog[(bar + 1) % prog.length], oct);
        switch (arr.bass) {
          case 'walking': // jazz : une note par temps, approche chromatique de l'accord suivant
            [[0, deg(0)], [4, deg(2)], [8, deg(4)], [12, nextRoot + (rand() > 0.5 ? -1 : 1)]].forEach(([s, p]) => notes.push(note(p, base + s, 4, 0.78)));
            break;
          case 'offbeat': // house / techno : basse sur les contretemps
            [2, 6, 10, 14].forEach((s, i) => notes.push(note(i === 3 && rand() > 0.5 ? root + 12 : root, base + s, 2, 0.82)));
            break;
          case 'log': // amapiano : log drum syncopé et mélodique
            [0, 3, 6, 10, 13].forEach((s, i) => notes.push(note(i % 2 ? deg(4) - 12 + 12 * (rand() > 0.6) : root, base + s, 2, 0.85)));
            break;
          case 'dembow': // reggaeton : suit le kick
            [0, 4, 8, 12].forEach((s) => notes.push(note(root, base + s, 3, 0.85)));
            break;
          case 'reese': // hyperpop / techno sombre : basse tenue
            notes.push(note(root, base, 8, 0.8));
            notes.push(note(root + (rand() > 0.5 ? 12 : 7), base + 8, 8, 0.75));
            break;
          case 'root':
          default: // afro, boom bap, R&B : basse ronde sur la fondamentale
            notes.push(note(root, base, 6, 0.82));
            notes.push(note(deg(4), base + 10, 3, 0.74));
            notes.push(note(root, base + 14, 2, 0.7));
            break;
        }
        break;
      }
      case 'chords': {
        const oct = track.octave ?? 4;
        const rich = ['jazz', 'rnb', 'amapiano', 'boombap'].some((st) => params.styles?.includes(st));
        const tones = [0, 2, 4, ...(rich ? [6] : [])].map((d) => degreeToMidi(params, chord + d, oct));
        switch (arr.chords) {
          case 'stabs': {
            const at = params.drums?.pattern === 'dembow' ? [3, 6, 11, 14] : [2, 6, 10, 14];
            at.forEach((s) => tones.forEach((p) => notes.push(note(p, base + s, 1.5, 0.6))));
            break;
          }
          case 'comp': { // jazz / amapiano : accords syncopés, voicing enrichi
            const voicing = [2, 4, 6, 8].map((d) => degreeToMidi(params, chord + d, oct));
            const rhythm = rand() > 0.5 ? [[0, 5], [7, 3], [10, 4]] : [[0, 3], [6, 4], [11, 3]];
            rhythm.forEach(([s, l]) => voicing.forEach((p) => notes.push(note(p, base + s, l, 0.58))));
            break;
          }
          case 'pluck': // afro : guitare pincée en croches syncopées
            [0, 3, 6, 8, 11, 14].forEach((s, i) => notes.push(note(tones[i % tones.length] + (i % 3 === 2 ? 12 : 0), base + s, 1.5, 0.6)));
            break;
          case 'arp': // trap / rage : arpège en boucle
            for (let s = 0; s < 16; s += 2) notes.push(note(tones[(s / 2) % tones.length] + (s >= 8 && energy > 0.8 ? 12 : 0), base + s, 2, 0.55));
            break;
          case 'halfbar': // drill / techno : deux accords tenus par mesure
            tones.forEach((p) => notes.push(note(p, base, 8, 0.55)));
            tones.forEach((p, i) => notes.push(note(i === 0 ? p + 12 : p, base + 8, 8, 0.5)));
            break;
          case 'sustain':
          default:
            tones.forEach((p) => notes.push(note(p, base, 16, 0.55)));
            if (energy > 0.8) tones.forEach((p) => notes.push(note(p + 12, base + 8, 8, 0.35)));
            break;
        }
        break;
      }
      case 'pad': {
        const oct = track.octave ?? 4;
        [0, 2, 4].forEach((d) => notes.push(note(degreeToMidi(params, chord + d, oct), base, 16, 0.5)));
        break;
      }
      case 'arp': {
        const oct = track.octave ?? 4;
        const tones = [0, 2, 4, 7].map((d) => degreeToMidi(params, chord + d, oct));
        for (let s = 0; s < 16; s += 2) notes.push(note(tones[(s / 2) % tones.length], base + s, 2, 0.55));
        break;
      }
      case 'lead': {
        const oct = track.octave ?? 5;
        const half = (bar % 2) * 4;
        for (let k = 0; k < 4; k++) {
          const m = motif[half + k];
          const variation = section.type === 'refrain' && bar % 4 === 3 ? 1 : 0;
          if (!m.on) continue;
          // Notes de l'accord ramenées dans une seule octave : la mélodie reste dans la tessiture (≈ C5–C6)
          const deg = ((chord + [0, 2, 4][m.deg % 3]) % 7) + (m.deg > 5 ? -2 : 0) + variation;
          notes.push(note(degreeToMidi(params, deg, oct), base + k * 4, k === 3 ? 4 : 3, 0.7));
        }
        break;
      }
      default:
        break;
    }
  }
  return notes;
}

// Ajoute les notes manquantes à chaque piste MIDI (les pistes audio — Suno, voix — n'en ont pas).
export function arrangeAll(params) {
  return {
    ...params,
    tracks: params.tracks.map((t) => (t.kind === 'audio' || (Array.isArray(t.notes) && t.notes.length) ? t : { ...t, notes: arrangeTrack(params, t) })),
  };
}

export const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const midiName = (m) => `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
