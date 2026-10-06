import { supabaseAdmin } from './supabase.js';
import { CREDIT_COSTS } from '../../../shared/catalog.js';

// Débite les crédits côté serveur (fonction SQL atomique spend_credits).
// En mode démo, le solde est géré par le navigateur : on ne bloque jamais.
export function charge(action) {
  const cost = CREDIT_COSTS[action] ?? 1;
  return async (req, res, next) => {
    req.creditCost = cost;
    if (!supabaseAdmin || req.user?.demo) return next();
    const { data, error } = await supabaseAdmin.rpc('spend_credits', {
      p_user: req.user.id, p_amount: cost, p_reason: action,
    });
    if (error) return res.status(500).json({ error: `Crédits : ${error.message}` });
    if (data === null || data < 0) {
      return res.status(402).json({ error: `Crédits insuffisants (${cost} requis pour cette action).` });
    }
    res.setHeader('x-credits-balance', String(data));
    req.refund = () => supabaseAdmin.rpc('add_credits', { p_user: req.user.id, p_amount: cost, p_reason: `refund:${action}` });
    next();
  };
}
