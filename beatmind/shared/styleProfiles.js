// Fiches de production par style : la « vérité » musicale que Claude DOIT respecter
// et que le moteur local applique quand Claude n'est pas disponible.
//
// bpm       plage autorisée (BPM réel du métronome, pas la sensation half-time)
// drums     identifiant de motif de batterie (voir DRUM_PATTERN_IDS)
// bass      808glide | 808 | walking | offbeat | root | log | dembow | reese
// chords    sustain | stabs | comp | pluck | arp | halfbar
// lead      timbre de mélodie par défaut (synthé du moteur)

export const DRUM_PATTERN_IDS = ['trap', 'drill', 'four', 'boombap', 'swing', 'afro', 'dembow', 'rnb', 'phonk', 'hyperpop', 'amapiano', 'rage'];
export const BASS_STYLES = ['808glide', '808', 'walking', 'offbeat', 'root', 'log', 'dembow', 'reese'];
export const CHORD_STYLES = ['sustain', 'stabs', 'comp', 'pluck', 'arp', 'halfbar'];

export const STYLE_PROFILES = {
  trap: {
    bpm: [130, 150], halfTime: true, drums: 'trap', swing: 0, hatRolls: 0.7, density: 0.8,
    scales: ['minor', 'harmonicMinor'], bass: '808', chords: 'arp', lead: 'bell',
    instruments: ['808', 'perc', 'piano', 'synthe'],
    progressions: [[0, 5, 2, 6], [0, 0, 5, 6], [0, 3, 5, 4]],
    signature: 'Hi-hats en doubles/triples croches avec rolls, snare (ou clap) uniquement sur le 3e temps (half-time), kick syncopé calé sur une 808 longue et saturée, mélodie sombre en boucle de 2 mesures (piano, cloches, synthé)',
    avoid: 'pas de kick sur chaque temps, pas de swing jazz, pas de walking bass',
    artists: 'Metro Boomin, Southside, Travis Scott, Future',
  },
  drill: {
    bpm: [138, 146], halfTime: true, drums: 'drill', swing: 0, hatRolls: 0.5, density: 0.75,
    scales: ['harmonicMinor', 'minor', 'phrygian'], bass: '808glide', chords: 'halfbar', lead: 'flute',
    instruments: ['808', 'perc', 'strings', 'flute'],
    progressions: [[0, 5, 4, 0], [0, 1, 0, 6], [0, 5, 1, 4]],
    signature: 'Snares décalées (3e temps + contretemps), hi-hats en triolets sautillants, 808 qui GLISSENT entre les notes (slides), mélodie mineure harmonique sombre (cordes, flûte, piano), ambiance froide et menaçante',
    avoid: 'pas de groove funk, pas de majeur joyeux, pas de four-on-the-floor',
    artists: 'Central Cee, Pop Smoke, Headie One, 808Melo, AXL Beats',
  },
  jazz: {
    bpm: [80, 125], halfTime: false, drums: 'swing', swing: 0.3, hatRolls: 0, density: 0.55,
    scales: ['dorian', 'major', 'minor'], bass: 'walking', chords: 'comp', lead: 'sax',
    instruments: ['piano', 'basse', 'perc', 'saxophone'],
    progressions: [[1, 4, 0, 0], [0, 5, 1, 4], [2, 5, 1, 4]],
    signature: 'Swing marqué (croches ternaires), ride et rimshot feutrés, contrebasse en walking bass (une note par temps), accords enrichis (7e, 9e) joués en comping syncopé au piano/Rhodes, progression II-V-I',
    avoid: 'pas de 808, pas de hi-hats rapides, pas de distorsion',
    artists: 'Robert Glasper, Nujabes, Bill Evans, BadBadNotGood',
  },
  house: {
    bpm: [120, 128], halfTime: false, drums: 'four', swing: 0.06, hatRolls: 0, density: 0.75,
    scales: ['minor', 'dorian', 'major'], bass: 'offbeat', chords: 'stabs', lead: 'synth',
    instruments: ['perc', 'basse', 'piano', 'pad'],
    progressions: [[0, 5, 3, 4], [0, 6, 5, 6], [0, 3, 0, 4]],
    signature: 'Kick sur chaque temps (four-on-the-floor), clap sur 2 et 4, open hat sur les contretemps, basse sur les contretemps, stabs d\'accords de piano/orgue, drops avec chœurs ou pads larges',
    avoid: 'pas de half-time, pas de 808 glissées, pas de snare sur le 3',
    artists: 'Kaytranada, Disclosure, Fred again.., Purple Disco Machine',
  },
  opium: {
    bpm: [150, 170], halfTime: true, drums: 'rage', swing: 0, hatRolls: 0.4, density: 0.85,
    scales: ['minor', 'phrygian'], bass: '808', chords: 'sustain', lead: 'synth',
    instruments: ['808', 'perc', 'synthe', 'pad'],
    progressions: [[0, 0, 5, 5], [0, 1, 0, 6], [0, 5, 0, 6]],
    signature: 'Synthés saturés et distordus très en avant, 808 énormes et saturées, ambiance vampire/gothique, peu d\'accords (boucle de 1-2 notes), énergie brute et répétitive',
    avoid: 'pas d\'accords jazzy, pas de guitare acoustique, pas de swing',
    artists: 'Playboi Carti, Ken Carson, Destroy Lonely, F1lthy',
  },
  afro: {
    bpm: [98, 112], halfTime: false, drums: 'afro', swing: 0.12, hatRolls: 0, density: 0.7,
    scales: ['major', 'minor', 'dorian'], bass: 'root', chords: 'pluck', lead: 'guitar',
    instruments: ['perc', 'guitare', 'basse', 'synthe'],
    progressions: [[0, 3, 4, 0], [0, 5, 3, 4], [5, 3, 0, 4]],
    signature: 'Percussions syncopées (rim, shaker en doubles croches, congas), groove chaloupé légèrement swingué, guitare pincée en motifs répétés, basse ronde et chantante, accords lumineux',
    avoid: 'pas de hi-hats trap, pas de distorsion, pas de half-time',
    artists: 'Burna Boy, Wizkid, Rema, Tems, P2J',
  },
  boombap: {
    bpm: [84, 96], halfTime: false, drums: 'boombap', swing: 0.18, hatRolls: 0, density: 0.6,
    scales: ['minor', 'dorian'], bass: 'root', chords: 'comp', lead: 'keys',
    instruments: ['perc', 'piano', 'basse', 'strings'],
    progressions: [[0, 3, 0, 4], [0, 5, 3, 4], [1, 4, 0, 0]],
    signature: 'Kick et snare lourds sur 2 et 4, hi-hats en croches swinguées, boucle de sample soul (piano, cordes, Rhodes), basse simple sur la fondamentale, grain vinyle, années 90',
    avoid: 'pas de 808 glissées, pas de rolls de hats, pas de synthés modernes',
    artists: 'J Dilla, DJ Premier, Pete Rock, Madlib',
  },
  phonk: {
    bpm: [130, 145], halfTime: true, drums: 'phonk', swing: 0, hatRolls: 0.3, density: 0.85,
    scales: ['phrygian', 'minor'], bass: '808', chords: 'halfbar', lead: 'bell',
    instruments: ['808', 'perc', 'choir', 'synthe'],
    progressions: [[0, 1, 0, 1], [0, 0, 1, 6], [0, 5, 1, 0]],
    signature: 'Cowbell mélodique en avant, 808 saturée, hi-hats en doubles croches, chœurs et samples Memphis sombres, ambiance drift/nuit',
    avoid: 'pas d\'accords majeurs joyeux, pas de swing jazz',
    artists: 'Kordhell, DVRST, MoonDeity, Pharmacist',
  },
  hyperpop: {
    bpm: [150, 175], halfTime: false, drums: 'hyperpop', swing: 0, hatRolls: 0.5, density: 0.9,
    scales: ['major', 'minor'], bass: 'reese', chords: 'arp', lead: 'synth',
    instruments: ['perc', 'synthe', '808', 'pad'],
    progressions: [[0, 4, 5, 3], [3, 4, 0, 5], [0, 5, 3, 4]],
    signature: 'Synthés brillants et saturés, arpèges rapides, drums compressés et agressifs, énergie maximale, effets glitch, accords pop',
    avoid: 'pas de groove lent, pas de jazz',
    artists: '100 gecs, A. G. Cook, Charli XCX, glaive',
  },
  reggaeton: {
    bpm: [88, 100], halfTime: false, drums: 'dembow', swing: 0, hatRolls: 0, density: 0.7,
    scales: ['minor', 'major'], bass: 'dembow', chords: 'stabs', lead: 'synth',
    instruments: ['perc', '808', 'synthe', 'guitare'],
    progressions: [[0, 5, 2, 6], [0, 3, 4, 3], [5, 3, 0, 4]],
    signature: 'Rythme dembow (boom-ch-boom-chick : kick sur chaque temps, snare sur le 4e double-croche de chaque temps), basse qui suit le kick, stabs de synthé, ambiance chaude et sensuelle',
    avoid: 'pas de half-time trap, pas de swing',
    artists: 'Bad Bunny, Tainy, J Balvin, Karol G',
  },
  rnb: {
    bpm: [64, 88], halfTime: false, drums: 'rnb', swing: 0.1, hatRolls: 0.2, density: 0.55,
    scales: ['minor', 'dorian', 'major'], bass: 'root', chords: 'sustain', lead: 'keys',
    instruments: ['piano', 'basse', 'perc', 'pad'],
    progressions: [[1, 4, 0, 5], [0, 5, 3, 4], [3, 2, 1, 4]],
    signature: 'Groove posé et sensuel, accords riches tenus (7e, 9e) au Rhodes/pads, basse ronde, snare/clap douce sur 2 et 4, beaucoup d\'espace pour la voix',
    avoid: 'pas de hats agressifs, pas de distorsion',
    artists: 'Frank Ocean, SZA, Brent Faiyaz, Daniel Caesar',
  },
  cloudrap: {
    bpm: [130, 150], halfTime: true, drums: 'trap', swing: 0, hatRolls: 0.35, density: 0.55,
    scales: ['major', 'dorian', 'minor'], bass: '808', chords: 'sustain', lead: 'pad',
    instruments: ['pad', '808', 'perc', 'piano'],
    progressions: [[0, 3, 5, 4], [0, 5, 3, 0], [3, 0, 4, 5]],
    signature: 'Pads aériens noyés dans la reverb, ambiance rêveuse et planante, drums trap légers et espacés, 808 douce, mélodies vaporeuses',
    avoid: 'pas de saturation agressive, pas de drums chargés',
    artists: 'Yung Lean, Clams Casino, A$AP Rocky (période cloud), Bladee',
  },
  techno: {
    bpm: [128, 140], halfTime: false, drums: 'four', swing: 0, hatRolls: 0, density: 0.85,
    scales: ['phrygian', 'minor'], bass: 'offbeat', chords: 'halfbar', lead: 'synth',
    instruments: ['perc', 'basse', 'synthe', 'pad'],
    progressions: [[0, 0, 0, 1], [0, 0, 6, 0], [0, 1, 0, 0]],
    signature: 'Kick martelé sur chaque temps, hats hypnotiques sur les contretemps, basse rolling, synthés acides en boucle, très peu de changements d\'accords, atmosphère industrielle',
    avoid: 'pas de half-time, pas d\'accords pop, pas de swing',
    artists: 'Amelie Lens, Charlotte de Witte, Adam Beyer',
  },
  amapiano: {
    bpm: [108, 116], halfTime: false, drums: 'amapiano', swing: 0.12, hatRolls: 0, density: 0.65,
    scales: ['minor', 'dorian'], bass: 'log', chords: 'comp', lead: 'keys',
    instruments: ['perc', 'basse', 'piano', 'pad'],
    progressions: [[0, 3, 4, 0], [1, 4, 0, 5], [0, 5, 3, 4]],
    signature: 'Log drum (basse percussive et mélodique), shakers en doubles croches, piano jazzy en comping, groove lent et hypnotique, kick doux sur chaque temps',
    avoid: 'pas de 808 trap, pas de hats rapides avec rolls',
    artists: 'Kabza De Small, DJ Maphorisa, Uncle Waffles, Focalistic',
  },
  rage: {
    bpm: [150, 165], halfTime: true, drums: 'rage', swing: 0, hatRolls: 0.5, density: 0.9,
    scales: ['minor', 'phrygian'], bass: '808', chords: 'arp', lead: 'synth',
    instruments: ['808', 'perc', 'synthe', 'pad'],
    progressions: [[0, 5, 0, 6], [0, 0, 1, 0], [0, 6, 5, 6]],
    signature: 'Lead synthé saturé et brillant en arpèges, 808 punchy et distordue, énergie de concert, drums agressifs',
    avoid: 'pas d\'instruments acoustiques doux, pas de swing',
    artists: 'Trippie Redd, Yeat, Lil Uzi Vert, Ken Carson',
  },
};

export const profileFor = (id) => STYLE_PROFILES[id] || STYLE_PROFILES.trap;

// Synonymes que Claude ou l'utilisateur peuvent employer pour les instruments
export const INSTRUMENT_ALIASES = {
  '808': ['808', '808 bass', 'sub', 'sub bass', 'basse 808'],
  perc: ['perc', 'percs', 'percussions', 'drums', 'batterie', 'drum', 'kick', 'snare', 'hats', 'hi-hat', 'hihat', 'log drum'],
  piano: ['piano', 'grand piano', 'keys', 'piano électrique'],
  basse: ['basse', 'bass', 'bassline', 'contrebasse', 'upright bass', 'walking bass', 'bass guitar'],
  synthe: ['synthe', 'synthé', 'synth', 'lead', 'lead synth', 'synthesizer', 'arp'],
  strings: ['strings', 'cordes', 'string ensemble', 'orchestra'],
  guitare: ['guitare', 'guitar', 'acoustic guitar', 'electric guitar'],
  flute: ['flute', 'flûte'],
  violon: ['violon', 'violin'],
  saxophone: ['saxophone', 'sax'],
  pad: ['pad', 'pads', 'nappe', 'atmosphere'],
  choir: ['choir', 'chœur', 'choeur', 'chœurs', 'choeurs', 'vocal pad', 'voices'],
};

export function canonicalInstrument(name = '') {
  const n = String(name).toLowerCase().trim();
  for (const [id, words] of Object.entries(INSTRUMENT_ALIASES)) {
    if (words.includes(n)) return id;
  }
  for (const [id, words] of Object.entries(INSTRUMENT_ALIASES)) {
    if (words.some((w) => w.length > 3 && n.includes(w))) return id;
  }
  return n;
}

// Connaissances d'artistes pour analyser une référence YouTube même sans Claude
export const ARTIST_HINTS = [
  [/central cee|pop smoke|headie one|digga d|fivio|kay flock|uk drill|ny drill|drill/i, { style: 'drill', bpm: 142, instruments: ['808', 'perc', 'strings', 'flute'] }],
  [/playboi carti|ken carson|destroy lonely|homixide|opium/i, { style: 'opium', bpm: 160, instruments: ['808', 'perc', 'synthe'] }],
  [/yeat|trippie redd|lil uzi|rage/i, { style: 'rage', bpm: 158, instruments: ['808', 'perc', 'synthe'] }],
  [/metro boomin|travis scott|future|21 savage|southside|young thug|gunna|trap/i, { style: 'trap', bpm: 142, instruments: ['808', 'perc', 'piano', 'synthe'] }],
  [/don toliver|the weeknd|sza|frank ocean|brent faiyaz|daniel caesar|r&b|rnb/i, { style: 'rnb', bpm: 76, instruments: ['piano', 'basse', 'pad'] }],
  [/burna boy|wizkid|rema|tems|davido|asake|ayra starr|afrobeat|afro/i, { style: 'afro', bpm: 104, instruments: ['perc', 'guitare', 'basse'] }],
  [/kabza|maphorisa|uncle waffles|focalistic|amapiano/i, { style: 'amapiano', bpm: 112, instruments: ['perc', 'basse', 'piano'] }],
  [/kaytranada|disclosure|fred again|purple disco|house/i, { style: 'house', bpm: 124, instruments: ['perc', 'basse', 'piano', 'pad'] }],
  [/amelie lens|charlotte de witte|adam beyer|techno/i, { style: 'techno', bpm: 132, instruments: ['perc', 'basse', 'synthe'] }],
  [/kordhell|dvrst|moondeity|pharmacist|phonk/i, { style: 'phonk', bpm: 138, instruments: ['808', 'perc', 'choir'] }],
  [/bad bunny|tainy|j balvin|karol g|rauw|reggaeton|dembow/i, { style: 'reggaeton', bpm: 94, instruments: ['perc', '808', 'synthe'] }],
  [/j dilla|dj premier|pete rock|madlib|nas|mf doom|boom ?bap/i, { style: 'boombap', bpm: 90, instruments: ['perc', 'piano', 'basse'] }],
  [/nujabes|glasper|badbadnotgood|bill evans|lo-?fi|jazz/i, { style: 'jazz', bpm: 88, instruments: ['piano', 'basse', 'saxophone'] }],
  [/yung lean|bladee|clams casino|cloud ?rap/i, { style: 'cloudrap', bpm: 140, instruments: ['pad', '808', 'perc'] }],
  [/100 gecs|charli xcx|glaive|hyperpop/i, { style: 'hyperpop', bpm: 160, instruments: ['perc', 'synthe'] }],
];

// Ramène un BPM détecté dans la plage du style (gère les références « half-time » ou « double-time »)
export function fitBpm(bpm, [lo, hi]) {
  if (!Number.isFinite(bpm) || bpm <= 0) return null;
  for (const c of [bpm, bpm * 2, bpm / 2, bpm * 1.5, bpm / 1.5]) {
    if (c >= lo - 4 && c <= hi + 4) return Math.round(Math.min(hi, Math.max(lo, c)));
  }
  return Math.round(Math.min(hi, Math.max(lo, bpm)));
}
