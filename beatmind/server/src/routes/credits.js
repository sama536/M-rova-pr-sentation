import { Router } from 'express';
import { requireUser, supabaseAdmin } from '../lib/supabase.js';
import { CREDIT_COSTS, STARTING_CREDITS } from '../../../shared/catalog.js';

const r = Router();

r.get('/', requireUser, async (req, res, next) => {
  try {
    if (!supabaseAdmin || req.user.demo) return res.json({ balance: null, demo: true, costs: CREDIT_COSTS, starting: STARTING_CREDITS });
    const { data, error } = await supabaseAdmin.from('credits').select('balance').eq('user_id', req.user.id).maybeSingle();
    if (error) throw new Error(error.message);
    res.json({ balance: data?.balance ?? 0, costs: CREDIT_COSTS });
  } catch (err) { next(err); }
});

export default r;
