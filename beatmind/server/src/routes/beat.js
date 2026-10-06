import { Router } from 'express';
import { config } from '../config.js';
import { requireUser } from '../lib/supabase.js';
import { charge } from '../lib/credits.js';
import { generateBeat } from '../services/claude.js';
import { startBeat, getClips, sunoEnabled } from '../services/suno.js';

const r = Router();

r.post('/generate', requireUser, charge('beat'), async (req, res, next) => {
  try {
    const { prompt = '', styles = [], instruments = [], references = [] } = req.body || {};
    const { params, warning } = await generateBeat({
      prompt: String(prompt).slice(0, 2000),
      styles: styles.slice(0, 15),
      instruments: instruments.slice(0, 20).map(String),
      references: references.slice(0, 5),
    });
    let suno = null;
    let sunoWarning;
    if (sunoEnabled()) {
      try {
        suno = await startBeat(params);
      } catch (err) {
        sunoWarning = `Suno indisponible (${err.message}). Le beat est rendu par le moteur BeatMind.`;
      }
    }
    res.json({ params, suno, warnings: [warning, sunoWarning].filter(Boolean), cost: req.creditCost });
  } catch (err) {
    await req.refund?.();
    next(err);
  }
});

r.get('/suno/:ids', async (req, res, next) => {
  try {
    res.json({ clips: await getClips(req.params.ids.split(',').slice(0, 4)) });
  } catch (err) { next(err); }
});

// Proxy audio : permet au navigateur de décoder l'audio Suno (CORS) dans Web Audio.
r.get('/proxy', async (req, res, next) => {
  try {
    const url = new URL(String(req.query.url || ''));
    const allowed = [/(^|\.)suno\.(ai|com)$/, /(^|\.)sunoapi\.\w+$/];
    if (config.suno.baseUrl) allowed.push(new RegExp(`^${new URL(config.suno.baseUrl).hostname.replace(/\./g, '\\.')}$`));
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return res.status(400).end();
    if (!allowed.some((re) => re.test(url.hostname))) return res.status(403).json({ error: 'Hôte audio non autorisé' });
    const upstream = await fetch(url);
    if (!upstream.ok) return res.status(502).json({ error: `Audio ${upstream.status}` });
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg');
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) { next(err); }
});

export default r;
