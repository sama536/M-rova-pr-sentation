import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { supabaseAdmin } from './supabase.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// App de bureau : BEATMIND_DATA_DIR pointe vers le dossier de données de l'utilisateur (l'app installée est en lecture seule)
export const UPLOAD_DIR = process.env.BEATMIND_DATA_DIR
  ? path.join(process.env.BEATMIND_DATA_DIR, 'uploads')
  : path.resolve(here, '../../uploads');

// Stocke un fichier audio : Supabase Storage si configuré, sinon disque local (mode démo).
// Les échantillons de voix vont dans le bucket privé "voice-samples" (on renvoie alors le chemin, pas une URL publique).
export async function storeAudio(buffer, { userId = 'demo', folder = 'misc', ext = 'mp3', contentType = 'audio/mpeg' } = {}) {
  const name = `${crypto.randomUUID()}.${ext}`;
  if (supabaseAdmin) {
    const isPrivate = folder === 'voice-samples';
    const bucket = isPrivate ? 'voice-samples' : 'audio';
    const key = `${userId}/${isPrivate ? 'samples' : folder}/${name}`;
    const { error } = await supabaseAdmin.storage.from(bucket).upload(key, buffer, { contentType, upsert: false });
    if (error) throw new Error(`Stockage : ${error.message}`);
    return isPrivate ? `${bucket}/${key}` : supabaseAdmin.storage.from(bucket).getPublicUrl(key).data.publicUrl;
  }
  const dir = path.join(UPLOAD_DIR, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buffer);
  return `/uploads/${folder}/${name}`;
}
