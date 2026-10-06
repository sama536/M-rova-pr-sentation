// YouTube Data API v3 (métadonnées) + analyse IA. Sans clé : oEmbed public (titre/chaîne).
import { config, services } from '../config.js';
import { analyzeReference } from './claude.js';

export function parseYouTubeId(url = '') {
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/);
  if (m) return m[1];
  return /^[\w-]{11}$/.test(url.trim()) ? url.trim() : null;
}

function isoDurationToSec(iso = '') {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
}

async function fetchMeta(id) {
  if (services.youtube) {
    const u = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${id}&key=${config.youtube.apiKey}`;
    const res = await fetch(u);
    if (res.ok) {
      const item = (await res.json()).items?.[0];
      if (item) {
        return {
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          description: item.snippet.description,
          tags: item.snippet.tags || [],
          durationSec: isoDurationToSec(item.contentDetails.duration),
          views: Number(item.statistics?.viewCount || 0),
          thumbnail: item.snippet.thumbnails?.medium?.url,
        };
      }
    } else console.warn('[youtube] API', res.status);
  }
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`);
    if (res.ok) {
      const o = await res.json();
      return { title: o.title, channel: o.author_name, description: '', tags: [], durationSec: 0, thumbnail: o.thumbnail_url };
    }
  } catch { /* hors ligne */ }
  return { title: `Vidéo ${id}`, channel: 'Inconnu', description: '', tags: [], durationSec: 0, thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` };
}

export async function analyzeYouTube(url) {
  const id = parseYouTubeId(url);
  if (!id) throw Object.assign(new Error(`Lien YouTube invalide : ${url}`), { status: 400 });
  const meta = await fetchMeta(id);
  const analysis = await analyzeReference(meta);
  return { id, url: `https://www.youtube.com/watch?v=${id}`, ...meta, ...analysis, description: undefined };
}
