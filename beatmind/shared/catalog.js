// Catalogue partagé client/serveur : styles, instruments, presets vocaux, modes de débit.
// Toute la logique "musicale" par défaut part d'ici, pour que l'IA, le moteur audio
// et l'interface parlent exactement le même langage.

export const STYLES = [
  { id: 'trap', label: 'Trap', bpm: [130, 150], halfTime: true, scale: 'minor', drums: 'trap', mood: 'sombre, lourd', backs: 'trap', hint: 'Hi-hats rapides, 808 qui glissent, snare sur le 3' },
  { id: 'drill', label: 'Drill', bpm: [138, 145], halfTime: true, scale: 'minor', drums: 'drill', mood: 'froid, menaçant', backs: 'drill', hint: 'Snares décalées, 808 glissées, mélodies sombres' },
  { id: 'jazz', label: 'Jazz', bpm: [80, 120], scale: 'dorian', drums: 'swing', mood: 'chaud, élégant', backs: 'jazz', hint: 'Accords enrichis (7e, 9e), swing, contrebasse' },
  { id: 'house', label: 'House', bpm: [120, 126], scale: 'minor', drums: 'four', mood: 'dansant, lumineux', backs: 'house', hint: 'Kick sur chaque temps, open hats, accords stabs' },
  { id: 'opium', label: 'Opium', bpm: [150, 170], halfTime: true, scale: 'minor', drums: 'rage', mood: 'vampire, saturé', backs: 'trap', hint: 'Synthés distordus, 808 énormes, vibe Opium label' },
  { id: 'afro', label: 'Afro', bpm: [100, 112], scale: 'major', drums: 'afro', mood: 'solaire, groovy', backs: 'afro', hint: 'Percus syncopées, guitares, groove chaloupé' },
  { id: 'boombap', label: 'Boom bap', bpm: [86, 96], scale: 'minor', drums: 'boombap', mood: 'old school, brut', backs: 'boombap', hint: 'Kick/snare lourds, samples soul, swing 90s' },
  { id: 'phonk', label: 'Phonk', bpm: [130, 145], halfTime: true, scale: 'phrygian', drums: 'phonk', mood: 'dark, drift', backs: 'phonk', hint: 'Cowbell, 808 saturée, samples Memphis' },
  { id: 'hyperpop', label: 'Hyperpop', bpm: [150, 175], scale: 'major', drums: 'hyperpop', mood: 'euphorique, glitch', backs: 'house', hint: 'Synthés brillants, voix pitchées, énergie max' },
  { id: 'reggaeton', label: 'Reggaeton', bpm: [88, 98], scale: 'minor', drums: 'dembow', mood: 'chaud, sensuel', backs: 'afro', hint: 'Rythme dembow (boom-ch-boom-chick)' },
  { id: 'rnb', label: 'R&B', bpm: [65, 85], scale: 'minor', drums: 'rnb', mood: 'intime, smooth', backs: 'jazz', hint: 'Accords riches, groove posé, basses rondes' },
  { id: 'cloudrap', label: 'Cloud rap', bpm: [130, 150], halfTime: true, scale: 'major', drums: 'trap', mood: 'planant, rêveur', backs: 'cloud', hint: 'Pads aériens, reverb énorme, drums légers' },
  { id: 'techno', label: 'Techno', bpm: [128, 138], scale: 'phrygian', drums: 'four', mood: 'hypnotique, industriel', backs: 'house', hint: 'Kick martelé, boucles hypnotiques, synthés acides' },
  { id: 'amapiano', label: 'Amapiano', bpm: [110, 115], scale: 'minor', drums: 'amapiano', mood: 'deep, groovy', backs: 'afro', hint: 'Log drum, shakers, piano jazzy, groove lent' },
  { id: 'rage', label: 'Rage beat', bpm: [150, 165], halfTime: true, scale: 'minor', drums: 'rage', mood: 'agressif, énergique', backs: 'trap', hint: 'Lead synthé saturé, 808 punchy, énergie brute' },
];

export const INSTRUMENTS = [
  { id: 'piano', label: 'Piano', role: 'chords', hint: 'Accords et mélodies, polyvalent' },
  { id: 'saxophone', label: 'Saxophone', role: 'lead', hint: 'Lead chaud et soufflé, très jazz/R&B' },
  { id: '808', label: '808', role: 'bass808', hint: 'Basse sub tenue qui glisse, cœur de la trap' },
  { id: 'strings', label: 'Strings', role: 'pad', hint: 'Nappe de cordes, donne de l\'ampleur' },
  { id: 'guitare', label: 'Guitare', role: 'arp', hint: 'Arpèges pincés, chaleur acoustique' },
  { id: 'flute', label: 'Flûte', role: 'lead', hint: 'Mélodie aérienne, très drill/trap' },
  { id: 'violon', label: 'Violon', role: 'lead', hint: 'Lead expressif et dramatique' },
  { id: 'synthe', label: 'Synthé', role: 'lead', hint: 'Lead électronique, du doux au saturé' },
  { id: 'basse', label: 'Basse', role: 'bass', hint: 'Ligne de basse rythmique' },
  { id: 'perc', label: 'Perc', role: 'drums', hint: 'Batterie : kick, snare, hats, percus' },
  { id: 'pad', label: 'Pad', role: 'pad', hint: 'Fond sonore doux et continu' },
  { id: 'choir', label: 'Choir', role: 'pad', hint: 'Chœurs "aah", épique ou sombre' },
];

// Comment le moteur synthétise un instrument tapé manuellement : on devine le timbre le plus proche.
export function guessInstrumentRole(name = '') {
  const n = name.toLowerCase();
  if (/(bell|cloche|kalimba|marimba|xylo|harp|harpe|pluck|koto)/.test(n)) return { synth: 'bell', role: 'arp' };
  if (/(organ|orgue|rhodes|keys|clavier|wurli)/.test(n)) return { synth: 'keys', role: 'chords' };
  if (/(trompette|trumpet|brass|cuivre|horn|trombone)/.test(n)) return { synth: 'brass', role: 'lead' };
  if (/(cello|violoncelle|viola|alto)/.test(n)) return { synth: 'strings', role: 'pad' };
  if (/(drum|batterie|tambour|conga|bongo|djembe|cowbell|shaker|tabla)/.test(n)) return { synth: 'perc', role: 'drums' };
  if (/(bass|basse|sub)/.test(n)) return { synth: 'bass', role: 'bass' };
  if (/(voice|vox|voix|vocal)/.test(n)) return { synth: 'choir', role: 'pad' };
  return { synth: 'synth', role: 'lead' };
}

export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const SCALES = {
  major: { label: 'Majeur', steps: [0, 2, 4, 5, 7, 9, 11], hint: 'Lumineux, joyeux' },
  minor: { label: 'Mineur', steps: [0, 2, 3, 5, 7, 8, 10], hint: 'Sombre, émotionnel' },
  dorian: { label: 'Dorien', steps: [0, 2, 3, 5, 7, 9, 10], hint: 'Mineur jazzy, plus doux' },
  phrygian: { label: 'Phrygien', steps: [0, 1, 3, 5, 7, 8, 10], hint: 'Oriental, menaçant' },
  harmonicMinor: { label: 'Mineur harmonique', steps: [0, 2, 3, 5, 7, 8, 11], hint: 'Dramatique, "drill"' },
};

export const SECTION_TYPES = [
  { id: 'intro', label: 'Intro', defaultBars: 4 },
  { id: 'couplet', label: 'Couplet', defaultBars: 16 },
  { id: 'refrain', label: 'Refrain', defaultBars: 8 },
  { id: 'pont', label: 'Pont', defaultBars: 8 },
  { id: 'outro', label: 'Outro', defaultBars: 4 },
];

export const FLOW_MODES = [
  { id: 'sung_slow', label: 'Chanté lent', syllablesPerBeat: 1, hint: 'Notes tenues, mélodie émotionnelle' },
  { id: 'sung_fast', label: 'Chanté rapide', syllablesPerBeat: 2, hint: 'Mélodie rythmée, plus de mots' },
  { id: 'rap_laid', label: 'Rap posé', syllablesPerBeat: 2, hint: 'Flow calme, chaque mot compte' },
  { id: 'rap_fast', label: 'Rap rapide', syllablesPerBeat: 3, hint: 'Flow serré, idéal pour les punchlines' },
  { id: 'rap_ultra', label: 'Rap ultra rapide', syllablesPerBeat: 4, hint: 'Débit de fou, syllabe par syllabe' },
  { id: 'spoken', label: 'Spoken word', syllablesPerBeat: 1.5, hint: 'Parlé, posé, sans mélodie' },
];

export const VOICE_PRESETS = [
  { id: 'grave_sature', label: 'Grave saturé', hint: 'Voix basse, épaisse, distordue — vibe rage/opium',
    settings: { pitch: -4, autotune: 55, saturation: 70, reverb: 30, backs: true, harmonies: 1, energy: 85, timbre: 25 } },
  { id: 'melodique_aigu', label: 'Mélodique aigu', hint: 'Voix haute, fluide, émotionnelle — vibe Don Toliver',
    settings: { pitch: 3, autotune: 70, saturation: 10, reverb: 55, backs: true, harmonies: 2, energy: 60, timbre: 70 } },
  { id: 'drill_froid', label: 'Drill froid', hint: 'Voix plate, peu d\'autotune, rythmique — vibe UK drill',
    settings: { pitch: -1, autotune: 10, saturation: 25, reverb: 15, backs: true, harmonies: 0, energy: 75, timbre: 40 } },
  { id: 'cloud_doux', label: 'Cloud doux', hint: 'Voix aérienne, réverbérée, planante',
    settings: { pitch: 1, autotune: 45, saturation: 5, reverb: 85, backs: true, harmonies: 2, energy: 35, timbre: 65 } },
  { id: 'autotune_max', label: 'Autotune maximal', hint: 'Pitch shifté, robotique, mélodique — vibe Yeat',
    settings: { pitch: 2, autotune: 100, saturation: 35, reverb: 40, backs: true, harmonies: 1, energy: 80, timbre: 55 } },
  { id: 'jazz_chaud', label: 'Jazz chaud', hint: 'Voix naturelle, chaude, vibrato léger, zéro autotune',
    settings: { pitch: 0, autotune: 0, saturation: 8, reverb: 35, backs: true, harmonies: 2, energy: 45, timbre: 45 } },
  { id: 'afro_melodic', label: 'Afro melodic', hint: 'Voix rythmée, chantée, ensoleillée, backs call & response',
    settings: { pitch: 1, autotune: 50, saturation: 10, reverb: 40, backs: true, harmonies: 2, energy: 65, timbre: 60 } },
  { id: 'phonk_dark', label: 'Phonk dark', hint: 'Voix grave, chœurs saturés, lo-fi',
    settings: { pitch: -5, autotune: 20, saturation: 60, reverb: 45, backs: true, harmonies: 2, energy: 70, timbre: 20 } },
  { id: 'house_choeurs', label: 'House chœurs', hint: 'Voix chantée aiguë, backs en harmonies larges empilées sur les drops',
    settings: { pitch: 4, autotune: 35, saturation: 5, reverb: 65, backs: true, harmonies: 3, energy: 70, timbre: 75 } },
  { id: 'vocoder', label: 'Vocoder', hint: 'Voix transformée en instrument électronique',
    settings: { pitch: 0, autotune: 100, saturation: 40, reverb: 50, backs: false, harmonies: 3, energy: 60, timbre: 50 } },
];

// Backs automatiques : comment l'IA et le moteur doublent la voix principale selon le genre.
export const BACKS_BY_GENRE = {
  trap: { label: 'Backs courts saturés', hint: 'Fins de phrases doublées, ad-libs saturés ("yeah", "skrrt")' },
  house: { label: 'Chœurs larges sur les drops', hint: 'Harmonies empilées très larges, uniquement sur les drops' },
  jazz: { label: 'Contre-chant doux', hint: 'Harmonies douces qui répondent à la mélodie' },
  afro: { label: 'Call & response', hint: 'Réponses vocales rythmées entre les phrases' },
  drill: { label: 'Backs graves secs', hint: 'Doublages graves et secs sur les punchlines' },
  boombap: { label: 'Doublage des fins de rimes', hint: 'Les rimes clés doublées, à l\'ancienne' },
  phonk: { label: 'Chœurs saturés lo-fi', hint: 'Chœurs graves et sales en arrière-plan' },
  cloud: { label: 'Écho aérien', hint: 'Doublages lointains noyés dans la reverb' },
};

export const VOICE_PARAMS = [
  { key: 'pitch', label: 'Pitch', min: -12, max: 12, step: 1, unit: 'demi-tons', hint: 'Plus grave (−) ou plus aigu (+) que ta voix' },
  { key: 'autotune', label: 'Autotune', min: 0, max: 100, step: 1, unit: '%', hint: '0 = naturel, 100 = effet robot à la Yeat' },
  { key: 'saturation', label: 'Saturation', min: 0, max: 100, step: 1, unit: '%', hint: 'Grain, distorsion, agressivité' },
  { key: 'reverb', label: 'Reverb', min: 0, max: 100, step: 1, unit: '%', hint: 'Espace autour de la voix : sec ou planant' },
  { key: 'harmonies', label: 'Harmonies', min: 0, max: 3, step: 1, unit: 'voix', hint: 'Voix empilées au-dessus de la principale' },
  { key: 'energy', label: 'Énergie', min: 0, max: 100, step: 1, unit: '%', hint: 'Intensité de l\'interprétation' },
  { key: 'timbre', label: 'Timbre', min: 0, max: 100, step: 1, unit: '%', hint: 'Couleur : sombre (0) à brillant (100)' },
];

export const MOODS = ['sombre', 'mélancolique', 'énergique', 'chill', 'agressif', 'euphorique', 'romantique', 'planant', 'mystérieux', 'solaire'];

export const CREDIT_COSTS = { beat: 5, analyze: 1, lyrics: 2, voiceClone: 10, voiceSynth: 3 };
export const STARTING_CREDITS = 100;

export const CC_LICENSE = {
  id: 'CC0-1.0',
  label: 'Creative Commons CC0 — Domaine public',
  url: 'https://creativecommons.org/publicdomain/zero/1.0/deed.fr',
  hint: 'Libre de droits : utilisation, modification et monétisation sans crédit obligatoire.',
};

export const styleById = (id) => STYLES.find((s) => s.id === id);
export const instrumentById = (id) => INSTRUMENTS.find((i) => i.id === id);
export const presetById = (id) => VOICE_PRESETS.find((p) => p.id === id);
export const flowById = (id) => FLOW_MODES.find((f) => f.id === id);
