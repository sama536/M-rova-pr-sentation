import { X } from 'lucide-react';
import { useProject, VOICE_COLORS } from '../../store/project.js';
import { VOICE_PRESETS, VOICE_PARAMS, BACKS_BY_GENRE, styleById } from '@shared/catalog.js';
import { SliderParam } from '../ui/Param.jsx';
import Toggle from '../ui/Toggle.jsx';

export default function VoiceCard({ voice, profiles }) {
  const { updateVoice, applyPreset, removeVoice, styles } = useProject();
  const backs = BACKS_BY_GENRE[styleById(styles[0])?.backs || 'trap'];
  const color = VOICE_COLORS[voice.slot - 1];
  const profile = profiles.find((p) => p.id === voice.profileId);

  return (
    <div className="panel p-5" style={{ boxShadow: `inset 3px 0 0 ${color}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label" style={{ color }}>Voix {voice.slot}{voice.slot > 1 ? ' · feat' : ' · principale'}</div>
          <input className="mt-1 w-full bg-transparent font-display text-lg font-semibold outline-none" value={voice.name} onChange={(e) => updateVoice(voice.slot, { name: e.target.value })} />
        </div>
        <button type="button" onClick={() => removeVoice(voice.slot)} className="p-1 text-mute hover:text-red-400" aria-label="Retirer la voix"><X size={16} /></button>
      </div>

      <label className="mt-3 grid gap-1.5">
        <span className="flex items-baseline gap-2"><span className="label">Timbre de base</span><span className="hint">Ta voix clonée sert de base à toutes les générations</span></span>
        <select className="input" value={voice.profileId || ''} onChange={(e) => {
          const p = profiles.find((x) => x.id === e.target.value);
          updateVoice(voice.slot, { profileId: p?.id || null, elevenVoiceId: p?.eleven_voice_id || null, name: p?.name || voice.name });
        }}>
          <option value="">— Aucune voix clonée (prévisualisation navigateur) —</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}{p.eleven_voice_id ? '' : ' (non clonée)'}</option>)}
        </select>
        {profile && !profile.eleven_voice_id && <span className="hint text-amber-300/80">Cette voix n'est pas clonée sur ElevenLabs : configure ELEVENLABS_API_KEY pour la synthèse réelle.</span>}
      </label>

      <div className="mt-5">
        <div className="label mb-2">Preset vocal</div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {VOICE_PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => applyPreset(voice.slot, p.id)}
              className={`rounded-lg border px-3 py-2 text-left transition ${voice.presetId === p.id ? 'border-neon bg-neon/10' : 'border-white/[0.06] hover:border-neon/40'}`}>
              <div className="text-[13px] font-semibold">{p.label}</div>
              <div className="hint">{p.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="label">Réglages fins</div>
        {VOICE_PARAMS.map((prm) => (
          <SliderParam key={prm.key} label={prm.label} hint={prm.hint} unit={prm.unit} min={prm.min} max={prm.max} step={prm.step}
            value={voice.settings[prm.key] ?? 0} onChange={(v) => updateVoice(voice.slot, { settings: { [prm.key]: v } })} />
        ))}
        <Toggle label="Backs auto" hint={`${backs.label} — ${backs.hint}`} checked={!!voice.settings.backs} onChange={(v) => updateVoice(voice.slot, { settings: { backs: v } })} />
      </div>
    </div>
  );
}
