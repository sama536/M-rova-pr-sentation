import fs from 'node:fs';
import path from 'node:path';

const quote = (v) => (/^[\w@%+=:,./-]*$/.test(v) ? v : JSON.stringify(v));

// Met à jour (ou ajoute / supprime) des variables dans un fichier .env en conservant le reste du fichier.
export function writeEnvValues(file, values) {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const lines = existing ? existing.split(/\r?\n/) : [];
  const done = new Set();
  const out = lines.map((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (!m || !(m[1] in values)) return line;
    done.add(m[1]);
    const v = values[m[1]];
    return v ? `${m[1]}=${quote(v)}` : `${m[1]}=`;
  });
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  for (const [k, v] of Object.entries(values)) if (!done.has(k) && v) out.push(`${k}=${quote(v)}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${out.join('\n').replace(/\n+$/, '')}\n`);
}
