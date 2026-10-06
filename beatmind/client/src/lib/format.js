export const fmtTime = (s = 0) => {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
export const fmtNum = (n = 0) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));
export const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtAgo = (d) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
};
export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 10)}`;
export const slug = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'beatmind';
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const COVER_COLORS = ['#8b5cf6', '#a78bfa', '#6d28d9', '#c084fc', '#7c3aed', '#d8b4fe'];
export const coverFor = (s = '') => COVER_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COVER_COLORS.length];
