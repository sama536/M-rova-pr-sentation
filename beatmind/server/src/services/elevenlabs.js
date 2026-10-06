// ElevenLabs : clonage instantané (Instant Voice Cloning) et synthèse vocale.
import { config, services } from '../config.js';

const API = 'https://api.elevenlabs.io/v1';
export const elevenEnabled = () => services.elevenlabs;

export async function cloneVoice({ name, buffer, mimetype, filename }) {
  const form = new FormData();
  form.append('name', name);
  form.append('description', 'Voix clonée depuis BeatMind (15 s parlées)');
  form.append('remove_background_noise', 'true');
  form.append('files', new Blob([buffer], { type: mimetype || 'audio/webm' }), filename || 'sample.webm');
  const res = await fetch(`${API}/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': config.elevenlabs.apiKey },
    body: form,
  });
  if (!res.ok) throw new Error(`ElevenLabs clone ${res.status} : ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).voice_id;
}

// Traduit les réglages BeatMind en voice_settings ElevenLabs.
// Pitch, autotune, saturation, reverb et harmonies sont appliqués ensuite côté navigateur (Web Audio).
export function toVoiceSettings(s = {}) {
  const energy = (s.energy ?? 60) / 100;
  const autotune = (s.autotune ?? 0) / 100;
  return {
    stability: Math.min(0.95, Math.max(0.15, 0.55 - energy * 0.3 + autotune * 0.35)),
    similarity_boost: 0.8,
    style: Math.min(1, Math.max(0, energy * 0.7)),
    use_speaker_boost: true,
  };
}

const FLOW_SPEED = { sung_slow: 0.85, sung_fast: 1.0, rap_laid: 0.95, rap_fast: 1.1, rap_ultra: 1.2, spoken: 0.9 };

export async function synthesize({ voiceId, text, settings, flow }) {
  const res = await fetch(`${API}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': config.elevenlabs.apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: config.elevenlabs.modelId,
      voice_settings: { ...toVoiceSettings(settings), speed: FLOW_SPEED[flow] ?? 1 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status} : ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteVoice(voiceId) {
  await fetch(`${API}/voices/${encodeURIComponent(voiceId)}`, { method: 'DELETE', headers: { 'xi-api-key': config.elevenlabs.apiKey } });
}
