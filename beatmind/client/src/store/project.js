// État du projet en cours, partagé par Beat AI, Voice AI et Studio. Persisté dans le navigateur.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { arrangeAll, arrangeTrack } from '../audio/arranger.js';
import { makeTrack } from '@shared/generators.js';
import { presetById, VOICE_PRESETS, styleById } from '@shared/catalog.js';
import { uid } from '../lib/format.js';

export const VOICE_COLORS = ['#a78bfa', '#f0abfc', '#67e8f9'];

const initial = () => ({
  projectId: null,
  title: '',
  prompt: '',
  styles: [],
  instruments: [],
  customInstruments: [],
  references: [],
  params: null,
  suno: null,
  voices: [],
  lyrics: { theme: '', style: '', sections: {} },
  vocalTimeline: {},
  takes: {},
  masterVolume: 0.9,
  revision: 0,
  savedRevision: 0,
});

const SNAPSHOT_KEYS = ['title', 'prompt', 'styles', 'instruments', 'customInstruments', 'references', 'params', 'suno', 'voices', 'lyrics', 'vocalTimeline', 'takes', 'masterVolume'];

function defaultFlow(type, styles = []) {
  const rap = styles.some((s) => ['trap', 'drill', 'boombap', 'phonk', 'rage', 'opium', 'cloudrap'].includes(s));
  if (type === 'intro' || type === 'outro') return 'spoken';
  if (type === 'refrain') return 'sung_slow';
  if (type === 'pont') return 'sung_fast';
  return rap ? 'rap_fast' : 'sung_fast';
}

function vocalTracks(state) {
  const p = state.params;
  if (!p) return [];
  const spb = 1; // startBar en mesures
  let bar = 0;
  const starts = {};
  p.structure.forEach((s) => { starts[s.id] = bar; bar += s.bars * spb; });
  const backsStyle = styleById(state.styles[0])?.backs || 'trap';
  return state.voices.map((v) => {
    const existing = p.tracks.find((t) => t.id === `vox_${v.slot}`);
    const clips = Object.entries(state.takes)
      .filter(([k, take]) => k.endsWith(`:${v.slot}`) && take?.url && starts[k.split(':')[0]] !== undefined)
      .map(([k, take]) => {
        const sectionId = k.split(':')[0];
        const tl = state.vocalTimeline[sectionId] || {};
        const overrides = {};
        ['autotune', 'energy', 'harmonies'].forEach((key) => { if (tl[key] != null) overrides[key] = tl[key]; });
        if (tl.backs != null) overrides.backs = tl.backs;
        return { id: `${k}:${take.url}`, url: take.url, startBar: starts[sectionId], settings: overrides };
      });
    return {
      id: `vox_${v.slot}`,
      kind: 'audio',
      role: 'vocal',
      name: v.name || `Voix ${v.slot}`,
      color: VOICE_COLORS[v.slot - 1],
      volume: existing?.volume ?? 0.95,
      pan: existing?.pan ?? (v.slot === 1 ? 0 : v.slot === 2 ? -0.25 : 0.25),
      mute: existing?.mute ?? false,
      solo: existing?.solo ?? false,
      vocal: { ...v.settings, backsStyle },
      fx: {
        reverb: (v.settings.reverb ?? 30) / 100,
        delay: existing?.fx?.delay ?? 0.08,
        distortion: ((v.settings.saturation ?? 0) / 100) * 0.6,
        compressor: existing?.fx?.compressor ?? 0.55,
      },
      clips,
    };
  });
}

function withVocals(state) {
  if (!state.params) return state.params;
  const others = state.params.tracks.filter((t) => t.role !== 'vocal');
  return { ...state.params, tracks: [...others, ...vocalTracks(state)] };
}

export const useProject = create(persist((set, get) => {
  const bump = (patch) => set((s) => {
    const next = { ...s, ...patch, revision: s.revision + 1 };
    return { ...patch, params: withVocals(next), revision: next.revision };
  });

  return {
    ...initial(),

    setField: (patch) => set(patch),
    setMaster: (masterVolume) => bump({ masterVolume }),
    reset: () => set({ ...initial(), revision: get().revision + 1 }),
    isDirty: () => get().revision !== get().savedRevision,
    markSaved: (projectId) => set({ projectId, savedRevision: get().revision }),

    snapshot() {
      const s = get();
      const out = { projectId: s.projectId };
      SNAPSHOT_KEYS.forEach((k) => { out[k] = s[k]; });
      return JSON.parse(JSON.stringify(out));
    },
    loadSnapshot(data) {
      set({ ...initial(), ...data, projectId: data.projectId || null, revision: get().revision + 1 });
      set({ savedRevision: get().revision });
    },

    // ---------- Beat ----------
    setParams(params, { suno } = {}) {
      const arranged = arrangeAll(params);
      const timeline = {};
      arranged.structure.forEach((sec) => {
        timeline[sec.id] = get().vocalTimeline[sec.id] || { flow: defaultFlow(sec.type, get().styles), voices: [1] };
      });
      bump({ params: arranged, title: params.title, suno: suno ?? null, vocalTimeline: timeline });
    },
    updateParams(patch) {
      const s = get();
      if (!s.params) return;
      const next = { ...s.params, ...patch };
      const structural = ['key', 'scale', 'progression', 'structure', 'drums', 'styles'].some((k) => k in patch);
      if (structural) {
        next.tracks = next.tracks.map((t) => (t.kind === 'audio' || t.edited ? t : { ...t, notes: arrangeTrack(next, t) }));
      }
      const timeline = { ...s.vocalTimeline };
      next.structure.forEach((sec) => { if (!timeline[sec.id]) timeline[sec.id] = { flow: defaultFlow(sec.type, s.styles), voices: [1] }; });
      bump({ params: next, vocalTimeline: timeline, title: patch.title ?? s.title });
    },
    updateTrack(id, patch) {
      const s = get();
      if (!s.params) return;
      let { voices } = s;
      if (id.startsWith('vox_') && patch.fx) {
        // la reverb / saturation des voix vivent dans les réglages de la voix
        const slot = Number(id.split('_')[1]);
        const voice = voices.find((v) => v.slot === slot);
        if (voice) {
          const settings = { ...voice.settings };
          if ('reverb' in patch.fx) settings.reverb = Math.round(patch.fx.reverb * 100);
          if ('distortion' in patch.fx) settings.saturation = Math.round((patch.fx.distortion / 0.6) * 100);
          voices = voices.map((v) => (v.slot === slot ? { ...v, settings } : v));
        }
      }
      const tracks = s.params.tracks.map((t) => (t.id === id ? { ...t, ...patch, fx: { ...t.fx, ...(patch.fx || {}) } } : t));
      bump({ params: { ...s.params, tracks }, voices });
    },
    setNotes(id, notes) {
      const s = get();
      const tracks = s.params.tracks.map((t) => (t.id === id ? { ...t, notes, edited: true } : t));
      bump({ params: { ...s.params, tracks } });
    },
    regenerateTrack(id) {
      const s = get();
      const tracks = s.params.tracks.map((t) => (t.id === id ? { ...t, notes: arrangeTrack(s.params, { ...t, id: uid('trk') }), edited: false } : t));
      bump({ params: { ...s.params, tracks } });
    },
    addTrack(instrumentId) {
      const s = get();
      if (!s.params) return;
      const t = makeTrack(instrumentId);
      t.notes = arrangeTrack(s.params, t);
      bump({ params: { ...s.params, tracks: [...s.params.tracks.filter((x) => x.role !== 'vocal'), t] } });
    },
    removeTrack(id) {
      const s = get();
      bump({ params: { ...s.params, tracks: s.params.tracks.filter((t) => t.id !== id) }, suno: id === 'suno' ? null : s.suno });
    },
    setSuno(suno) {
      const s = get();
      if (!s.params) return set({ suno });
      const clip = suno?.clips?.find((c) => c.id === suno.selectedId) || suno?.clips?.find((c) => c.audioUrl);
      let tracks = s.params.tracks.filter((t) => t.id !== 'suno');
      if (clip?.audioUrl && clip.status === 'complete') {
        const hadSuno = s.params.tracks.some((t) => t.id === 'suno');
        if (!hadSuno) tracks = tracks.map((t) => (t.role === 'vocal' ? t : { ...t, mute: true }));
        tracks = [{
          id: 'suno', kind: 'audio', role: 'audio', name: 'Beat IA (Suno)', volume: 0.9, pan: 0, mute: false, solo: false,
          fx: { reverb: 0, delay: 0, distortion: 0, compressor: 0 }, clips: [{ id: `suno:${clip.id}`, url: clip.audioUrl, startBar: 0 }],
        }, ...tracks];
      }
      bump({ suno, params: { ...s.params, tracks } });
    },

    // ---------- Voix ----------
    addVoice(profile, presetId = 'melodique_aigu') {
      const s = get();
      if (s.voices.length >= 3) return;
      const slot = [1, 2, 3].find((n) => !s.voices.some((v) => v.slot === n));
      const preset = presetById(presetId) || VOICE_PRESETS[0];
      bump({ voices: [...s.voices, {
        slot, name: profile?.name || `Voix ${slot}`, profileId: profile?.id || null,
        elevenVoiceId: profile?.eleven_voice_id || null, presetId: preset.id, settings: { ...preset.settings },
      }].sort((a, b) => a.slot - b.slot) });
    },
    updateVoice(slot, patch) {
      const s = get();
      bump({ voices: s.voices.map((v) => (v.slot === slot ? { ...v, ...patch, settings: { ...v.settings, ...(patch.settings || {}) } } : v)) });
    },
    applyPreset(slot, presetId) {
      const preset = presetById(presetId);
      if (!preset) return;
      get().updateVoice(slot, { presetId, settings: { ...preset.settings } });
    },
    removeVoice(slot) {
      const s = get();
      const takes = Object.fromEntries(Object.entries(s.takes).filter(([k]) => !k.endsWith(`:${slot}`)));
      bump({ voices: s.voices.filter((v) => v.slot !== slot), takes });
    },

    // ---------- Paroles & timeline ----------
    setSectionVocal(sectionId, patch) {
      const s = get();
      bump({ vocalTimeline: { ...s.vocalTimeline, [sectionId]: { ...(s.vocalTimeline[sectionId] || {}), ...patch } } });
    },
    setLyricsMeta(patch) {
      set((s) => ({ lyrics: { ...s.lyrics, ...patch } }));
    },
    setSectionLines(sectionId, lines, punchlines) {
      set((s) => ({
        lyrics: { ...s.lyrics, sections: { ...s.lyrics.sections, [sectionId]: { ...(s.lyrics.sections[sectionId] || {}), lines, ...(punchlines ? { punchlines } : {}) } } },
        revision: s.revision + 1,
      }));
    },
    applyGeneratedLyrics(result) {
      const s = get();
      const sections = { ...s.lyrics.sections };
      const timeline = { ...s.vocalTimeline };
      result.sections.forEach((sec) => {
        sections[sec.sectionId] = { lines: sec.lines, punchlines: sec.punchlines || [] };
        if (sec.voice && timeline[sec.sectionId]) timeline[sec.sectionId] = { ...timeline[sec.sectionId], voices: [sec.voice] };
      });
      bump({ lyrics: { ...s.lyrics, sections }, vocalTimeline: timeline });
    },
    setTake(sectionId, slot, take) {
      const s = get();
      const takes = { ...s.takes };
      if (take) takes[`${sectionId}:${slot}`] = take;
      else delete takes[`${sectionId}:${slot}`];
      bump({ takes });
    },
  };
}, {
  name: 'bm_project_v1',
  partialize: (s) => {
    const out = { projectId: s.projectId, revision: s.revision, savedRevision: s.savedRevision };
    SNAPSHOT_KEYS.forEach((k) => { out[k] = s[k]; });
    return out;
  },
}));

export const allInstrumentIds = (s) => [...s.instruments, ...s.customInstruments];
