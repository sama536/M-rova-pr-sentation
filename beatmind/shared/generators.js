// Générateurs déterministes utilisés quand aucune clé API n'est configurée (mode démo)
// et pour compléter / valider les réponses de Claude. Même entrée = même sortie.
import {
  STYLES, INSTRUMENTS, KEYS, SCALES, SECTION_TYPES, FLOW_MODES, MOODS,
  styleById, instrumentById, guessInstrumentRole,
} from './catalog.js';
import {
  STYLE_PROFILES, DRUM_PATTERN_IDS, BASS_STYLES, CHORD_STYLES, ARTIST_HINTS,
  profileFor, canonicalInstrument, fitBpm,
} from './styleProfiles.js';

export function hashString(str = '') {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRandom(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const uid = (p = 't') => `${p}_${Math.random().toString(36).slice(2, 9)}`;

const DEFAULT_SYNTH = {
  piano: 'piano', saxophone: 'sax', '808': '808', strings: 'strings', guitare: 'guitar',
  flute: 'flute', violon: 'violin', synthe: 'synth', basse: 'bass', perc: 'drums', pad: 'pad', choir: 'choir',
};

const STRUCTURE_TEMPLATES = {
  default: [['intro', 4, 0.35], ['couplet', 16, 0.65], ['refrain', 8, 0.95], ['couplet', 16, 0.7], ['refrain', 8, 1], ['outro', 4, 0.3]],
  dance: [['intro', 8, 0.4], ['couplet', 8, 0.6], ['refrain', 8, 1], ['pont', 8, 0.45], ['refrain', 8, 1], ['outro', 8, 0.35]],
  short: [['intro', 4, 0.4], ['couplet', 8, 0.7], ['refrain', 8, 1], ['pont', 4, 0.5], ['refrain', 8, 1], ['outro', 4, 0.3]],
};

export function makeTrack(instrumentId, extra = {}) {
  const known = instrumentById(instrumentId);
  const guess = known ? null : guessInstrumentRole(instrumentId);
  const role = known ? known.role : guess.role;
  const synth = known ? DEFAULT_SYNTH[instrumentId] : guess.synth;
  const base = {
    drums: { volume: 0.85, octave: 0 }, bass808: { volume: 0.9, octave: 1 }, bass: { volume: 0.75, octave: 2 },
    chords: { volume: 0.6, octave: 4 }, pad: { volume: 0.45, octave: 4 }, lead: { volume: 0.55, octave: 5 }, arp: { volume: 0.5, octave: 4 },
  }[role];
  return {
    id: uid('trk'),
    name: known ? known.label : instrumentId.charAt(0).toUpperCase() + instrumentId.slice(1),
    instrument: instrumentId,
    synth,
    role,
    volume: base.volume,
    pan: 0,
    octave: base.octave,
    mute: false,
    solo: false,
    fx: {
      reverb: role === 'pad' || role === 'lead' ? 0.35 : role === 'drums' ? 0.08 : 0.15,
      delay: role === 'lead' || role === 'arp' ? 0.2 : 0,
      distortion: role === 'bass808' ? 0.25 : 0,
      compressor: role === 'drums' || role === 'bass808' ? 0.5 : 0.25,
    },
    notes: null,
    ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined)),
  };
}

// Fusionne les fiches des styles choisis : le 1er style donne le groove (batterie, basse),
// les plages de BPM sont croisées, les instruments réunis.
export function blendStyles(styles = []) {
  const ids = (styles.length ? styles : ['trap']).filter((id) => STYLE_PROFILES[id]);
  if (!ids.length) ids.push('trap');
  const profiles = ids.map(profileFor);
  const main = profiles[0];
  let lo = Math.max(...profiles.map((p) => p.bpm[0]));
  let hi = Math.min(...profiles.map((p) => p.bpm[1]));
  if (lo > hi) [lo, hi] = main.bpm; // styles incompatibles : le style principal décide
  return {
    ids, main, profiles, bpmRange: [lo, hi],
    instruments: Array.from(new Set(profiles.flatMap((p) => p.instruments))).slice(0, 6),
  };
}

// Combine les références analysées en une cible chiffrée (BPM, tonalité, instruments, mood…)
export function referenceTarget(references = [], bpmRange) {
  // Une référence mal identifiée (fiabilité faible) ne doit pas tirer la prod dans une mauvaise direction
  const refs = references.filter((r) => r && (r.confidence ?? 1) >= 0.45);
  if (!refs.length) return null;
  const bpms = refs.map((r) => fitBpm(Number(r.bpm), bpmRange)).filter(Boolean);
  const keys = refs.map((r) => normalizeKeyName(r.key)).filter(Boolean);
  const count = (arr) => arr.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {});
  const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    bpm: bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : null,
    key: top(count(keys)) || null,
    scale: top(count(refs.map((r) => (SCALES[r.scale] ? r.scale : null)).filter(Boolean))) || null,
    style: top(count(refs.map((r) => r.style).filter((x) => STYLE_PROFILES[x]))) || null,
    instruments: Array.from(new Set(refs.flatMap((r) => (r.instruments || []).map(canonicalInstrument)))).filter((i) => instrumentById(i)),
    mood: refs.map((r) => r.mood).filter(Boolean)[0] || null,
    titles: refs.map((r) => r.title).filter(Boolean),
  };
}

export function generateBeatParams({ prompt = '', styles = [], instruments = [], references = [], referenceWeight = 0.7 } = {}) {
  const rand = seededRandom(hashString(prompt + styles.join() + instruments.join() + references.map((r) => r.id || r.title).join()));
  const w = clamp(Number(referenceWeight) || 0, 0, 1);
  // Sans style choisi, c'est la référence qui décide du style
  const firstPass = blendStyles(styles);
  const ref = referenceTarget(references, firstPass.bpmRange);
  const styleIds = styles.length ? styles : (ref?.style ? [ref.style] : ['trap']);
  const blend = blendStyles(styleIds);
  const { main } = blend;
  const refFit = ref && referenceTarget(references, blend.bpmRange);
  const p = prompt.toLowerCase();

  // BPM : centre de la plage du style, tiré vers la référence selon son influence
  const [lo, hi] = blend.bpmRange;
  let bpm = Math.round(lo + (hi - lo) * (0.35 + rand() * 0.3));
  if (/(lent|slow|calme|chill|posé)/.test(p)) bpm = Math.round(lo + (hi - lo) * 0.15);
  if (/(rapide|fast|énerg|energ|hard|agressi)/.test(p)) bpm = Math.round(lo + (hi - lo) * 0.85);
  const bpmInPrompt = p.match(/(\d{2,3})\s?bpm/);
  if (bpmInPrompt) bpm = fitBpm(Number(bpmInPrompt[1]), [60, 200]);
  else if (refFit?.bpm) bpm = Math.round(bpm * (1 - w) + refFit.bpm * w);
  bpm = clamp(bpm, lo, hi);

  // Gamme / tonalité
  let scale = main.scales[Math.floor(rand() * Math.min(2, main.scales.length))];
  if (/(joyeux|happy|solaire|lumineux|summer|été|feel ?good)/.test(p) && main.scales.includes('major')) scale = 'major';
  if (/(sombre|dark|triste|sad|menaç|froid)/.test(p) && scale === 'major') scale = main.scales.find((x) => x !== 'major') || 'minor';
  if (refFit?.scale && w >= 0.5 && main.scales.includes(refFit.scale)) scale = refFit.scale;
  const keyInPrompt = p.match(/\b([a-g][#b]?)\s?(min|maj|mineur|majeur|m)\b/);
  const key = (keyInPrompt && normalizeKeyName(keyInPrompt[1])) || (refFit?.key && w >= 0.4 ? refFit.key : pick(rand, KEYS));

  const template = ['house', 'techno', 'amapiano', 'hyperpop'].includes(blend.ids[0]) ? STRUCTURE_TEMPLATES.dance
    : /(court|short|snippet)/.test(p) ? STRUCTURE_TEMPLATES.short : STRUCTURE_TEMPLATES.default;
  const structure = template.map(([type, bars, energy], i) => ({
    id: `sec_${i}`, type, label: SECTION_TYPES.find((s) => s.id === type).label, bars, energy,
  }));

  // Instruments : ceux de l'utilisateur d'abord, puis ceux du style, puis ceux entendus dans les références
  const userInstruments = instruments.map(canonicalInstrument);
  // Instruments des références : seulement ceux compatibles avec le style (pas de 808 dans un jazz)
  const styleKit = new Set(blend.profiles.flatMap((pr) => pr.instruments));
  const fromRefs = w >= 0.5 ? (refFit?.instruments || []).filter((i) => styleKit.has(i) || (i !== '808' && i !== 'perc')) : [];
  const instrumentIds = Array.from(new Set([
    'perc',
    ...(userInstruments.length ? userInstruments : blend.instruments),
    ...fromRefs.slice(0, userInstruments.length ? 1 : 2),
  ])).slice(0, 7);
  const tracks = instrumentIds.map((id) => makeTrack(id, { synth: styleSynth(id, blend.ids[0]) || undefined }));
  const base = new Set(['perc', ...(userInstruments.length ? userInstruments : blend.instruments)]);
  const addedFromRefs = instrumentIds.filter((i) => !base.has(i));

  const progression = pick(rand, main.progressions);
  const mood = (w >= 0.5 && refFit?.mood) || blend.ids.map((id) => styleById(id)?.mood).join(', ').split(',')[0].trim();
  const styleLabel = blend.ids.map((id) => styleById(id)?.label || id).join(' × ');
  const referenceNotes = refFit ? [
    refFit.bpm ? `Tempo calé sur les références (${refFit.bpm} BPM, ramené dans la plage ${lo}–${hi} du style).` : null,
    refFit.key && w >= 0.4 ? `Tonalité reprise des références : ${refFit.key}.` : null,
    addedFromRefs.length ? `Instruments ajoutés d'après les références : ${addedFromRefs.map((i) => instrumentById(i)?.label || i).join(', ')}.` : null,
    !styles.length && refFit.style ? `Style déduit des références : ${styleById(refFit.style)?.label}.` : null,
    refFit.mood && w >= 0.5 ? `Ambiance reprise : ${refFit.mood}.` : null,
  ].filter(Boolean) : [];

  return {
    title: titleFromPrompt(prompt, styleLabel, rand),
    description: `${styleLabel} à ${bpm} BPM en ${key} ${SCALES[scale].label.toLowerCase()}, ambiance ${mood}.`,
    bpm, key, scale, mood,
    swing: main.swing,
    halfTime: main.halfTime,
    styles: blend.ids,
    drums: { pattern: main.drums, hatRolls: main.hatRolls, density: main.density },
    arrangement: { bass: main.bass, chords: main.chords, lead: main.lead },
    progression,
    structure,
    tracks,
    mix: {
      loudness: -9, warmth: 0.4, width: 0.6,
      notes: [
        main.bass.startsWith('808') ? 'Sidechain léger de l\'808 sur le kick pour qu\'ils ne se battent pas.' : 'Laisse la basse respirer : coupe-la sous 40 Hz et sous le kick.',
        'Coupe les basses (<120 Hz) sur tout sauf kick, 808 et basse.',
        'Les éléments mélodiques gagnent à être panoramisés légèrement (±20).',
      ],
    },
    productionNotes: [main.signature, `Progression en degrés : ${progression.map((d) => d + 1).join(' – ')}.`, `À éviter : ${main.avoid}.`],
    referenceNotes,
    sunoPrompt: `${styleLabel.toLowerCase()} instrumental, ${bpm} bpm, ${key} ${scale}, ${mood}, ${tracks.map((t) => t.name.toLowerCase()).join(', ')}, ${main.signature.split(',')[0].toLowerCase()}`,
    source: 'local',
  };
}

// Timbre adapté au style (ex. piano « keys » en house/jazz, cloche en trap)
function styleSynth(instrumentId, style) {
  const map = {
    house: { piano: 'keys', synthe: 'synth', basse: 'bass' },
    jazz: { piano: 'keys', basse: 'bass' },
    rnb: { piano: 'keys' },
    amapiano: { piano: 'keys', basse: 'bass' },
    trap: { synthe: 'bell' },
    phonk: { synthe: 'bell' },
    boombap: { piano: 'keys' },
  };
  return map[style]?.[instrumentId] || null;
}

function titleFromPrompt(prompt, styleLabel, rand) {
  const words = ['Nuit', 'Néon', 'Velours', 'Orbite', 'Mirage', 'Chrome', 'Ombre', 'Fièvre', 'Lune', 'Vertige', 'Écho', 'Prisme'];
  const tail = ['Violette', 'Noire', 'Froide', 'Lente', 'Sauvage', 'Infinie', 'Brûlante', 'Silencieuse'];
  const clean = prompt.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter((w) => w.length > 4);
  if (clean.length && rand() > 0.5) {
    const w = clean[Math.floor(rand() * clean.length)];
    return `${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()} ${pick(rand, tail)}`;
  }
  return `${pick(rand, words)} ${pick(rand, tail)}`;
}

export function normalizeBeatParams(raw, fallbackInput) {
  const fb = generateBeatParams(fallbackInput);
  if (!raw || typeof raw !== 'object') return fb;
  const blend = blendStyles(fb.styles);
  const { main } = blend;
  const out = { ...fb, ...raw };
  // BPM : Claude peut proposer, mais jamais hors de la plage du style (± 4)
  const [lo, hi] = blend.bpmRange;
  const fitted = fitBpm(Number(raw.bpm), [lo, hi]);
  out.bpm = fitted ? clamp(fitted, lo - 4, hi + 4) : fb.bpm;
  out.key = normalizeKeyName(raw.key) || fb.key;
  out.scale = SCALES[raw.scale] ? raw.scale : fb.scale;
  out.swing = Number.isFinite(Number(raw.swing)) ? clamp(Number(raw.swing), 0, 0.5) : fb.swing;
  if (main.swing === 0) out.swing = Math.min(out.swing, 0.05);
  out.halfTime = main.halfTime;
  out.progression = Array.isArray(raw.progression) && raw.progression.length >= 2
    ? raw.progression.map((d) => clamp(Math.round(Number(d)) || 0, 0, 6)).slice(0, 8) : fb.progression;
  out.structure = Array.isArray(raw.structure) && raw.structure.length
    ? raw.structure.map((s, i) => {
      const type = SECTION_TYPES.find((t) => t.id === s.type) ? s.type : 'couplet';
      return { id: `sec_${i}`, type, label: s.label || SECTION_TYPES.find((t) => t.id === type).label,
        bars: clamp(Math.round(Number(s.bars) || 8), 1, 32), energy: clamp(Number(s.energy) || 0.6, 0, 1) };
    }) : fb.structure;
  // Batterie : un motif inconnu retombait sur « trap » → la prod ne sonnait jamais comme le style choisi
  const rawPattern = String(raw.drums?.pattern || '').toLowerCase();
  const pattern = DRUM_PATTERN_IDS.includes(rawPattern) ? rawPattern : main.drums;
  out.drums = {
    pattern: pattern === main.drums || blend.profiles.some((pr) => pr.drums === pattern) ? pattern : main.drums,
    hatRolls: clamp(Number(raw.drums?.hatRolls ?? main.hatRolls), 0, 1),
    density: clamp(Number(raw.drums?.density ?? main.density), 0.2, 1),
  };
  const arr = raw.arrangement || {};
  out.arrangement = {
    bass: BASS_STYLES.includes(arr.bass) ? arr.bass : main.bass,
    chords: CHORD_STYLES.includes(arr.chords) ? arr.chords : main.chords,
    lead: arr.lead || main.lead,
  };
  // Pistes : noms d'instruments ramenés au catalogue, et ceux demandés par l'utilisateur toujours présents
  const wanted = (fallbackInput.instruments || []).map(canonicalInstrument);
  let tracks = Array.isArray(raw.tracks) && raw.tracks.length
    ? raw.tracks.map((t) => {
      const id = canonicalInstrument(t.instrument || t.name || 'synthe');
      const base = makeTrack(id, { synth: styleSynth(id, blend.ids[0]) || undefined });
      return {
        ...base,
        name: base.name,
        volume: clamp(Number(t.volume ?? base.volume), 0.1, 1),
        pan: clamp(Number(t.pan ?? 0), -1, 1),
        octave: clamp(Math.round(Number(t.octave ?? base.octave)), 0, 7),
        fx: {
          reverb: clamp(Number(t.fx?.reverb ?? base.fx.reverb), 0, 1),
          delay: clamp(Number(t.fx?.delay ?? base.fx.delay), 0, 1),
          distortion: clamp(Number(t.fx?.distortion ?? base.fx.distortion), 0, 1),
          compressor: clamp(Number(t.fx?.compressor ?? base.fx.compressor), 0, 1),
        },
        notesHint: t.notesHint || '',
      };
    }) : fb.tracks;
  const seen = new Set();
  tracks = tracks.filter((t) => (seen.has(t.instrument) ? false : seen.add(t.instrument)));
  wanted.forEach((id) => { if (!seen.has(id)) { tracks.push(makeTrack(id, { synth: styleSynth(id, blend.ids[0]) || undefined })); seen.add(id); } });
  if (!tracks.some((t) => t.role === 'drums')) tracks.unshift(makeTrack('perc'));
  out.tracks = tracks.slice(0, 8);
  out.mix = { ...fb.mix, ...(raw.mix || {}), notes: raw.mix?.notes?.length ? raw.mix.notes : fb.mix.notes };
  out.productionNotes = Array.isArray(raw.productionNotes) && raw.productionNotes.length ? raw.productionNotes : fb.productionNotes;
  out.referenceNotes = Array.isArray(raw.referenceNotes) && raw.referenceNotes.length ? raw.referenceNotes.map(String) : fb.referenceNotes;
  out.styles = fb.styles;
  return out;
}

// ---------- Paroles ----------

const LYRIC_BANK = {
  punch: [
    'J\'arrive en silence mais je repars en fanfare',
    'Ils parlent de moi, moi je parle à la caisse',
    'Mon ombre a plus de flow que leurs refrains',
    'J\'ai transformé la pression en carburant',
    'Pas de plan B, j\'ai brûlé l\'alphabet',
    'Le temps c\'est de l\'or, j\'ai pas le temps pour l\'argent',
    'Ils veulent ma place, faudra porter mon poids',
    'Je compte mes pas comme je compte les faux',
  ],
  flow: [
    'Je tourne en ville quand la lune est violette',
    'Les néons dans les yeux, la tête dans la tempête',
    'Je garde mes secrets dans la poche intérieure',
    'J\'écris sous la pluie, les mots tombent à l\'heure',
    'On partait de rien, maintenant tout s\'arrête',
    'Les rêves ont un prix mais j\'ai payé la dette',
    'J\'entends les sirènes mais j\'écoute mon cœur',
    'Minuit sur le compteur, j\'accélère la lueur',
  ],
  melody: [
    'Oh-oh, dis-moi si tu restes',
    'Toute la nuit on danse sans promesse',
    'Laisse-moi briller encore un peu',
    'Sous les lumières on devient deux',
    'Et si demain n\'existait pas',
    'Je tomberais encore dans tes bras',
  ],
  spoken: [
    'Écoute. Le silence aussi raconte une histoire.',
    'Il y a des nuits qui valent plus que des années.',
    'Ce son, c\'est pour ceux qui n\'ont jamais lâché.',
  ],
};

export function generateLyrics({ theme = '', style = 'trap', sections = [], language = 'fr', existing = '' } = {}) {
  const pasted = String(existing || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (pasted.length && sections.length) {
    // Placement sans IA : lignes réparties selon la longueur des sections, plus de lignes là où le débit est rapide
    const weight = (s) => s.bars * (FLOW_MODES.find((f) => f.id === s.flow)?.syllablesPerBeat || 2);
    const total = sections.reduce((a, s) => a + weight(s), 0);
    let i = 0;
    return {
      title: theme || 'Sans titre', language, source: 'local',
      sections: sections.map((s, k) => {
        const n = k === sections.length - 1 ? pasted.length - i : Math.max(1, Math.round((weight(s) / total) * pasted.length));
        const lines = pasted.slice(i, i + n);
        i += n;
        return { sectionId: s.id, type: s.type, flow: s.flow, lines, punchlines: [] };
      }),
    };
  }
  const rand = seededRandom(hashString(theme + style + sections.map((s) => s.type + s.flow).join()));
  const secs = sections.length ? sections : [
    { id: 'sec_0', type: 'intro', flow: 'spoken', bars: 4 },
    { id: 'sec_1', type: 'couplet', flow: 'rap_fast', bars: 16 },
    { id: 'sec_2', type: 'refrain', flow: 'sung_slow', bars: 8 },
  ];
  const themeLine = theme ? `${theme.charAt(0).toUpperCase()}${theme.slice(1)}, c'est tout ce que j'ai en tête` : null;
  return {
    title: theme ? theme.slice(0, 40) : 'Sans titre',
    language,
    sections: secs.map((s) => {
      const flow = FLOW_MODES.find((f) => f.id === s.flow) || FLOW_MODES[2];
      const linesCount = s.type === 'intro' || s.type === 'outro' ? 2 : Math.max(2, Math.round((s.bars || 8) / 2));
      const bank = flow.id.startsWith('sung') ? LYRIC_BANK.melody
        : flow.id === 'spoken' ? LYRIC_BANK.spoken
          : flow.id === 'rap_fast' || flow.id === 'rap_ultra' ? [...LYRIC_BANK.punch, ...LYRIC_BANK.flow] : LYRIC_BANK.flow;
      const pool = [...bank].sort(() => rand() - 0.5);
      const lines = [];
      for (let i = 0; i < linesCount; i++) {
        if (i === 0 && themeLine && s.type === 'refrain') lines.push(themeLine);
        else lines.push(pool[i % pool.length]);
      }
      return { sectionId: s.id, type: s.type, flow: flow.id, lines, punchlines: flow.syllablesPerBeat >= 3 ? [lines[lines.length - 1]] : [] };
    }),
    source: 'local',
  };
}

// ---------- Analyse de références ----------

// "eb" -> "D#", "f#" -> "F#" : le catalogue n'utilise que des dièses.
export function normalizeKeyName(raw = '') {
  const m = String(raw).trim().match(/^([a-gA-G])([#b]?)/);
  if (!m) return null;
  let idx = KEYS.indexOf(m[1].toUpperCase());
  if (m[2] === '#') idx += 1;
  if (m[2] === 'b') idx -= 1;
  return KEYS[(idx + 12) % 12];
}

export function analyzeReferenceHeuristic({ title = '', description = '', tags = [], channel = '', durationSec = 0 }) {
  const text = `${title} ${description} ${tags.join(' ')} ${channel}`.toLowerCase();
  const rand = seededRandom(hashString(title + channel));
  const hint = ARTIST_HINTS.find(([re]) => re.test(text))?.[1];
  const byName = STYLES.find((s) => text.includes(s.label.toLowerCase()) || new RegExp(`\\b${s.id}\\b`).test(text));
  const styleId = hint?.style || byName?.id || 'trap';
  const prof = profileFor(styleId);
  const style = styleById(styleId);
  const bpmInText = text.match(/(\d{2,3})\s?bpm/);
  const bpm = bpmInText ? Number(bpmInText[1]) : hint?.bpm || Math.round(prof.bpm[0] + rand() * (prof.bpm[1] - prof.bpm[0]));
  const keyInText = text.match(/\b([a-g](?:#|b)?)\s?(min|minor|maj|major|m)\b/i);
  const key = keyInText ? normalizeKeyName(keyInText[1]) : null;
  const scale = keyInText ? (/maj/i.test(keyInText[2]) ? 'major' : 'minor') : prof.scales[0];
  const mood = MOODS.find((m) => text.includes(m)) || style.mood.split(',')[0];
  return {
    style: styleId,
    bpm,
    key: key && KEYS.includes(key) ? key : null,
    scale,
    drumPattern: prof.drums,
    instruments: hint?.instruments || prof.instruments,
    traits: [prof.signature],
    flow: prof.halfTime ? 'Flow rapide en triolets sur une base half-time' : 'Flow posé, calé sur le groove',
    vibe: style.mood,
    mood,
    structure: durationSec > 150 ? 'Intro – Couplet – Refrain – Couplet – Refrain – Outro' : 'Intro – Couplet – Refrain – Outro',
    energy: prof.halfTime ? 0.8 : 0.6,
    confidence: bpmInText ? 0.75 : hint ? 0.6 : 0.35,
    source: 'heuristic',
  };
}
