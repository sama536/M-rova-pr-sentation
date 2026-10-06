import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config, services } from './config.js';
import { identify } from './lib/supabase.js';
import { UPLOAD_DIR } from './lib/storage.js';
import beat from './routes/beat.js';
import youtube from './routes/youtube.js';
import lyrics from './routes/lyrics.js';
import voice from './routes/voice.js';
import credits from './routes/credits.js';

const app = express();
app.use(cors({ origin: true, exposedHeaders: ['x-credits-balance'] }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, services, model: config.anthropic.model }));
app.use('/api', identify);
app.use('/api/beat', beat);
app.use('/api/youtube', youtube);
app.use('/api/lyrics', lyrics);
app.use('/api/voice', voice);
app.use('/api/credits', credits);

// En production, Express sert aussi le front compilé (npm run build puis npm start).
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if ((process.env.NODE_ENV === 'production' || process.argv.includes('--prod')) && fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error('[api]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' });
});

const server = app.listen(config.port, () => {
  const on = (b) => (b ? '\x1b[32m●\x1b[0m' : '\x1b[90m○\x1b[0m');
  console.log(`\n  \x1b[35mBeatMind API\x1b[0m → http://localhost:${config.port}`);
  console.log(`  ${on(services.claude)} Claude   ${on(services.suno)} Suno   ${on(services.elevenlabs)} ElevenLabs   ${on(services.youtube)} YouTube   ${on(services.supabase)} Supabase`);
  if (!Object.values(services).every(Boolean)) console.log('  Les services ○ tournent en mode démo local (voir .env.example).\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n✖ Le port ${config.port} est déjà utilisé (une autre instance de BeatMind tourne peut-être).`);
    console.error('  Ferme-la, ou choisis un autre port dans .env : PORT=8788.\n');
  } else console.error('[api] Démarrage impossible :', err.message);
  process.exit(1);
});
