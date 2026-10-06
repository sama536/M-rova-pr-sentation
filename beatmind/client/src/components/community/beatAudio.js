import { loadBuffer, renderSong } from '../../audio/renderer.js';
import { arrangeAll } from '../../audio/arranger.js';
import { generateBeatParams } from '@shared/generators.js';
import { encode } from '../../audio/exporter.js';
import { resolveAudioUrl } from '../../lib/idb.js';
import { player } from '../../audio/player.js';

const rendered = new Map();

// Les prods de démo n'ont pas de fichier : elles sont rendues à la volée depuis leurs paramètres.
export async function beatBuffer(beat) {
  if (beat.audio_url) return loadBuffer(beat.audio_url);
  if (rendered.has(beat.id)) return rendered.get(beat.id);
  const base = beat.params?.tracks?.length ? beat.params : { ...generateBeatParams({ prompt: beat.title, styles: beat.styles, instruments: beat.instruments }), ...beat.params, tracks: undefined };
  const params = arrangeAll({ ...base, tracks: base.tracks || generateBeatParams({ prompt: beat.title, styles: beat.styles, instruments: beat.instruments }).tracks });
  const p = renderSong(params);
  rendered.set(beat.id, p);
  return p;
}

export async function playBeat(beat) {
  if (player.state.ownerId === beat.id && player.state.buffer) return player.toggle();
  const buf = await beatBuffer(beat);
  player.load(buf, { label: `${beat.title} — ${beat.user?.display_name || ''}`, ownerId: beat.id });
  player.play();
}

export async function beatBlob(beat) {
  if (beat.audio_url) {
    const url = await resolveAudioUrl(beat.audio_url);
    const res = await fetch(url);
    return res.blob();
  }
  return encode(await beatBuffer(beat), 'mp3');
}
