import { Trash2 } from 'lucide-react';
import { useProject } from '../../store/project.js';
import { SliderParam } from '../ui/Param.jsx';
import Param from '../ui/Param.jsx';

const FX = [
  ['reverb', 'Reverb', 'Espace : petite pièce → cathédrale'],
  ['delay', 'Delay', 'Écho rythmé (croche pointée)'],
  ['distortion', 'Distortion', 'Saturation, grain, agressivité'],
  ['compressor', 'Compressor', 'Resserre la dynamique, plus de punch'],
];

const SOUNDS = [
  ['piano', 'Piano'], ['keys', 'Rhodes / keys'], ['strings', 'Cordes'], ['violin', 'Violon'], ['pad', 'Pad'], ['choir', 'Chœur'],
  ['synth', 'Synthé lead'], ['brass', 'Cuivres'], ['sax', 'Saxophone'], ['flute', 'Flûte'], ['guitar', 'Guitare'], ['bell', 'Cloche / pluck'],
  ['bass', 'Basse'], ['808', '808'], ['drums', 'Batterie'],
];

export default function TrackFx({ track }) {
  const updateTrack = useProject((s) => s.updateTrack);
  const removeTrack = useProject((s) => s.removeTrack);
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2"><span className="label">Effets · {track.name}</span><span className="hint">Chaque piste a sa propre chaîne</span></div>
        {track.role !== 'vocal' && <button type="button" className="p-1 text-mute hover:text-red-400" title="Supprimer la piste" onClick={() => removeTrack(track.id)}><Trash2 size={14} /></button>}
      </div>
      {FX.map(([k, label, hint]) => (
        <SliderParam key={k} label={label} hint={hint} value={Math.round((track.fx?.[k] ?? 0) * 100)} min={0} max={100} unit="%"
          onChange={(v) => updateTrack(track.id, { fx: { [k]: v / 100 } })} />
      ))}
      {track.kind !== 'audio' && (
        <div className="grid grid-cols-2 gap-3">
          <Param label="Son" hint="Synthé utilisé">
            <select className="input py-2" value={track.synth} onChange={(e) => updateTrack(track.id, { synth: e.target.value })}>
              {SOUNDS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
            </select>
          </Param>
          {track.role !== 'drums' && <Param label="Octave" hint="Plus grave / aigu">
            <div className="flex items-center gap-2">
              <button type="button" className="btn-ghost btn-sm" onClick={() => updateTrack(track.id, { notes: (track.notes || []).map((n) => ({ ...n, p: n.p - 12 })), edited: true })}>−12</button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => updateTrack(track.id, { notes: (track.notes || []).map((n) => ({ ...n, p: n.p + 12 })), edited: true })}>+12</button>
            </div>
          </Param>}
        </div>
      )}
      {track.role === 'vocal' && <p className="hint">Reverb et saturation des voix sont synchronisées avec les réglages de Voice AI.</p>}
    </div>
  );
}
