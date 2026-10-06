// Mini stockage clé/valeur IndexedDB pour les fichiers audio en mode démo.
const DB = 'beatmind';
const STORE = 'blobs';
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const idbPut = (key, blob) => tx('readwrite', (s) => s.put(blob, key));
export const idbGet = (key) => tx('readonly', (s) => s.get(key));
export const idbDel = (key) => tx('readwrite', (s) => s.delete(key));

const urlCache = new Map();
// "idb:clé" -> object URL utilisable par <audio> et fetch
export async function resolveAudioUrl(url) {
  if (!url || !url.startsWith('idb:')) return url;
  if (urlCache.has(url)) return urlCache.get(url);
  const blob = await idbGet(url.slice(4));
  if (!blob) return null;
  const obj = URL.createObjectURL(blob);
  urlCache.set(url, obj);
  return obj;
}
