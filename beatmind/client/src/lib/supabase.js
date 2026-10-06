import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sans variables Supabase, l'app tourne en "mode démo" : comptes et données dans le navigateur.
export const isDemo = !(url && anon);
export const supabase = isDemo ? null : createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } });
