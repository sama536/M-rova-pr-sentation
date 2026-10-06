import { Router } from 'express';
import { requireUser } from '../lib/supabase.js';
import { charge } from '../lib/credits.js';
import { analyzeYouTube } from '../services/youtube.js';

const r = Router();

r.post('/analyze', requireUser, charge('analyze'), async (req, res) => {
  const urls = (req.body?.urls || []).map(String).filter(Boolean).slice(0, 5);
  if (!urls.length) return res.status(400).json({ error: 'Ajoute au moins un lien YouTube.' });
  const results = await Promise.allSettled(urls.map(analyzeYouTube));
  res.json({
    references: results.filter((x) => x.status === 'fulfilled').map((x) => x.value),
    errors: results.filter((x) => x.status === 'rejected').map((x) => x.reason.message),
  });
});

export default r;
