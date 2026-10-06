import { createClient } from '@supabase/supabase-js';

// En production, le serveur injecte window.__BEATMIND_CONFIG__ (clés lues au démarrage, sans rebuild)
const injected = typeof window !== 'undefined' ? window.__BEATMIND_CONFIG__ || {} : {};
const url = injected.supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
const anon = injected.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sans variables Supabase, l'app tourne en "mode démo" : comptes et données dans le navigateur.
export const isDemo = !(url && anon);
export const supabase = isDemo ? null : createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } });
