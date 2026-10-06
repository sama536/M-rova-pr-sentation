import { useState } from 'react';
import { api } from './api.js';
import { useProject } from '../store/project.js';
import { loadBuffer } from '../audio/renderer.js';
import { processVocal } from '../audio/vocalfx.js';
import { player } from '../audio/player.js';
import { toast } from '../components/ui/Toaster.jsx';

export const countSyllables = (line = '') => (line.toLowerCase().match(/[aeiouyàâäéèêëîïôöùûüœ]+/g) || []).length;

const FLOW_RATE = { sung_slow: 0.8, sung_fast: 1.05, rap_laid: 1, rap_fast: 1.25, rap_ultra: 1.55, spoken: 0.9 };

function voiceSettingsFor(sectionId, slot) {
  const s = useProject.getState();
  const v = s.voices.find((x) => x.slot === slot);
  const tl = s.vocalTimeline[sectionId] || {};
  const settings = { ...(v?.settings || {}) };
  ['autotune', 'energy', 'harmonies', 'backs'].forEach((k) => { if (tl[k] != null) settings[k] = tl[k]; });
  return { voice: v, settings, flow: tl.flow || 'rap_laid' };
}

function sectionText(sectionId) {
  const lines = useProject.getState().lyrics.sections[sectionId]?.lines || [];
  // retire les backs entre parenthèses (gérés par l'effet "backs")
  return lines.map((l) => l.replace(/\([^)]*\)/g, '').trim()).filter(Boolean).join('\n');
}

export function useVocalActions() {
  const [busyKey, setBusyKey] = useState(null);

  const previewSpeech = (sectionId, slot) => {
    const text = sectionText(sectionId);
    if (!text) return toast.error('Pas de paroles dans cette section.');
    if (!('speechSynthesis' in window)) return toast.error('Ton navigateur ne gère pas la synthèse vocale.');
    const { settings, flow } = voiceSettingsFor(sectionId, slot);
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.pitch = Math.max(0, Math.min(2, 1 + (settings.pitch || 0) / 12));
    u.rate = FLOW_RATE[flow] || 1;
    window.speechSynthesis.speak(u);
  };

  const synthesize = async (sectionId, slot) => {
    const text = sectionText(sectionId);
    if (!text) return toast.error('Écris ou génère des paroles pour cette section d\'abord.');
    const { voice, settings, flow } = voiceSettingsFor(sectionId, slot);
    if (!voice?.elevenVoiceId) {
      toast.info('Pas de voix clonée ElevenLabs sur cette voix : prévisualisation avec la voix du navigateur.');
      return previewSpeech(sectionId, slot);
    }
    const key = `${sectionId}:${slot}`;
    setBusyKey(key);
    try {
      const res = await api.synthesize({ voiceId: voice.elevenVoiceId, text, settings, flow });
      if (!res.audioUrl) {
        if (res.warning) toast.info(res.warning);
        return previewSpeech(sectionId, slot);
      }
      useProject.getState().setTake(sectionId, slot, { url: res.audioUrl, text, at: Date.now() });
      toast.success('Prise générée — elle est placée sur la timeline.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyKey(null);
    }
  };

  const playTake = async (sectionId, slot) => {
    const s = useProject.getState();
    const take = s.takes[`${sectionId}:${slot}`];
    if (!take?.url) return;
    try {
      const raw = await loadBuffer(take.url);
      const { settings, voice } = voiceSettingsFor(sectionId, slot);
      const processed = await processVocal(raw, settings, s.params);
      player.load(processed, { label: `${voice?.name || 'Voix'} · prise`, ownerId: 'take' });
      player.play();
    } catch (e) {
      toast.error(`Lecture impossible : ${e.message}`);
    }
  };

  const synthesizeAll = async () => {
    const s = useProject.getState();
    const jobs = [];
    Object.entries(s.vocalTimeline).forEach(([sectionId, tl]) => {
      if (!sectionText(sectionId)) return;
      (tl.voices || []).forEach((slot) => { if (s.voices.some((v) => v.slot === slot && v.elevenVoiceId)) jobs.push([sectionId, slot]); });
    });
    if (!jobs.length) return toast.error('Rien à générer : il faut des paroles et au moins une voix clonée ElevenLabs.');
    for (const [sectionId, slot] of jobs) {
      // séquentiel pour respecter les limites du plan gratuit ElevenLabs
      // eslint-disable-next-line no-await-in-loop
      await synthesize(sectionId, slot);
    }
  };

  return { synthesize, synthesizeAll, playTake, previewSpeech, busyKey };
}
