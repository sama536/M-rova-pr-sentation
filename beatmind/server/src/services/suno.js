// Client pour une API Suno non officielle auto-hébergée (ex. github.com/gcui-art/suno-api).
// Endpoints utilisés : POST /api/custom_generate, GET /api/get?ids=...
import { config, services } from '../config.js';

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (config.suno.apiKey) h.Authorization = `Bearer ${config.suno.apiKey}`;
  return h;
}

export const sunoEnabled = () => services.suno;

export async function startBeat(params) {
  if (!services.suno) return null;
  const res = await fetch(`${config.suno.baseUrl}/api/custom_generate`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      prompt: '',
      tags: params.sunoPrompt?.slice(0, 200) || `${params.styles?.join(' ')} instrumental ${params.bpm} bpm`,
      title: params.title?.slice(0, 80) || 'BeatMind',
      make_instrumental: true,
      wait_audio: false,
    }),
  });
  if (!res.ok) throw new Error(`Suno ${res.status} : ${(await res.text()).slice(0, 200)}`);
  const clips = await res.json();
  return (Array.isArray(clips) ? clips : clips.data || []).map(mapClip);
}

export async function getClips(ids) {
  if (!services.suno) return [];
  const res = await fetch(`${config.suno.baseUrl}/api/get?ids=${encodeURIComponent(ids.join(','))}`, { headers: headers() });
  if (!res.ok) throw new Error(`Suno ${res.status}`);
  const clips = await res.json();
  return (Array.isArray(clips) ? clips : clips.data || []).map(mapClip);
}

function mapClip(c) {
  return {
    id: c.id,
    status: c.status, // submitted | queued | streaming | complete | error
    audioUrl: c.audio_url || null,
    imageUrl: c.image_url || null,
    duration: c.duration || null,
    title: c.title,
  };
}
