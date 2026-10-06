import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
// Le .env vit à la racine de beatmind/ (partagé avec Vite). server/.env est accepté en surcharge.
dotenv.config({ path: path.resolve(here, '../../.env') });
dotenv.config({ path: path.resolve(here, '../.env'), override: true });
// App de bureau : le .env de l'utilisateur (dans son dossier de données) a le dernier mot
if (process.env.BEATMIND_ENV_FILE) dotenv.config({ path: process.env.BEATMIND_ENV_FILE, override: true });

const env = (k, d = '') => (process.env[k] ?? d).trim();

export const config = {
  port: Number(env('PORT', '8787')),
  clientOrigin: env('CLIENT_ORIGIN', 'http://localhost:5173'),
  anthropic: { apiKey: env('ANTHROPIC_API_KEY'), model: env('CLAUDE_MODEL', 'claude-opus-5-5') },
  suno: { baseUrl: env('SUNO_API_URL').replace(/\/$/, ''), apiKey: env('SUNO_API_KEY') },
  elevenlabs: { apiKey: env('ELEVENLABS_API_KEY'), modelId: env('ELEVENLABS_MODEL_ID', 'eleven_multilingual_v2') },
  youtube: { apiKey: env('YOUTUBE_API_KEY') },
  supabase: {
    url: env('SUPABASE_URL') || env('VITE_SUPABASE_URL'),
    serviceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY'),
    anonKey: env('VITE_SUPABASE_ANON_KEY'),
  },
};

export const services = {
  claude: !!config.anthropic.apiKey,
  suno: !!config.suno.baseUrl,
  elevenlabs: !!config.elevenlabs.apiKey,
  youtube: !!config.youtube.apiKey,
  supabase: !!(config.supabase.url && config.supabase.serviceRoleKey),
};
