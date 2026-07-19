// ===================== BUILD DE PRODUCTION (#314) =====================
// Copie public/ vers dist/ en minifiant le JavaScript et la CSS au passage.
//
// POURQUOI CE SCRIPT EXISTE
// La mesure faite pendant #309 a donné, sur l'accueil : 639 Ko de JavaScript
// en 52 requêtes, contre 111 Ko de CSS et 55 Ko de polices. Le JS non minifié
// est de très loin le premier poste de charge de la page — les commentaires du
// dépôt sont abondants (et c'est très bien), mais ils partent chez chaque
// visiteur.
//
// CE QUE CE SCRIPT NE FAIT PAS, DÉLIBÉRÉMENT
// Il ne bundle pas. Chaque module reste un fichier séparé, les imports relatifs
// restent valides, et le nombre de requêtes ne change pas. Regrouper les
// modules imposerait de revoir modulepreload, la liste de précache du service
// worker et l'ordre de chargement — beaucoup de risque pour un gain secondaire
// face à la minification. Le « zéro bundler » reste vrai en développement :
// `npm run serve` sert toujours public/ tel quel.
//
// NON DESTRUCTIF : public/ n'est jamais modifié. Vercel construit dans dist/
// (voir vercel.json). En local : `npm run build`.

// esbuild est publié en CommonJS : pas d'export nommé en ESM.
import esbuild from 'esbuild';
const { transform } = esbuild;
import { readdir, readFile, writeFile, mkdir, rm, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'dist');

// Le SDK Supabase est livré déjà minifié : le repasser à la moulinette coûte du
// temps de build pour rien.
const SKIP_MINIFY = [path.join('vendor', '')];

function shouldSkip(rel) {
  return SKIP_MINIFY.some(prefix => rel.startsWith(prefix));
}

let jsBefore = 0, jsAfter = 0, cssBefore = 0, cssAfter = 0, copied = 0;

async function walk(dir, rel = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const from = path.join(dir, entry.name);
    const relPath = path.join(rel, entry.name);
    const to = path.join(OUT, relPath);

    if (entry.isDirectory()) {
      await mkdir(to, { recursive: true });
      await walk(from, relPath);
      continue;
    }

    const ext = path.extname(entry.name);
    const size = (await stat(from)).size;

    if ((ext === '.js' || ext === '.css') && !shouldSkip(relPath)) {
      const source = await readFile(from, 'utf8');
      const result = await transform(source, {
        loader: ext === '.css' ? 'css' : 'js',
        minify: true,
        // Les modules du jeu sont des ES modules ; sw.js est un worker
        // classique. 'esnext' évite toute transformation autre que la
        // réduction de taille : pas de transpilation, pas de polyfill.
        target: 'esnext'
      });
      await writeFile(to, result.code, 'utf8');
      if (ext === '.js') { jsBefore += size; jsAfter += Buffer.byteLength(result.code); }
      else { cssBefore += size; cssAfter += Buffer.byteLength(result.code); }
    } else {
      await copyFile(from, to);
      copied++;
    }
  }
}

const ko = n => (n / 1024).toFixed(1) + ' Ko';
const gain = (a, b) => a === 0 ? '—' : `−${(100 - (b / a) * 100).toFixed(0)} %`;

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await walk(SRC);

console.log(`JS   ${ko(jsBefore)} → ${ko(jsAfter)}   ${gain(jsBefore, jsAfter)}`);
console.log(`CSS  ${ko(cssBefore)} → ${ko(cssAfter)}   ${gain(cssBefore, cssAfter)}`);
console.log(`${copied} fichier(s) copié(s) tels quels → dist/`);
