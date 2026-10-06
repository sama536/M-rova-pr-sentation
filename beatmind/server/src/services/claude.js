import Anthropic from '@anthropic-ai/sdk';
import { config, services } from '../config.js';
import { STYLES, INSTRUMENTS, FLOW_MODES, BACKS_BY_GENRE, SCALES, styleById } from '../../../shared/catalog.js';
import {
  STYLE_PROFILES, DRUM_PATTERN_IDS, BASS_STYLES, CHORD_STYLES, profileFor,
} from '../../../shared/styleProfiles.js';
import {
  generateBeatParams, normalizeBeatParams, generateLyrics, analyzeReferenceHeuristic, blendStyles, referenceTarget,
} from '../../../shared/generators.js';

// Client recréé quand la clé change (modifiable depuis l'app : bouton « Clés API »)
let client = null;
let clientKey = null;
function getClient() {
  if (!services.claude) return null;
  if (!client || clientKey !== config.anthropic.apiKey) {
    client = new Anthropic({ apiKey: config.anthropic.apiKey });
    clientKey = config.anthropic.apiKey;
  }
  return client;
}

const SYSTEM = `Tu es BeatMind, producteur et directeur artistique expert en musique urbaine et électronique.
Tu connais précisément les codes de production de chaque genre (tempo, batterie, basse, harmonie, sound design)
et le catalogue des artistes cités. Tu réponds UNIQUEMENT avec un objet JSON valide, sans texte autour,
sans bloc markdown. Les valeurs textuelles sont en français.`;

async function askJSON(prompt, { effort = 'medium', maxTokens = 8000 } = {}) {
  const response = await getClient().beta.messages.create({
    model: config.anthropic.model,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort },
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });
  if (response.stop_reason === 'refusal') {
    throw new Error('Claude a refusé cette requête. Reformule ton prompt.');
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return extractJSON(text);
}

function extractJSON(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Réponse IA illisible');
  return JSON.parse(text.slice(start, end + 1));
}

function friendlyError(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'Clé Claude refusée (invalide ou révoquée) : vérifie-la dans ⚙️ Clés API.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'Cette clé Claude n\'a pas accès au modèle demandé.';
  if (err instanceof Anthropic.RateLimitError) return 'Claude est saturé ou ton quota est atteint : réessaie dans un moment.';
  if (err instanceof Anthropic.BadRequestError && /credit|billing/i.test(err.message)) return 'Crédit Anthropic insuffisant sur ce compte.';
  if (err instanceof Anthropic.APIConnectionError) return 'Impossible de joindre Claude (connexion internet ?).';
  return `Claude indisponible (${String(err.message).slice(0, 120)}).`;
}

// Exécute Claude si configuré ; sinon (ou en cas d'erreur) bascule sur le générateur local.
async function withFallback(label, run, fallback) {
  if (!getClient()) return { data: fallback(), source: 'local' };
  try {
    return { data: await run(), source: 'claude' };
  } catch (err) {
    console.warn(`[claude] ${label} — bascule sur le générateur local :`, err.message);
    return { data: fallback(), source: 'local', warning: `${friendlyError(err)} Paramètres générés par le moteur local.` };
  }
}

// Fiche de production d'un style, telle qu'envoyée à Claude
function styleBrief(id) {
  const p = profileFor(id);
  const s = styleById(id);
  return `### ${s?.label || id}
- Tempo : ${p.bpm[0]}–${p.bpm[1]} BPM${p.halfTime ? ' (sensation half-time : snare sur le 3e temps)' : ''}
- Batterie (drums.pattern) : "${p.drums}" · rolls de hi-hats ≈ ${p.hatRolls} · densité ≈ ${p.density} · swing ≈ ${p.swing}
- Basse (arrangement.bass) : "${p.bass}" · Accords (arrangement.chords) : "${p.chords}"
- Gammes adaptées : ${p.scales.join(', ')}
- Instruments typiques : ${p.instruments.join(', ')}
- Signature sonore : ${p.signature}
- À éviter : ${p.avoid}
- Artistes de référence : ${p.artists}`;
}

function referencesBrief(references, weight) {
  if (!references?.length) return 'Aucune référence.';
  const pct = Math.round(weight * 100);
  return `Influence demandée par l'utilisateur : ${pct} % (0 = ignorer, 100 = coller au plus près des références).
${references.map((r, i) => `Référence ${i + 1} — « ${r.title} »${r.channel ? ` (${r.channel})` : ''}
  · style détecté : ${styleById(r.style)?.label || r.style || '?'} · BPM : ${r.bpm || '?'} · tonalité : ${r.key || '?'} ${r.scale || ''}
  · batterie : ${r.drumPattern || '?'} · instruments entendus : ${(r.instruments || []).join(', ') || '?'}
  · sound design / production : ${(r.traits || []).join(' ; ') || '?'}
  · ambiance : ${r.vibe || '?'} / ${r.mood || '?'} · énergie : ${r.energy ?? '?'} · structure : ${r.structure || '?'}`).join('\n')}`;
}

export async function generateBeat({ prompt, styles, instruments, references, referenceWeight = 0.7 }) {
  const weight = Math.min(1, Math.max(0, Number(referenceWeight) || 0));
  const input = { prompt, styles, instruments, references, referenceWeight: weight };
  const { data, source, warning } = await withFallback('beat', async () => {
    // Si aucun style n'est choisi, les références décident (comme le moteur local)
    const ref = referenceTarget(references, [60, 200]);
    const styleIds = styles.length ? styles : (ref?.style ? [ref.style] : []);
    const blend = blendStyles(styleIds.length ? styleIds : ['trap']);
    const [lo, hi] = blend.bpmRange;
    const target = referenceTarget(references, blend.bpmRange);
    const raw = await askJSON(`Crée les paramètres de production complets d'un beat. Respecte STRICTEMENT les contraintes.

## Demande de l'utilisateur
"""${prompt || '(pas de texte : base-toi sur les styles et les références)'}"""

## Style(s) imposé(s)${styleIds.length ? '' : ' (déduit des références, aucun choisi par l\'utilisateur)'}
${styleIds.length ? blend.ids.map(styleBrief).join('\n\n') : 'Aucun style choisi et aucune référence exploitable : choisis le style le plus adapté au prompt parmi ' + Object.keys(STYLE_PROFILES).join(', ') + '.'}
${blend.ids.length > 1 ? `\nFusion : le groove (batterie + basse) vient de « ${styleById(blend.ids[0])?.label} » ; les autres styles colorent l'harmonie, les timbres et l'ambiance.` : ''}

## Références YouTube analysées
${referencesBrief(references, weight)}
${target ? `Cible chiffrée tirée des références : BPM ≈ ${target.bpm || '?'}, tonalité ${target.key || '?'}, instruments ${target.instruments.join(', ') || '?'}.` : ''}

## Instruments
${instruments.length ? `L'utilisateur EXIGE ces instruments (tous présents dans "tracks") : ${instruments.join(', ')}. Tu peux en ajouter 1 ou 2 typiques du style.` : 'Choisis 3 à 5 instruments typiques du style (et des références).'}
Identifiants autorisés pour "instrument" : ${INSTRUMENTS.map((i) => i.id).join(', ')} (un instrument hors liste est permis s'il est demandé). La batterie est toujours "perc".

## Règles impératives
1. "bpm" DOIT être entre ${lo} et ${hi}.${target?.bpm ? ` Avec une influence de ${Math.round(weight * 100)} %, rapproche-toi de ${target.bpm}.` : ''}
2. "drums.pattern" DOIT être "${blend.main.drums}"${blend.profiles.length > 1 ? ` (ou "${[...new Set(blend.profiles.map((p) => p.drums))].join('" / "')}")` : ''}. Valeurs possibles : ${DRUM_PATTERN_IDS.join(', ')}.
3. "arrangement.bass" parmi ${BASS_STYLES.join(', ')} (attendu : "${blend.main.bass}") ; "arrangement.chords" parmi ${CHORD_STYLES.join(', ')} (attendu : "${blend.main.chords}").
4. "scale" parmi ${Object.keys(SCALES).join(', ')}, cohérente avec le style et l'ambiance demandée.
5. "progression" : 4 degrés (0 = I … 6 = VII) typiques du style.
6. Applique la signature sonore du style et respecte la liste « À éviter ».
7. Si des références sont données, explique dans "referenceNotes" ce que tu en as repris concrètement (tempo, tonalité, instruments, sound design, structure, énergie).

## Format de réponse (JSON exact)
{
  "title": "titre court et évocateur",
  "description": "1 phrase qui résume la prod et son style",
  "bpm": nombre,
  "key": "C | C# | D | D# | E | F | F# | G | G# | A | A# | B",
  "scale": "…",
  "mood": "2-3 mots",
  "swing": 0 à 0.5,
  "drums": { "pattern": "…", "hatRolls": 0-1, "density": 0-1 },
  "arrangement": { "bass": "…", "chords": "…" },
  "progression": [4 entiers 0-6],
  "structure": [{ "type": "intro|couplet|refrain|pont|outro", "label": "nom", "bars": nombre, "energy": 0-1 }],
  "tracks": [{ "instrument": "id", "volume": 0-1, "pan": -1 à 1, "octave": 1-6, "fx": { "reverb": 0-1, "delay": 0-1, "distortion": 0-1, "compressor": 0-1 }, "notesHint": "ce que joue la piste" }],
  "mix": { "loudness": LUFS négatif, "warmth": 0-1, "width": 0-1, "notes": ["3 conseils de mix concrets pour CE style"] },
  "productionNotes": ["3 à 5 notes de prod concrètes et spécifiques au style"],
  "referenceNotes": ["ce qui a été repris des références (vide s'il n'y en a pas)"],
  "sunoPrompt": "prompt en anglais pour un générateur audio : genre précis, bpm, instruments, mood, sound design, 'instrumental'"
}`, { effort: 'medium' });
    return normalizeBeatParams(raw, { ...input, styles: styleIds.length ? styleIds : blend.ids });
  }, () => generateBeatParams(input));
  return { params: { ...data, source }, warning };
}

export async function analyzeReference(meta) {
  const heuristic = analyzeReferenceHeuristic(meta);
  const { data, source } = await withFallback('reference', async () => {
    const chapters = (meta.description || '').match(/^\s*\(?\d{1,2}:\d{2}(?::\d{2})?\)?\s+.+$/gm)?.slice(0, 15).join('\n');
    const raw = await askJSON(`Analyse cette référence musicale YouTube pour qu'un producteur puisse s'en inspirer.
Identifie d'abord l'artiste et le morceau exacts à partir des métadonnées, puis utilise ce que tu SAIS de ce morceau
(tempo et tonalité connus, production, instruments, structure). Si tu ne le connais pas, déduis-le des tags,
de la description, de la chaîne et du genre de l'artiste, et baisse "confidence".

Titre : ${meta.title}
Chaîne : ${meta.channel}
Durée : ${meta.durationSec ? `${Math.floor(meta.durationSec / 60)} min ${meta.durationSec % 60} s` : 'inconnue'}
Tags : ${(meta.tags || []).slice(0, 25).join(', ') || 'aucun'}
Description : ${(meta.description || '').slice(0, 2000) || 'vide'}
${chapters ? `Chapitres :\n${chapters}` : ''}

JSON attendu :
{
  "artist": "artiste identifié ou null",
  "track": "titre du morceau ou null",
  "style": "un id parmi ${Object.keys(STYLE_PROFILES).join(', ')}",
  "bpm": nombre (tempo réel du morceau),
  "key": "C..B ou null",
  "scale": "major | minor | dorian | phrygian | harmonicMinor",
  "drumPattern": "un id parmi ${DRUM_PATTERN_IDS.join(', ')}",
  "instruments": ["ids parmi ${INSTRUMENTS.map((i) => i.id).join(', ')}"],
  "traits": ["3 à 5 caractéristiques de production concrètes : sound design, batterie, basse, effets, mix"],
  "flow": "description courte du flow vocal",
  "vibe": "2-4 mots",
  "mood": "1-2 mots",
  "structure": "ex : Intro – Couplet – Refrain – …",
  "energy": 0-1,
  "confidence": 0-1
}`, { effort: 'medium', maxTokens: 4000 });
    const bpm = Number(raw.bpm);
    return {
      ...heuristic,
      ...raw,
      style: STYLE_PROFILES[raw.style] ? raw.style : heuristic.style,
      drumPattern: DRUM_PATTERN_IDS.includes(raw.drumPattern) ? raw.drumPattern : profileFor(raw.style || heuristic.style).drums,
      bpm: bpm > 40 && bpm < 220 ? Math.round(bpm) : heuristic.bpm,
      instruments: Array.isArray(raw.instruments) && raw.instruments.length ? raw.instruments : heuristic.instruments,
      traits: Array.isArray(raw.traits) && raw.traits.length ? raw.traits : heuristic.traits,
    };
  }, () => heuristic);
  return { ...data, source: source === 'claude' ? 'claude' : data.source };
}

export async function writeLyrics({ theme, style, sections, language = 'fr', voices = 1, existing }) {
  const input = { theme, style, sections, language, existing };
  const { data, source, warning } = await withFallback('lyrics', async () => {
    const backs = BACKS_BY_GENRE[styleById(style)?.backs || style] || BACKS_BY_GENRE.trap;
    const raw = await askJSON(`Écris (ou réarrange) les paroles d'un morceau.
Thème : ${theme || 'libre'}
Style : ${styleById(style)?.label || style}
Langue : ${language === 'fr' ? 'français' : language}
Nombre de voix (feat) : ${voices}
${existing ? `Paroles existantes à placer et adapter sans changer le sens :\n"""${existing}"""` : ''}

Sections avec leur mode de débit :
${sections.map((s) => `- ${s.id} (${s.type}, ${s.bars} mesures) : ${FLOW_MODES.find((f) => f.id === s.flow)?.label || s.flow}`).join('\n')}

Règles de placement :
- Nombre de lignes ≈ mesures / 2, plus dense si le débit est rapide (rap rapide / ultra rapide : lignes longues, multisyllabiques, rimes internes).
- Mets les punchlines dans les sections à débit rapide.
- Les refrains sont mélodiques, courts, répétables, mémorables.
- Spoken word : phrases posées, imagées.
- Backs automatiques de ce genre : ${backs.label} (${backs.hint}). Écris-les entre parenthèses en fin de ligne quand c'est pertinent.
${voices > 1 ? `- Répartis les sections entre les ${voices} voix (champ "voice" : 1 à ${voices}).` : ''}

JSON attendu :
{ "title": "titre", "sections": [{ "sectionId": "id de section", "type": "...", "flow": "id du débit", "voice": 1, "lines": ["..."], "punchlines": ["lignes qui sont des punchlines"] }] }`, { effort: 'medium' });
    const fb = generateLyrics(input);
    return {
      title: raw.title || fb.title,
      language,
      sections: sections.map((s, i) => {
        const r = raw.sections?.find((x) => x.sectionId === s.id) || raw.sections?.[i];
        const f = fb.sections[i];
        return {
          sectionId: s.id, type: s.type, flow: s.flow,
          voice: Math.min(voices, Math.max(1, Number(r?.voice) || 1)),
          lines: Array.isArray(r?.lines) && r.lines.length ? r.lines.map(String) : f.lines,
          punchlines: Array.isArray(r?.punchlines) ? r.punchlines.map(String) : f.punchlines,
        };
      }),
    };
  }, () => generateLyrics(input));
  return { lyrics: { ...data, source }, warning };
}
