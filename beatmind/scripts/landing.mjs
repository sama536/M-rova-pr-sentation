// Site vitrine en local : synchronise le logo et Beates, génère le zip à télécharger, puis sert landing/.
import http from 'node:http';
import { readFileSync, existsSync, statSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pack } from './pack.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'landing');
const PORT = Number(process.env.LANDING_PORT || 4173);

for (const f of ['logo.svg', 'logo-192.png', 'logo-512.png', 'beates.svg', 'beates.css']) {
  copyFileSync(path.join(root, 'brand', f), path.join(site, 'assets', f));
}
const { count, size } = pack();
console.log(`✔ Archive à télécharger prête (${count} fichiers, ${(size / 1024).toFixed(0)} Ko)`);

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.zip': 'application/zip' };

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.normalize(path.join(site, url));
  if (!file.startsWith(site)) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
}).listen(PORT, () => {
  console.log(`\n  Site BeatMind → http://localhost:${PORT}\n`);
}).on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `✖ Le port ${PORT} est occupé. Essaie : LANDING_PORT=4180 npm run landing` : e.message);
  process.exit(1);
});
