// Vérifications avant `npm run dev` : version de Node et dépendances installées.
// N'utilise que des modules natifs : fonctionne même avant `npm install`.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [major, minor] = process.versions.node.split('.').map(Number);

if (major < 18 || (major === 18 && minor < 17)) {
  console.error(`\n✖ BeatMind nécessite Node.js 18.17 ou plus récent (installé : ${process.version}).`);
  console.error('  Télécharge la version LTS sur https://nodejs.org puis relance `npm run dev`.\n');
  process.exit(1);
}

const required = ['concurrently', 'vite', 'express', 'react', '@vitejs/plugin-react', 'tailwindcss', '@anthropic-ai/sdk'];
const missing = required.filter((dep) => !existsSync(path.join(root, 'node_modules', dep, 'package.json')));

if (missing.length) {
  console.log(`\n→ Dépendances manquantes (${missing.join(', ')}). Installation automatique…\n`);
  const r = spawnSync('npm install', { cwd: root, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error('\n✖ `npm install` a échoué. Lis l\'erreur ci-dessus, puis relance `npm run dev`.\n');
    process.exit(r.status || 1);
  }
}
