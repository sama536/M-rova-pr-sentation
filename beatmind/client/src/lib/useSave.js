import { useState } from 'react';
import { useAuth } from './auth.jsx';
import { saveProject } from './db.js';
import { useProject } from '../store/project.js';
import { toast } from '../components/ui/Toaster.jsx';

export function useSaveProject() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const save = async (label) => {
    if (!user) return toast.error('Connecte-toi pour sauvegarder.');
    const snap = useProject.getState().snapshot();
    if (!snap.params) return toast.error('Génère d\'abord un beat.');
    setSaving(true);
    try {
      const { project, version } = await saveProject(user.id, snap, { label });
      useProject.getState().markSaved(project.id);
      toast.success(`Projet sauvegardé — version ${version.version}`);
      return project;
    } catch (e) {
      toast.error(`Sauvegarde impossible : ${e.message}`);
      return null;
    } finally {
      setSaving(false);
    }
  };
  return { save, saving };
}
