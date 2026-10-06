import { getAccessToken, getDemoUserId } from './auth.jsx';
import { isDemo } from './supabase.js';
import { useCredits } from '../store/credits.js';
import { CREDIT_COSTS } from '@shared/catalog.js';

async function authHeaders() {
  const h = {};
  const token = await getAccessToken();
  if (token) h.Authorization = `Bearer ${token}`;
  if (isDemo) h['x-demo-user'] = getDemoUserId();
  return h;
}

async function request(path, { method = 'GET', body, form, action } = {}) {
  const cost = action ? CREDIT_COSTS[action] : 0;
  if (cost && !useCredits.getState().canAfford(cost)) {
    throw new Error(`Crédits insuffisants : cette action coûte ${cost} crédits.`);
  }
  const headers = await authHeaders();
  if (body) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  } catch {
    throw new Error('Serveur BeatMind injoignable. Lance `npm run dev` à la racine du projet.');
  }
  const balance = res.headers.get('x-credits-balance');
  if (balance !== null) useCredits.getState().setBalance(Number(balance));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  if (isDemo && data.cost) useCredits.getState().spendLocal(data.cost);
  return data;
}

export const api = {
  health: () => request('/api/health'),
  credits: () => request('/api/credits'),
  analyzeYouTube: (urls) => request('/api/youtube/analyze', { method: 'POST', body: { urls }, action: 'analyze' }),
  generateBeat: (payload) => request('/api/beat/generate', { method: 'POST', body: payload, action: 'beat' }),
  sunoStatus: (ids) => request(`/api/beat/suno/${ids.join(',')}`),
  generateLyrics: (payload) => request('/api/lyrics/generate', { method: 'POST', body: payload, action: 'lyrics' }),
  cloneVoice: (blob, name) => {
    const form = new FormData();
    form.append('sample', blob, `sample.${blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm'}`);
    form.append('name', name);
    return request('/api/voice/clone', { method: 'POST', form, action: 'voiceClone' });
  },
  synthesize: (payload) => request('/api/voice/synthesize', { method: 'POST', body: payload, action: 'voiceSynth' }),
};

export const proxiedAudio = (url) => (url && /^https?:\/\//.test(url) && !url.includes(window.location.host) && /suno/.test(url)
  ? `/api/beat/proxy?url=${encodeURIComponent(url)}` : url);
