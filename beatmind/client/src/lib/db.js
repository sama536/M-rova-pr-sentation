// Couche de données : Supabase en production, localStorage + IndexedDB en mode démo.
// Les pages n'appellent que ces fonctions et ignorent le backend réel.
import { supabase, isDemo } from './supabase.js';
import { idbPut } from './idb.js';
import { uid } from './format.js';
import { generateBeatParams } from '@shared/generators.js';
import { CC_LICENSE } from '@shared/catalog.js';

const MAX_VERSIONS = 30;

// ---------------- Stockage local (démo) ----------------
const LS = 'bm_db_v1';
function load() {
  let db;
  try { db = JSON.parse(localStorage.getItem(LS)); } catch { db = null; }
  if (!db) {
    db = { projects: [], versions: [], voices: [], beats: [], likes: [], comments: [], users: {} };
    seed(db);
    persist(db);
  }
  return db;
}
function persist(db) { localStorage.setItem(LS, JSON.stringify(db)); }
function mutate(fn) { const db = load(); const r = fn(db); persist(db); return r; }
const now = () => new Date().toISOString();

function seed(db) {
  const producers = [
    { id: 'seed-nyx', username: 'nyx808', display_name: 'NYX 808', bio: 'Drill & trap sombre depuis Marseille.' },
    { id: 'seed-luma', username: 'luma', display_name: 'Luma', bio: 'Afro, amapiano, soleil dans les oreilles.' },
    { id: 'seed-kairo', username: 'kairo', display_name: 'Kairo', bio: 'House, techno, chœurs et drops.' },
    { id: 'seed-velvet', username: 'velvet.keys', display_name: 'Velvet Keys', bio: 'Jazz, R&B et boom bap à l\'ancienne.' },
  ];
  producers.forEach((p) => { db.users[p.id] = { ...p, avatar_url: null, created_at: now() }; });
  const beats = [
    ['seed-nyx', 'Minuit sur le port', 'drill sombre avec flûte', ['drill'], ['flute', '808', 'strings'], ['sombre', 'mystérieux']],
    ['seed-nyx', 'Chrome froid', 'trap lourde piano mélancolique', ['trap'], ['piano', '808'], ['mélancolique']],
    ['seed-luma', 'Soleil de Lagos', 'afro solaire guitare', ['afro'], ['guitare', 'basse', 'synthe'], ['solaire', 'chill']],
    ['seed-luma', 'Log Drum Season', 'amapiano deep piano jazzy', ['amapiano'], ['piano', 'basse', 'pad'], ['chill', 'planant']],
    ['seed-kairo', 'Cathédrale', 'house chœurs sur le drop', ['house'], ['choir', 'piano', 'basse'], ['euphorique', 'énergique']],
    ['seed-kairo', 'Acid Nuit', 'techno hypnotique synthé acide', ['techno'], ['synthe', 'basse'], ['mystérieux', 'énergique']],
    ['seed-velvet', 'Velours', 'rnb smooth saxophone', ['rnb', 'jazz'], ['saxophone', 'piano', 'basse'], ['romantique', 'chill']],
    ['seed-velvet', 'Bitume 94', 'boom bap brut piano', ['boombap'], ['piano', 'basse', 'strings'], ['mélancolique']],
  ];
  beats.forEach(([userId, title, prompt, styles, instruments, moods], i) => {
    const params = generateBeatParams({ prompt, styles, instruments });
    params.title = title;
    // Version courte pour les extraits communautaires
    params.structure = params.structure.slice(1, 3).map((s) => ({ ...s, bars: Math.min(s.bars, 8) }));
    db.beats.push({
      id: `seed-beat-${i}`, user_id: userId, project_id: null, title,
      description: params.description, audio_url: null, bpm: params.bpm, key: `${params.key} ${params.scale === 'major' ? 'maj' : 'min'}`,
      styles, moods, instruments, params, license: CC_LICENSE.id,
      plays: 40 + i * 37, downloads: 5 + i * 11, likes_count: 3 + ((i * 7) % 19), saves_count: i % 5, comments_count: 0,
      created_at: new Date(Date.now() - i * 86400000 * 1.7).toISOString(),
    });
  });
}

function attachUser(db, row) {
  const u = db.users[row.user_id];
  return { ...row, user: u ? { id: u.id, username: u.username, display_name: u.display_name, avatar_url: u.avatar_url } : null };
}

export function rememberDemoUser(profile) {
  if (!isDemo || !profile) return;
  mutate((db) => {
    db.users[profile.id] = { ...db.users[profile.id], ...profile, created_at: db.users[profile.id]?.created_at || now() };
  });
}

const check = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

// ---------------- Projets & versions ----------------
export async function listProjects(userId) {
  if (isDemo) return load().projects.filter((p) => p.user_id === userId).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return check(await supabase.from('projects').select('id,title,bpm,key,styles,cover_color,audio_url,created_at,updated_at').eq('user_id', userId).order('updated_at', { ascending: false }));
}

export async function getProject(id) {
  if (isDemo) return load().projects.find((p) => p.id === id) || null;
  return check(await supabase.from('projects').select('*').eq('id', id).maybeSingle());
}

export async function saveProject(userId, snapshot, { label } = {}) {
  const row = {
    title: snapshot.title || snapshot.params?.title || 'Sans titre',
    bpm: snapshot.params?.bpm ?? null,
    key: snapshot.params ? `${snapshot.params.key} ${snapshot.params.scale}` : null,
    styles: snapshot.styles || [],
    cover_color: snapshot.coverColor || null,
    data: snapshot,
  };
  if (isDemo) {
    return mutate((db) => {
      let project = snapshot.projectId && db.projects.find((p) => p.id === snapshot.projectId && p.user_id === userId);
      if (project) Object.assign(project, row, { updated_at: now() });
      else {
        project = { id: uid('prj'), user_id: userId, ...row, created_at: now(), updated_at: now() };
        db.projects.push(project);
      }
      project.data = { ...snapshot, projectId: project.id };
      const versions = db.versions.filter((v) => v.project_id === project.id);
      const version = { id: uid('ver'), project_id: project.id, user_id: userId, version: (versions.at(-1)?.version || 0) + 1, label: label || null, data: project.data, created_at: now() };
      db.versions.push(version);
      const mine = db.versions.filter((v) => v.project_id === project.id);
      if (mine.length > MAX_VERSIONS) db.versions = db.versions.filter((v) => v !== mine[0]);
      return { project, version };
    });
  }
  let project;
  if (snapshot.projectId) {
    project = check(await supabase.from('projects').update(row).eq('id', snapshot.projectId).select().maybeSingle());
  }
  if (!project) project = check(await supabase.from('projects').insert({ ...row, user_id: userId }).select().single());
  const data = { ...snapshot, projectId: project.id };
  if (!snapshot.projectId) await supabase.from('projects').update({ data }).eq('id', project.id);
  const last = check(await supabase.from('project_versions').select('version').eq('project_id', project.id).order('version', { ascending: false }).limit(1));
  const version = check(await supabase.from('project_versions').insert({
    project_id: project.id, user_id: userId, version: (last[0]?.version || 0) + 1, label: label || null, data,
  }).select().single());
  return { project: { ...project, data }, version };
}

export async function listVersions(projectId) {
  if (isDemo) return load().versions.filter((v) => v.project_id === projectId).sort((a, b) => b.version - a.version);
  return check(await supabase.from('project_versions').select('id,version,label,created_at,data').eq('project_id', projectId).order('version', { ascending: false }).limit(MAX_VERSIONS));
}

export async function deleteProject(id) {
  if (isDemo) return mutate((db) => { db.projects = db.projects.filter((p) => p.id !== id); db.versions = db.versions.filter((v) => v.project_id !== id); });
  check(await supabase.from('projects').delete().eq('id', id));
}

// ---------------- Voix clonées ----------------
export async function listVoices(userId) {
  if (isDemo) return load().voices.filter((v) => v.user_id === userId);
  return check(await supabase.from('voice_profiles').select('*').eq('user_id', userId).order('created_at', { ascending: false }));
}

export async function addVoiceLocal(userId, profile, sampleBlob) {
  if (!isDemo) return profile; // déjà inséré par le serveur
  let sampleUrl = profile.sample_url;
  if (sampleBlob) { const key = uid('smp'); await idbPut(key, sampleBlob); sampleUrl = `idb:${key}`; }
  return mutate((db) => {
    const row = { ...profile, id: uid('voice'), user_id: userId, sample_url: sampleUrl, created_at: now() };
    db.voices.unshift(row);
    return row;
  });
}

export async function deleteVoice(id) {
  if (isDemo) return mutate((db) => { db.voices = db.voices.filter((v) => v.id !== id); });
  check(await supabase.from('voice_profiles').delete().eq('id', id));
}

// ---------------- Crédits ----------------
export async function getCreditsBalance(userId) {
  if (isDemo) return null;
  const data = check(await supabase.from('credits').select('balance').eq('user_id', userId).maybeSingle());
  return data?.balance ?? 0;
}

// ---------------- Community ----------------
const SORTS = { recent: 'created_at', popular: 'likes_count', downloads: 'downloads', plays: 'plays' };

export async function listBeats(f = {}) {
  const sortKey = SORTS[f.sort] || 'created_at';
  const keyMatches = (bKey) => !f.key || (bKey || '').startsWith(`${f.key} `);
  if (isDemo) {
    const db = load();
    let rows = db.beats.filter((b) => (!f.userId || b.user_id === f.userId)
      && (!f.styles?.length || f.styles.some((s) => b.styles.includes(s)))
      && (!f.instruments?.length || f.instruments.every((s) => b.instruments.includes(s)))
      && (!f.mood || b.moods.includes(f.mood))
      && keyMatches(b.key)
      && (!f.bpmMin || b.bpm >= f.bpmMin) && (!f.bpmMax || b.bpm <= f.bpmMax)
      && (!f.search || `${b.title} ${b.description}`.toLowerCase().includes(f.search.toLowerCase()))
      && (!f.ids || f.ids.includes(b.id)));
    rows = rows.sort((a, b) => (sortKey === 'created_at' ? b.created_at.localeCompare(a.created_at) : b[sortKey] - a[sortKey]));
    return rows.map((r) => attachUser(db, r));
  }
  let q = supabase.from('community_beats').select('*, user:users(id,username,display_name,avatar_url)');
  if (f.userId) q = q.eq('user_id', f.userId);
  if (f.styles?.length) q = q.overlaps('styles', f.styles);
  if (f.instruments?.length) q = q.contains('instruments', f.instruments);
  if (f.mood) q = q.contains('moods', [f.mood]);
  if (f.key) q = q.like('key', `${f.key} %`);
  if (f.bpmMin) q = q.gte('bpm', f.bpmMin);
  if (f.bpmMax) q = q.lte('bpm', f.bpmMax);
  if (f.search) q = q.ilike('title', `%${f.search}%`);
  if (f.ids) q = q.in('id', f.ids.length ? f.ids : ['00000000-0000-0000-0000-000000000000']);
  return check(await q.order(sortKey, { ascending: false }).limit(60));
}

export async function publishBeat(userId, { blob, title, description, params, styles, moods, instruments, projectId }) {
  const meta = {
    title, description: description || '', bpm: params?.bpm ?? null,
    key: params ? `${params.key} ${params.scale === 'major' ? 'maj' : 'min'}` : null,
    styles, moods, instruments, params, project_id: isDemo ? null : projectId || null, license: CC_LICENSE.id,
  };
  if (isDemo) {
    const key = uid('beat');
    await idbPut(key, blob);
    return mutate((db) => {
      const row = { id: uid('cb'), user_id: userId, ...meta, audio_url: `idb:${key}`, plays: 0, downloads: 0, likes_count: 0, saves_count: 0, comments_count: 0, created_at: now() };
      db.beats.unshift(row);
      return attachUser(db, row);
    });
  }
  const path = `${userId}/beats/${crypto.randomUUID()}.mp3`;
  const up = await supabase.storage.from('audio').upload(path, blob, { contentType: blob.type || 'audio/mpeg' });
  if (up.error) throw new Error(up.error.message);
  const audio_url = supabase.storage.from('audio').getPublicUrl(path).data.publicUrl;
  return check(await supabase.from('community_beats').insert({ ...meta, user_id: userId, audio_url }).select('*, user:users(id,username,display_name,avatar_url)').single());
}

export async function deleteBeat(id) {
  if (isDemo) return mutate((db) => { db.beats = db.beats.filter((b) => b.id !== id); });
  check(await supabase.from('community_beats').delete().eq('id', id));
}

export async function myReactions(userId) {
  if (!userId) return { like: new Set(), save: new Set() };
  const rows = isDemo ? load().likes.filter((l) => l.user_id === userId)
    : check(await supabase.from('likes').select('beat_id,kind').eq('user_id', userId));
  return {
    like: new Set(rows.filter((r) => r.kind === 'like').map((r) => r.beat_id)),
    save: new Set(rows.filter((r) => r.kind === 'save').map((r) => r.beat_id)),
  };
}

export async function toggleReaction(userId, beatId, kind, on) {
  const counter = kind === 'like' ? 'likes_count' : 'saves_count';
  if (isDemo) {
    return mutate((db) => {
      const beat = db.beats.find((b) => b.id === beatId);
      const exists = db.likes.some((l) => l.user_id === userId && l.beat_id === beatId && l.kind === kind);
      if (on && !exists) { db.likes.push({ user_id: userId, beat_id: beatId, kind, created_at: now() }); if (beat) beat[counter] += 1; }
      if (!on && exists) { db.likes = db.likes.filter((l) => !(l.user_id === userId && l.beat_id === beatId && l.kind === kind)); if (beat) beat[counter] = Math.max(0, beat[counter] - 1); }
    });
  }
  if (on) check(await supabase.from('likes').upsert({ user_id: userId, beat_id: beatId, kind }, { ignoreDuplicates: true }));
  else check(await supabase.from('likes').delete().match({ user_id: userId, beat_id: beatId, kind }));
}

export async function listComments(beatId) {
  if (isDemo) {
    const db = load();
    return db.comments.filter((c) => c.beat_id === beatId).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((c) => attachUser(db, c));
  }
  return check(await supabase.from('comments').select('*, user:users(id,username,display_name,avatar_url)').eq('beat_id', beatId).order('created_at'));
}

export async function addComment(userId, beatId, body) {
  const text = body.trim().slice(0, 1000);
  if (!text) return null;
  if (isDemo) {
    return mutate((db) => {
      const row = { id: uid('cmt'), beat_id: beatId, user_id: userId, body: text, created_at: now() };
      db.comments.push(row);
      const beat = db.beats.find((b) => b.id === beatId);
      if (beat) beat.comments_count += 1;
      return attachUser(db, row);
    });
  }
  return check(await supabase.from('comments').insert({ beat_id: beatId, user_id: userId, body: text }).select('*, user:users(id,username,display_name,avatar_url)').single());
}

export async function trackStat(beatId, stat) {
  if (isDemo) return mutate((db) => { const b = db.beats.find((x) => x.id === beatId); if (b) b[stat] += 1; });
  await supabase.rpc('increment_beat_stat', { p_beat: beatId, p_stat: stat });
}

export async function getProducer(idOrUsername) {
  if (isDemo) {
    const db = load();
    const u = db.users[idOrUsername] || Object.values(db.users).find((x) => x.username === idOrUsername);
    if (!u) return null;
    const beats = db.beats.filter((b) => b.user_id === u.id);
    return {
      profile: u,
      stats: {
        beats_count: beats.length,
        total_downloads: beats.reduce((a, b) => a + b.downloads, 0),
        total_likes: beats.reduce((a, b) => a + b.likes_count, 0),
        total_plays: beats.reduce((a, b) => a + b.plays, 0),
      },
    };
  }
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrUsername);
  const stats = check(await supabase.from('producer_stats').select('*').eq(isUuid ? 'user_id' : 'username', idOrUsername).maybeSingle());
  if (!stats) return null;
  return { profile: { id: stats.user_id, username: stats.username, display_name: stats.display_name, avatar_url: stats.avatar_url, bio: stats.bio, created_at: stats.created_at }, stats };
}

export async function getMyProfile(userId) {
  if (isDemo) return load().users[userId] || null;
  return check(await supabase.from('users').select('*').eq('id', userId).maybeSingle());
}

export async function updateProfile(userId, patch) {
  const clean = { display_name: patch.display_name, username: patch.username?.toLowerCase().replace(/[^a-z0-9_.]/g, ''), bio: patch.bio, avatar_url: patch.avatar_url };
  if (isDemo) return mutate((db) => { db.users[userId] = { ...db.users[userId], ...clean }; return db.users[userId]; });
  return check(await supabase.from('users').update(clean).eq('id', userId).select().single());
}
