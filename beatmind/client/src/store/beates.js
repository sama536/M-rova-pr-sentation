// Mémoire de Beates, par utilisateur (localStorage) : état d'affichage, tutoriel,
// actions déjà faites et conseils déjà lus — pour ne jamais répéter la même chose.
import { create } from 'zustand';

const key = (uid) => `bm_beates_${uid}`;
const fresh = () => ({
  mode: 'open', // open | min | closed
  tutorial: { status: 'pending', step: 0 }, // pending | active | done | skipped
  done: {}, // beat, voice, lyrics, references, cloned, saved, exported, advanced, published…
  seen: [], // ids des conseils déjà lus
});

function read(uid) {
  try { return { ...fresh(), ...JSON.parse(localStorage.getItem(key(uid))) }; } catch { return fresh(); }
}

export const useBeates = create((set, get) => {
  const commit = (patch) => {
    set(patch);
    const { uid, mode, tutorial, done, seen } = get();
    if (uid) {
      try { localStorage.setItem(key(uid), JSON.stringify({ mode, tutorial, done, seen })); } catch { /* stockage indisponible */ }
    }
  };
  return {
    uid: null,
    ...fresh(),
    load(uid) {
      if (get().uid === uid) return;
      set({ uid, ...read(uid) });
    },
    setMode: (mode) => commit({ mode }),
    startTutorial: () => commit({ tutorial: { status: 'active', step: 0 }, mode: 'open' }),
    goToStep: (step) => commit({ tutorial: { ...get().tutorial, status: 'active', step } }),
    finishTutorial: (status = 'done') => commit({ tutorial: { status, step: 0 } }),
    markSeen: (id) => { if (!get().seen.includes(id)) commit({ seen: [...get().seen, id] }); },
    track(event) {
      if (get().done[event]) return;
      commit({ done: { ...get().done, [event]: Date.now() } });
    },
    resetMemory: () => commit({ ...fresh(), tutorial: { status: 'active', step: 0 } }),
  };
});

// Raccourci utilisable partout (hors composants React)
export const beatesTrack = (event) => useBeates.getState().track(event);
