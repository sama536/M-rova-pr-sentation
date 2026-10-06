import { create } from 'zustand';
import { STARTING_CREDITS } from '@shared/catalog.js';
import { isDemo } from '../lib/supabase.js';

// Solde de crédits. En mode démo, il vit dans localStorage (par utilisateur).
const key = (uid) => `bm_credits_${uid}`;

export const useCredits = create((set, get) => ({
  balance: null,
  userId: null,
  init(userId, serverBalance) {
    if (isDemo) {
      const stored = Number(localStorage.getItem(key(userId)));
      const balance = Number.isFinite(stored) && localStorage.getItem(key(userId)) !== null ? stored : STARTING_CREDITS;
      localStorage.setItem(key(userId), String(balance));
      set({ balance, userId });
    } else set({ balance: serverBalance ?? null, userId });
  },
  setBalance(balance) {
    if (isDemo && get().userId) localStorage.setItem(key(get().userId), String(balance));
    set({ balance });
  },
  canAfford(cost) {
    const b = get().balance;
    return b === null || b >= cost;
  },
  spendLocal(cost) {
    if (!isDemo) return;
    const next = Math.max(0, (get().balance ?? 0) - cost);
    get().setBalance(next);
  },
}));
