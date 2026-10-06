// Prépare desktop/bundle/ : front compilé + API + catalogue partagé + logo, avec la même arborescence que le projet
// (les imports relatifs du serveur restent valides). Vérifie aussi que les dépendances de l'API sont déclarées.
import { cpSync, rmSync, mkdirSync, readFileSync, copyFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(desktop, '..');
const bundle = path.join(desktop, 'bundle');

const serverDeps = JSON.parse(readFileSync(path.join(root, 'server', 'package.json'), 'utf8')).dependencies;
const desktopDeps = JSON.parse(readFileSync(path.join(desktop, 'package.json'), 'utf8')).dependencies;
const missing = Object.keys(serverDeps).filter((d) => desktopDeps[d] !== serverDeps[d]);
if (missing.length) {
  console.error(`✖ Dépendances de l'API absentes ou différentes dans desktop/package.json : ${missing.join(', ')}`);
  process.exit(1);
}

if (!existsSync(path.join(root, 'node_modules', 'vite'))) {
  console.log('→ Installation des dépendances du projet…');
  if (spawnSync('npm install', { cwd: root, stdio: 'inherit', shell: true }).status !== 0) process.exit(1);
}
console.log('→ Build du front…');
if (spawnSync('npm run build', { cwd: root, stdio: 'inherit', shell: true }).status !== 0) process.exit(1);

rmSync(bundle, { recursive: true, force: true });
mkdirSync(bundle, { recursive: true });
cpSync(path.join(root, 'server', 'src'), path.join(bundle, 'server', 'src'), { recursive: true });
copyFileSync(path.join(root, 'server', 'package.json'), path.join(bundle, 'server', 'package.json'));
cpSync(path.join(root, 'shared'), path.join(bundle, 'shared'), { recursive: true });
cpSync(path.join(root, 'client', 'dist'), path.join(bundle, 'client', 'dist'), { recursive: true });
mkdirSync(path.join(bundle, 'brand'));
copyFileSync(path.join(root, 'brand', 'logo.png'), path.join(bundle, 'brand', 'logo.png'));
copyFileSync(path.join(root, '.env.example'), path.join(bundle, '.env.example'));
console.log('✔ desktop/bundle prêt');
