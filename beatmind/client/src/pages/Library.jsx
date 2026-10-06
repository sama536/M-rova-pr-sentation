import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FolderOpen, History, Trash2, RotateCcw, Wand2, ChevronDown, ChevronUp } from 'lucide-react';
import { Page } from '../components/Layout.jsx';
import EqBars from '../components/ui/EqBars.jsx';
import { toast } from '../components/ui/Toaster.jsx';
import { listProjects, getProject, listVersions, deleteProject } from '../lib/db.js';
import { useAuth } from '../lib/auth.jsx';
import { useProject } from '../store/project.js';
import { player } from '../audio/player.js';
import { fmtDate, fmtAgo, coverFor } from '../lib/format.js';
import { styleById } from '@shared/catalog.js';

export default function Library() {
  const { user } = useAuth();
  const [projects, setProjects] = useState(null);
  const [open, setOpen] = useState(null);
  const [versions, setVersions] = useState([]);
  const current = useProject((s) => s.projectId);
  const nav = useNavigate();

  const refresh = () => listProjects(user.id).then(setProjects).catch((e) => { toast.error(e.message); setProjects([]); });
  useEffect(() => { refresh(); }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) listVersions(open).then(setVersions).catch((e) => toast.error(e.message)); }, [open]);

  const load = async (data, label) => {
    if (useProject.getState().isDirty() && useProject.getState().params && !confirm('Le projet en cours a des modifications non sauvegardées. Continuer ?')) return;
    player.stop();
    useProject.getState().loadSnapshot(data);
    toast.success(label);
    nav('/studio');
  };

  const openProject = async (id) => {
    const p = await getProject(id);
    if (p) load({ ...p.data, projectId: p.id }, `« ${p.title} » ouvert`);
  };

  return (
    <Page eyebrow="Bibliothèque" title="Tes projets." intro="Chaque sauvegarde crée une version : tu peux revenir en arrière à tout moment."
      actions={<Link to="/beat" className="btn-primary"><Wand2 size={15} /> Nouveau beat</Link>}>
      {projects === null ? <div className="grid h-40 place-items-center"><EqBars /></div> : projects.length === 0 ? (
        <div className="panel grid place-items-center gap-3 p-10 text-center">
          <FolderOpen size={28} className="text-neon-soft" />
          <p className="text-sm text-mute">Aucun projet sauvegardé. Génère un beat puis clique sur « Sauvegarder ».</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <div key={p.id} className={`panel overflow-hidden ${current === p.id ? 'border-neon/50' : ''}`}>
              <div className="flex flex-wrap items-center gap-4 p-4">
                <span className="h-14 w-14 shrink-0 rounded-xl" style={{ background: `radial-gradient(circle at 30% 20%, ${p.cover_color || coverFor(p.title)}, #121214 80%)` }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-display font-semibold">{p.title}</h3>
                    {current === p.id && <span className="rounded bg-neon/20 px-1.5 text-[10px] font-semibold text-neon-glow">OUVERT</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-mute">
                    {p.bpm && <span className="num">{p.bpm} BPM</span>}
                    {p.key && <span className="num">{p.key}</span>}
                    {p.styles?.length > 0 && <span>{p.styles.map((s) => styleById(s)?.label || s).join(' × ')}</span>}
                    <span>modifié {fmtAgo(p.updated_at)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-primary btn-sm" onClick={() => openProject(p.id)}><FolderOpen size={13} /> Ouvrir</button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(open === p.id ? null : p.id)}><History size={13} /> Versions {open === p.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</button>
                  <button type="button" className="btn-ghost btn-sm" onClick={async () => { if (confirm(`Supprimer « ${p.title} » et toutes ses versions ?`)) { await deleteProject(p.id); refresh(); } }}><Trash2 size={13} /></button>
                </div>
              </div>
              {open === p.id && (
                <div className="border-t border-white/[0.06] bg-ink-900/50 p-4">
                  <div className="label mb-3">Historique des versions</div>
                  <ol className="relative grid gap-2 border-l border-neon/30 pl-5">
                    {versions.map((v) => (
                      <li key={v.id} className="relative flex flex-wrap items-center gap-3">
                        <span className="absolute -left-[25px] h-2.5 w-2.5 rounded-full bg-neon shadow-neon" />
                        <span className="num text-sm font-semibold text-neon-glow">v{v.version}</span>
                        <span className="text-sm text-zinc-300">{v.label || v.data?.params?.title || 'Sauvegarde'}</span>
                        <span className="hint">{fmtDate(v.created_at)} · {new Date(v.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        {v.data?.params && <span className="num hint">{v.data.params.bpm} BPM · {v.data.params.key} {v.data.params.scale}</span>}
                        <button type="button" className="btn-ghost btn-sm ml-auto" onClick={() => load({ ...v.data, projectId: p.id }, `Version ${v.version} restaurée`)}><RotateCcw size={12} /> Restaurer</button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
