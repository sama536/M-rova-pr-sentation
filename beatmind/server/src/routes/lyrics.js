import { Router } from 'express';
import { requireUser } from '../lib/supabase.js';
import { charge } from '../lib/credits.js';
import { writeLyrics } from '../services/claude.js';

const r = Router();

r.post('/generate', requireUser, charge('lyrics'), async (req, res, next) => {
  try {
    const { theme = '', style = 'trap', sections = [], language = 'fr', voices = 1, existing = '' } = req.body || {};
    if (!sections.length) return res.status(400).json({ error: 'Aucune section dans la timeline.' });
    const out = await writeLyrics({
      theme: String(theme).slice(0, 500), style, language,
      voices: Math.min(3, Math.max(1, Number(voices) || 1)),
      sections: sections.slice(0, 20), existing: String(existing).slice(0, 6000),
    });
    res.json({ ...out, cost: req.creditCost });
  } catch (err) {
    await req.refund?.();
    next(err);
  }
});

export default r;
