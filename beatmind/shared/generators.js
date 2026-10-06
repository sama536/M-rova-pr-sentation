// Générateurs déterministes utilisés quand aucune clé API n'est configurée (mode démo)
// et pour compléter / valider les réponses de Claude. Même entrée = même sortie.
import {
  STYLES, INSTRUMENTS, KEYS, SCALES, SECTION_TYPES, FLOW_MODES, MOODS,
  styleById, instrumentById, guessInstrumentRole,
} from './catalog.js';

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

const PROGRESSIONS = {
  minor: [[0, 5, 2, 6], [0, 3, 4, 0], [0, 5, 3, 4], [0, 6, 5, 4], [0, 0, 5, 6]],
  major: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 0, 4], [5, 3, 0, 4]],
  dorian: [[0, 3, 0, 3], [0, 6, 3, 0], [1, 4, 0, 0]],
  phrygian: [[0, 1, 0, 6], [0, 1, 5, 1], [0, 0, 1, 0]],
  harmonicMinor: [[0, 5, 4, 0], [0, 3, 4, 4], [0, 5, 1, 4]],
};

const DEFAULT_SYNTH = {
  piano: 'piano', saxophone: 'sax', '808': '808', strings: 'strings', guitare: 'guitar',
  flute: 'flute', violon: 'violin', synthe: 'synth', basse: 'bass', perc: 'drums', pad: 'pad', choir: 'choir',
};

const STYLE_DEFAULT_INSTRUMENTS = {
  trap: ['808', 'perc', 'piano', 'synthe'], drill: ['808', 'perc', 'flute', 'strings'],
  jazz: ['piano', 'basse', 'perc', 'saxophone'], house: ['perc', 'piano', 'basse', 'pad'],
  opium: ['808', 'perc', 'synthe', 'pad'], afro: ['perc', 'guitare', 'basse', 'synthe'],
  boombap: ['perc', 'piano', 'basse', 'strings'], phonk: ['808', 'perc', 'synthe', 'choir'],
  hyperpop: ['perc', 'synthe', '808', 'pad'], reggaeton: ['perc', '808', 'synthe', 'guitare'],
  rnb: ['piano', 'basse', 'perc', 'pad'], cloudrap: ['pad', '808', 'perc', 'piano'],
  techno: ['perc', 'basse', 'synthe', 'pad'], amapiano: ['perc', 'basse', 'piano', 'pad'],
  rage: ['808', 'perc', 'synthe', 'pad'],
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
    ...extra,
  };
}

export function generateBeatParams({ prompt = '', styles = [], instruments = [], references = [] } = {}) {
  const rand = seededRandom(hashString(prompt + styles.join() + instruments.join()));
  const styleObjs = (styles.length ? styles : ['trap']).map(styleById).filter(Boolean);
  const main = styleObjs[0] || STYLES[0];

  const refBpms = references.map((r) => r.bpm).filter((b) => Number.isFinite(b));
  let bpm;
  if (refBpms.length) bpm = Math.round(refBpms.reduce((a, b) => a + b, 0) / refBpms.length);
  else {
    const lo = Math.round(styleObjs.reduce((a, s) => a + s.bpm[0], 0) / styleObjs.length);
    const hi = Math.round(styleObjs.reduce((a, s) => a + s.bpm[1], 0) / styleObjs.length);
    bpm = Math.round(lo + rand() * (hi - lo));
  }
  const p = prompt.toLowerCase();
  if (/(lent|slow|calme|chill)/.test(p)) bpm = Math.round(bpm * 0.92);
  if (/(rapide|fast|énerg|energ|hard)/.test(p)) bpm = Math.round(bpm * 1.05);

  let scale = main.scale;
  if (/(joyeux|happy|solaire|lumineux|summer|été)/.test(p)) scale = 'major';
  if (/(sombre|dark|triste|sad|menaç)/.test(p) && scale === 'major') scale = 'minor';
  if (main.id === 'drill' && rand() > 0.5) scale = 'harmonicMinor';
  const refKey = references.find((r) => r.key)?.key;
  const key = refKey && KEYS.includes(refKey) ? refKey : pick(rand, KEYS);

  const template = ['house', 'techno', 'amapiano', 'hyperpop'].includes(main.id) ? STRUCTURE_TEMPLATES.dance
    : /(court|short|snippet)/.test(p) ? STRUCTURE_TEMPLATES.short : STRUCTURE_TEMPLATES.default;
  const structure = template.map(([type, bars, energy], i) => ({
    id: `sec_${i}`, type, label: SECTION_TYPES.find((s) => s.id === type).label, bars, energy,
  }));

  const instrumentIds = Array.from(new Set([
    ...(instruments.length ? instruments : STYLE_DEFAULT_INSTRUMENTS[main.id] || ['perc', '808', 'piano']),
    ...(instruments.length && !instruments.includes('perc') ? ['perc'] : []),
  ]));
  const tracks = instrumentIds.map((id) => makeTrack(id));

  const progression = pick(rand, PROGRESSIONS[scale] || PROGRESSIONS.minor);
  const mood = references.find((r) => r.mood)?.mood || main.mood;
  const styleLabel = styleObjs.map((s) => s.label).join(' x ');

  return {
    title: titleFromPrompt(prompt, styleLabel, rand),
    description: `${styleLabel} à ${bpm} BPM en ${key} ${SCALES[scale].label.toLowerCase()}, ambiance ${mood}.`,
    bpm: clamp(bpm, 60, 200),
    key,
    scale,
    mood,
    swing: ['jazz', 'boombap', 'afro', 'amapiano'].includes(main.id) ? 0.18 : main.id === 'house' ? 0.06 : 0,
    halfTime: !!main.halfTime,
    styles: styleObjs.map((s) => s.id),
    drums: { pattern: main.drums, hatRolls: main.drums === 'trap' || main.drums === 'drill' ? 0.6 : 0.15, density: 0.7 },
    progression,
    structure,
    tracks,
    mix: {
      loudness: -9,
      warmth: 0.4,
      width: 0.6,
      notes: [
        'Laisse 3 dB de marge sous le kick pour l\'808 (sidechain léger).',
        'Coupe les basses (<120 Hz) sur tout sauf kick, 808 et basse.',
        'Les éléments mélodiques gagnent à être panoramisés légèrement (±20).',
      ],
    },
    productionNotes: [
      `Progression en degrés : ${progression.map((d) => d + 1).join(' – ')}.`,
      `Énergie qui monte jusqu'au refrain, retrait des drums sur l'intro et l'outro.`,
      main.drums === 'trap' ? 'Rolls de hi-hats en triolets sur les fins de mesures.' : 'Garde un groove constant, varie les fills toutes les 4 mesures.',
    ],
    sunoPrompt: `${styleLabel.toLowerCase()} instrumental, ${bpm} bpm, ${key} ${scale}, ${mood}, ${tracks.map((t) => t.name.toLowerCase()).join(', ')}`,
    source: 'local',
  };
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
  const out = { ...fb, ...raw };
  out.bpm = clamp(Math.round(Number(raw.bpm) || fb.bpm), 60, 200);
  out.key = normalizeKeyName(raw.key) || fb.key;
  out.scale = SCALES[raw.scale] ? raw.scale : fb.scale;
  out.swing = clamp(Number(raw.swing) || 0, 0, 0.5);
  out.progression = Array.isArray(raw.progression) && raw.progression.length >= 2
    ? raw.progression.map((d) => clamp(Math.round(Number(d)) || 0, 0, 6)).slice(0, 8) : fb.progression;
  out.structure = Array.isArray(raw.structure) && raw.structure.length
    ? raw.structure.map((s, i) => {
      const type = SECTION_TYPES.find((t) => t.id === s.type) ? s.type : 'couplet';
      return { id: `sec_${i}`, type, label: s.label || SECTION_TYPES.find((t) => t.id === type).label,
        bars: clamp(Math.round(Number(s.bars) || 8), 1, 32), energy: clamp(Number(s.energy) || 0.6, 0, 1) };
    }) : fb.structure;
  out.tracks = Array.isArray(raw.tracks) && raw.tracks.length
    ? raw.tracks.map((t) => {
      const base = makeTrack(t.instrument || t.name || 'synthe');
      return {
        ...base,
        name: t.name || base.name,
        volume: clamp(Number(t.volume ?? base.volume), 0, 1),
        pan: clamp(Number(t.pan ?? 0), -1, 1),
        octave: clamp(Math.round(Number(t.octave ?? base.octave)), 0, 7),
        fx: {
          reverb: clamp(Number(t.fx?.reverb ?? base.fx.reverb), 0, 1),
          delay: clamp(Number(t.fx?.delay ?? base.fx.delay), 0, 1),
          distortion: clamp(Number(t.fx?.distortion ?? base.fx.distortion), 0, 1),
          compressor: clamp(Number(t.fx?.compressor ?? base.fx.compressor), 0, 1),
        },
        notesHint: t.notesHint || t.role_description || '',
      };
    }) : fb.tracks;
  if (!out.tracks.some((t) => t.role === 'drums')) out.tracks.unshift(makeTrack('perc'));
  out.drums = { ...fb.drums, ...(raw.drums || {}) };
  out.mix = { ...fb.mix, ...(raw.mix || {}), notes: raw.mix?.notes?.length ? raw.mix.notes : fb.mix.notes };
  out.productionNotes = Array.isArray(raw.productionNotes) && raw.productionNotes.length ? raw.productionNotes : fb.productionNotes;
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
  const match = STYLES.find((s) => text.includes(s.label.toLowerCase()) || text.includes(s.id))
    || (/(drill|uk|ny)/.test(text) && styleById('drill'))
    || (/(opium|carti|ken carson|destroy lonely)/.test(text) && styleById('opium'))
    || (/(yeat|rage|trippie)/.test(text) && styleById('rage'))
    || (/(burna|wizkid|rema|tems|afrobeat)/.test(text) && styleById('afro'))
    || (/(lofi|lo-fi|jazz)/.test(text) && styleById('jazz'))
    || styleById('trap');
  const bpmInText = text.match(/(\d{2,3})\s?bpm/);
  const bpm = bpmInText ? Number(bpmInText[1]) : Math.round(match.bpm[0] + rand() * (match.bpm[1] - match.bpm[0]));
  const keyInText = text.match(/\b([a-g](?:#|b)?)\s?(min|minor|maj|major|m)\b/i);
  const key = keyInText ? normalizeKeyName(keyInText[1]) : null;
  const mood = MOODS.find((m) => text.includes(m)) || match.mood.split(',')[0];
  return {
    style: match.id,
    bpm,
    key: key && KEYS.includes(key) ? key : null,
    flow: match.halfTime ? 'Flow rapide en triolets sur une base half-time' : 'Flow posé, calé sur le groove',
    vibe: match.mood,
    mood,
    structure: durationSec > 150 ? 'Intro – Couplet – Refrain – Couplet – Refrain – Outro' : 'Intro – Couplet – Refrain – Outro',
    energy: match.halfTime ? 0.8 : 0.6,
    confidence: bpmInText ? 0.8 : 0.45,
    source: 'heuristic',
  };
}
