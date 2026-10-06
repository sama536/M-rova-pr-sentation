import Anthropic from '@anthropic-ai/sdk';
import { config, services } from '../config.js';
import { STYLES, INSTRUMENTS, FLOW_MODES, BACKS_BY_GENRE, styleById } from '../../../shared/catalog.js';
import {
  generateBeatParams, normalizeBeatParams, generateLyrics, analyzeReferenceHeuristic,
} from '../../../shared/generators.js';

const client = services.claude ? new Anthropic({ apiKey: config.anthropic.apiKey }) : null;

const SYSTEM = `Tu es BeatMind, un producteur et directeur artistique de musique urbaine et électronique.
Tu réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans bloc markdown.
Les valeurs textuelles sont en français.`;

async function askJSON(prompt, { effort = 'medium', maxTokens = 8000 } = {}) {
  const response = await client.beta.messages.create({
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

// Exécute Claude si configuré ; sinon (ou en cas d'erreur) bascule sur le générateur local.
async function withFallback(label, run, fallback) {
  if (!client) return { data: fallback(), source: 'local' };
  try {
    return { data: await run(), source: 'claude' };
  } catch (err) {
    console.warn(`[claude] ${label} — bascule sur le générateur local :`, err.message);
    return { data: fallback(), source: 'local', warning: `Claude indisponible (${err.message}). Paramètres générés localement.` };
  }
}

export async function generateBeat({ prompt, styles, instruments, references }) {
  const input = { prompt, styles, instruments, references };
  const { data, source, warning } = await withFallback('beat', async () => {
    const styleText = styles.map((id) => styleById(id)?.label || id).join(', ') || 'libre';
    const refs = references?.length
      ? references.map((r, i) => `Référence ${i + 1} « ${r.title} » : ${r.bpm} BPM, tonalité ${r.key || '?'}, flow ${r.flow}, vibe ${r.vibe}, mood ${r.mood}, structure ${r.structure}`).join('\n')
      : 'Aucune';
    const raw = await askJSON(`Crée les paramètres de production complets d'un beat.

Prompt de l'utilisateur : """${prompt || '(vide)'}"""
Styles à fusionner : ${styleText}
Instruments demandés : ${instruments.join(', ') || 'à toi de choisir'}
Références musicales analysées (sers-t'en comme repère de BPM, vibe et structure) :
${refs}

Styles connus : ${STYLES.map((s) => s.id).join(', ')}. Instruments connus : ${INSTRUMENTS.map((i) => i.id).join(', ')} (un instrument inconnu peut être utilisé tel quel).

Réponds avec ce JSON exact :
{
  "title": "titre court et évocateur",
  "description": "1 phrase qui résume la prod",
  "bpm": nombre entre 60 et 200,
  "key": "une note parmi C C# D D# E F F# G G# A A# B",
  "scale": "major | minor | dorian | phrygian | harmonicMinor",
  "mood": "2-3 mots",
  "swing": nombre 0 à 0.5,
  "halfTime": booléen,
  "drums": { "pattern": "trap|drill|swing|four|afro|boombap|phonk|hyperpop|dembow|rnb|amapiano|rage", "hatRolls": 0-1, "density": 0-1 },
  "progression": [4 à 8 degrés de gamme, entiers 0 à 6, ex: [0,5,2,6]],
  "structure": [{ "type": "intro|couplet|refrain|pont|outro", "label": "nom", "bars": nombre de mesures, "energy": 0-1 }],
  "tracks": [{ "instrument": "id d'instrument", "name": "nom affiché", "volume": 0-1, "pan": -1 à 1, "octave": 1-6, "fx": { "reverb": 0-1, "delay": 0-1, "distortion": 0-1, "compressor": 0-1 }, "notesHint": "ce que joue la piste" }],
  "mix": { "loudness": LUFS cible négatif, "warmth": 0-1, "width": 0-1, "notes": ["3 conseils de mix concrets"] },
  "productionNotes": ["3 à 5 notes de prod concrètes : sound design, placements, transitions"],
  "sunoPrompt": "prompt en anglais pour un générateur audio : genre, bpm, instruments, mood, 'instrumental'"
}
Inclus toujours une piste "perc" pour la batterie et respecte les instruments demandés.`, { effort: 'medium' });
    return normalizeBeatParams(raw, input);
  }, () => generateBeatParams(input));
  return { params: { ...data, source }, warning };
}

export async function analyzeReference(meta) {
  const { data, source } = await withFallback('reference', async () => {
    const raw = await askJSON(`Analyse cette référence musicale YouTube à partir de ses métadonnées et de ta connaissance de l'artiste.
Titre : ${meta.title}
Chaîne : ${meta.channel}
Durée : ${meta.durationSec || '?'} s
Tags : ${(meta.tags || []).slice(0, 20).join(', ')}
Description : ${(meta.description || '').slice(0, 1200)}

JSON attendu :
{ "style": "un id parmi ${STYLES.map((s) => s.id).join(', ')}", "bpm": nombre, "key": "C..B ou null", "flow": "description courte du flow", "vibe": "2-4 mots", "mood": "1-2 mots", "structure": "ex: Intro – Couplet – Refrain – ...", "energy": 0-1, "confidence": 0-1 }`, { effort: 'low', maxTokens: 2000 });
    return { ...analyzeReferenceHeuristic(meta), ...raw, bpm: Number(raw.bpm) || analyzeReferenceHeuristic(meta).bpm };
  }, () => analyzeReferenceHeuristic(meta));
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
