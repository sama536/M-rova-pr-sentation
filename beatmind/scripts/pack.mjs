// Crée landing/downloads/beatmind.zip : le projet complet, sans node_modules, builds ni secrets.
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXCLUDE = new Set(['node_modules', 'dist', '.git', 'uploads', 'downloads', '.env', '.env.local', '.DS_Store']);

function collect(dir, out = {}) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE.has(name)) continue;
    const full = path.join(dir, name);
    const rel = path.relative(root, full).split(path.sep).join('/');
    if (statSync(full).isDirectory()) collect(full, out);
    else out[`beatmind/${rel}`] = [readFileSync(full), { level: /\.(png|zip)$/.test(name) ? 0 : 9 }];
  }
  return out;
}

export function pack() {
  const files = collect(root);
  const outDir = path.join(root, 'landing', 'downloads');
  mkdirSync(outDir, { recursive: true });
  const zip = zipSync(files);
  const target = path.join(outDir, 'beatmind.zip');
  writeFileSync(target, zip);
  return { target, count: Object.keys(files).length, size: zip.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { target, count, size } = pack();
  console.log(`✔ ${path.relative(root, target)} — ${count} fichiers, ${(size / 1024).toFixed(0)} Ko`);
}
