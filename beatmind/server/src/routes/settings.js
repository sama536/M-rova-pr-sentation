// Clés API modifiables depuis l'app (bouton « Clés API »).
// Sécurité : uniquement depuis la machine elle-même, et seulement en local (dev) ou dans l'app de bureau —
// jamais sur un serveur de production partagé. Les clés ne sont jamais renvoyées en clair.
import { Router } from 'express';
import { config, services, loadConfig, ENV_FILE } from '../config.js';
import { writeEnvValues } from '../lib/envfile.js';

const r = Router();

const FIELDS = {
  ANTHROPIC_API_KEY: { secret: true, pattern: /^sk-ant-[\w-]{10,}$/, error: 'La clé Claude commence par « sk-ant- ».' },
  ELEVENLABS_API_KEY: { secret: true, pattern: /^[\w-]{16,}$/, error: 'Clé ElevenLabs invalide.' },
  SUNO_API_URL: { secret: false, pattern: /^https?:\/\/[^\s]+$/, error: 'L\'URL Suno doit commencer par http:// ou https://.' },
  SUNO_API_KEY: { secret: true, pattern: /^\S{6,}$/, error: 'Clé Suno invalide.' },
  YOUTUBE_API_KEY: { secret: true, pattern: /^[\w-]{20,}$/, error: 'Clé YouTube invalide.' },
};

const isLoopback = (ip = '') => ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.') || ip.startsWith('127.');
const editable = (req) => isLoopback(req.socket.remoteAddress) && (!!process.env.BEATMIND_ENV_FILE || process.env.NODE_ENV !== 'production');

function status() {
  const out = {};
  for (const [k, f] of Object.entries(FIELDS)) {
    const v = (process.env[k] || '').trim();
    out[k] = { set: !!v, preview: !v ? '' : f.secret ? `••••${v.slice(-4)}` : v };
  }
  return out;
}

r.get('/keys', (req, res) => {
  res.json({ editable: editable(req), desktop: !!process.env.BEATMIND_ENV_FILE, keys: status(), services, model: config.anthropic.model });
});

r.put('/keys', (req, res) => {
  if (!editable(req)) return res.status(403).json({ error: 'Les clés ne sont modifiables que sur l\'ordinateur qui fait tourner BeatMind.' });
  const input = req.body?.values || {};
  const changes = {};
  for (const [k, raw] of Object.entries(input)) {
    if (!FIELDS[k] || raw === undefined || raw === null) continue;
    const v = String(raw).replace(/[\r\n]/g, '').trim();
    if (v && !FIELDS[k].pattern.test(v)) return res.status(400).json({ error: FIELDS[k].error, field: k });
    changes[k] = v;
  }
  if (!Object.keys(changes).length) return res.json({ ok: true, keys: status(), services });
  try {
    writeEnvValues(ENV_FILE, changes);
  } catch (e) {
    return res.status(500).json({ error: `Impossible d'écrire le fichier de configuration : ${e.message}` });
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v) process.env[k] = v; else delete process.env[k];
  }
  loadConfig();
  res.json({ ok: true, keys: status(), services });
});

export default r;
