import { createClient } from '@supabase/supabase-js';
import { config, services } from '../config.js';

export const supabaseAdmin = services.supabase
  ? createClient(config.supabase.url, config.supabase.serviceRoleKey, { auth: { persistSession: false } })
  : null;

// Middleware : identifie l'utilisateur via le JWT Supabase (Authorization: Bearer ...).
// En mode démo (pas de Supabase), on accepte l'en-tête x-demo-user.
export async function identify(req, _res, next) {
  req.user = null;
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (supabaseAdmin && token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && data?.user) req.user = { id: data.user.id, email: data.user.email };
  } else if (!supabaseAdmin) {
    req.user = { id: req.headers['x-demo-user'] || 'demo', demo: true };
  }
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Connecte-toi pour utiliser cette fonction.' });
  next();
}
