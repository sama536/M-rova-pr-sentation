import { Router } from 'express';
import multer from 'multer';
import { requireUser, supabaseAdmin } from '../lib/supabase.js';
import { charge } from '../lib/credits.js';
import { storeAudio } from '../lib/storage.js';
import { cloneVoice, synthesize, elevenEnabled } from '../services/elevenlabs.js';

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

r.post('/clone', requireUser, upload.single('sample'), charge('voiceClone'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun enregistrement reçu.' });
    const name = String(req.body?.name || 'Ma voix').slice(0, 60);
    const ext = req.file.mimetype.includes('ogg') ? 'ogg' : req.file.mimetype.includes('mp4') ? 'm4a' : req.file.mimetype.includes('wav') ? 'wav' : 'webm';
    const sampleUrl = await storeAudio(req.file.buffer, { userId: req.user.id, folder: 'voice-samples', ext, contentType: req.file.mimetype });

    let elevenVoiceId = null;
    let warning;
    if (elevenEnabled()) {
      elevenVoiceId = await cloneVoice({ name: `BeatMind · ${name}`, buffer: req.file.buffer, mimetype: req.file.mimetype, filename: `sample.${ext}` });
    } else {
      warning = 'ElevenLabs non configuré : ta voix est enregistrée, la synthèse utilisera une voix de prévisualisation du navigateur.';
    }

    let profile = { id: null, name, eleven_voice_id: elevenVoiceId, sample_url: sampleUrl };
    if (supabaseAdmin && !req.user.demo) {
      const { data, error } = await supabaseAdmin.from('voice_profiles')
        .insert({ user_id: req.user.id, name, eleven_voice_id: elevenVoiceId, sample_url: sampleUrl })
        .select().single();
      if (error) throw new Error(error.message);
      profile = data;
    }
    res.json({ profile, warning, cost: req.creditCost });
  } catch (err) {
    await req.refund?.();
    next(err);
  }
});

r.post('/synthesize', requireUser, charge('voiceSynth'), async (req, res, next) => {
  try {
    const { voiceId, text = '', settings = {}, flow = 'rap_laid' } = req.body || {};
    const clean = String(text).replace(/\s+/g, ' ').trim().slice(0, 2500);
    if (!clean) return res.status(400).json({ error: 'Pas de paroles à chanter dans cette section.' });
    if (!elevenEnabled() || !voiceId) {
      await req.refund?.();
      return res.json({ audioUrl: null, preview: true, warning: 'Synthèse ElevenLabs non configurée : prévisualisation avec la voix du navigateur.' });
    }
    const audio = await synthesize({ voiceId, text: clean, settings, flow });
    const audioUrl = await storeAudio(audio, { userId: req.user.id, folder: 'vocals', ext: 'mp3' });
    res.json({ audioUrl, cost: req.creditCost });
  } catch (err) {
    await req.refund?.();
    next(err);
  }
});

export default r;
