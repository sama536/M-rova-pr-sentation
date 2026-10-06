import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { Eye, EyeOff, Loader2, Save, CheckCircle2, CircleDashed, ExternalLink, Trash2, Lock } from 'lucide-react';
import Modal from './ui/Modal.jsx';
import { api } from '../lib/api.js';
import { toast } from './ui/Toaster.jsx';

// Ouverture du modal depuis n'importe où (menu latéral, en-tête mobile, Beates…)
export const useKeysModal = create((set) => ({ open: false, show: () => set({ open: true }), hide: () => set({ open: false }) }));
// L'app de bureau ouvre ce modal depuis son menu « BeatMind → Configurer les clés API »
if (typeof window !== 'undefined') window.addEventListener('beatmind:open-keys', () => useKeysModal.getState().show());

// État des services, partagé (pastille du bouton « Clés API »)
export const useServices = create((set) => ({
  services: null,
  async refresh() {
    try { const d = await api.getKeys(); set({ services: d.services }); return d; } catch { return null; }
  },
}));

const GROUPS = [
  {
    id: 'claude', title: 'Claude', subtitle: 'Paramètres de prod, paroles, analyse des références YouTube',
    link: ['console.anthropic.com', 'https://console.anthropic.com/settings/keys'],
    fields: [{ key: 'ANTHROPIC_API_KEY', label: 'Clé API Claude', placeholder: 'sk-ant-…', secret: true }],
  },
  {
    id: 'elevenlabs', title: 'ElevenLabs', subtitle: 'Clonage de ta voix et synthèse des prises vocales (plan gratuit OK)',
    link: ['elevenlabs.io', 'https://elevenlabs.io/app/settings/api-keys'],
    fields: [{ key: 'ELEVENLABS_API_KEY', label: 'Clé API ElevenLabs', placeholder: 'sk_…', secret: true }],
  },
  {
    id: 'suno', title: 'Suno', subtitle: 'Audio réel des beats — via une API Suno non officielle (format gcui-art/suno-api)',
    link: ['gcui-art/suno-api', 'https://github.com/gcui-art/suno-api'],
    fields: [
      { key: 'SUNO_API_URL', label: 'Adresse de ton API Suno', placeholder: 'http://localhost:3000', secret: false },
      { key: 'SUNO_API_KEY', label: 'Clé Suno (si ton API en demande une)', placeholder: 'optionnelle', secret: true },
    ],
  },
  {
    id: 'youtube', title: 'YouTube (optionnel)', subtitle: 'Métadonnées complètes des références (tags, description, durée) pour une meilleure analyse',
    link: ['console.cloud.google.com', 'https://console.cloud.google.com/apis/library/youtube.googleapis.com'],
    fields: [{ key: 'YOUTUBE_API_KEY', label: 'Clé YouTube Data API v3', placeholder: 'AIza…', secret: true }],
  },
];

function KeyField({ field, state, value, onChange, onClear, disabled }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="grid gap-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="label">{field.label}</span>
        {state?.set
          ? <span className="num text-[11px] text-emerald-300">enregistrée {state.preview}</span>
          : <span className="text-[11px] text-mute-dim">non configurée</span>}
      </span>
      <span className="flex gap-2">
        <span className="relative flex-1">
          <input
            className="input pr-10 font-mono text-[13px]"
            type={field.secret && !visible ? 'password' : 'text'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={state?.set ? 'Laisser vide pour garder la clé actuelle' : field.placeholder}
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
          />
          {field.secret && (
            <button type="button" onClick={() => setVisible(!visible)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-mute hover:text-white" aria-label={visible ? 'Masquer' : 'Afficher'}>
              {visible ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
        </span>
        {state?.set && !disabled && (
          <button type="button" onClick={onClear} className="btn-ghost px-3" title="Supprimer cette clé"><Trash2 size={14} /></button>
        )}
      </span>
    </label>
  );
}

export default function ApiKeysModal() {
  const { open, hide } = useKeysModal();
  const [info, setInfo] = useState(null);
  const [values, setValues] = useState({});
  const [cleared, setCleared] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues({});
    setCleared({});
    useServices.getState().refresh().then((d) => setInfo(d || { error: true }));
  }, [open]);

  const save = async () => {
    const payload = {};
    Object.entries(values).forEach(([k, v]) => { if (v.trim()) payload[k] = v.trim(); });
    Object.keys(cleared).forEach((k) => { if (!payload[k]) payload[k] = ''; });
    if (!Object.keys(payload).length) return toast.info('Rien à enregistrer : colle au moins une clé.');
    setSaving(true);
    try {
      const d = await api.saveKeys(payload);
      setInfo((i) => ({ ...i, keys: d.keys, services: d.services }));
      useServices.setState({ services: d.services });
      setValues({});
      setCleared({});
      const on = Object.entries(d.services).filter(([k, v]) => v && k !== 'supabase').map(([k]) => GROUPS.find((g) => g.id === k)?.title.split(' ')[0]);
      toast.success(`Clés enregistrées et actives tout de suite${on.length ? ` : ${on.join(', ')}` : ''}.`);
      hide();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const disabled = info && !info.editable;

  return (
    <Modal open={open} onClose={hide} title="⚙️ Clés API" width="max-w-2xl">
      <p className="hint -mt-2 mb-5">
        Colle tes clés pour activer les vraies IA. Sans clé, BeatMind fonctionne en mode démo.
        Les clés restent sur cet ordinateur{info?.desktop ? ' (dossier de données de BeatMind)' : ' (fichier beatmind/.env)'} et ne sont jamais réaffichées en clair.
      </p>
      {!info ? (
        <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-neon-soft" /></div>
      ) : info.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">Serveur BeatMind injoignable.</p>
      ) : (
        <div className="grid gap-4">
          {disabled && (
            <p className="flex gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-[13px] text-amber-200">
              <Lock size={15} className="mt-0.5 shrink-0" /> Sur un serveur en ligne, les clés se configurent dans le fichier .env du serveur, pas depuis le navigateur.
            </p>
          )}
          {GROUPS.map((g) => {
            const active = info.services?.[g.id];
            return (
              <section key={g.id} className="rounded-2xl border border-white/[0.07] bg-ink-800/60 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-display font-semibold">
                      {active ? <CheckCircle2 size={16} className="text-emerald-400" /> : <CircleDashed size={16} className="text-mute" />}
                      {g.title}
                    </div>
                    <p className="hint mt-0.5">{g.subtitle}</p>
                  </div>
                  <a href={g.link[1]} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-neon-soft hover:underline">
                    {g.link[0]} <ExternalLink size={11} />
                  </a>
                </div>
                <div className="grid gap-3">
                  {g.fields.map((f) => (
                    <KeyField
                      key={f.key}
                      field={f}
                      state={cleared[f.key] ? { set: false } : info.keys?.[f.key]}
                      value={values[f.key] || ''}
                      onChange={(v) => setValues((x) => ({ ...x, [f.key]: v }))}
                      onClear={() => setCleared((x) => ({ ...x, [f.key]: true }))}
                      disabled={disabled}
                    />
                  ))}
                </div>
              </section>
            );
          })}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={hide}>Annuler</button>
            <button type="button" className="btn-primary" onClick={save} disabled={saving || disabled}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Sauvegarder
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
