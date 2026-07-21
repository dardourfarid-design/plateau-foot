// ============ GARDE-FOU modulepreload ↔ GRAPHE D'IMPORTS (#324) ============
// La liste <link rel="modulepreload"> d'index.html doit être le miroir exact du
// graphe d'imports STATIQUES de src/ui/main.js. Les deux dérives possibles font
// mal, dans les deux sens :
//
//   • Précharger un module devenu dynamique annule le gain du chargement
//     paresseux : le navigateur le télécharge quand même au boot, et on a pris
//     la complexité de l'import() sans la récompense. C'est le piège exact que
//     #324 cherche à éviter, et rien dans le code ne l'empêcherait sans ce test.
//   • Oublier de précharger un module statique le laisse au fond de la cascade :
//     il n'est découvert qu'après le parsing de son importeur.
//
// Lancé par la CI et à la main : node tools/check-modulepreload.mjs
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const ENTRY = path.join(PUBLIC, 'src/ui/main.js');

// Volontairement naïf : un `import ... from '...'` en tête de ligne. Les
// import() dynamiques ne matchent pas (ils sont précédés d'un `=` ou d'un `(`),
// et c'est exactement ce qu'on veut — eux ne doivent PAS être préchargés.
const STATIC_IMPORT = /^\s*import\s+(?:[\s\S]*?from\s*)?['"]([^'"]+)['"]/gm;

const eager = new Set();
(function scan(abs) {
  if (eager.has(abs) || !existsSync(abs)) return;
  eager.add(abs);
  for (const m of readFileSync(abs, 'utf8').matchAll(STATIC_IMPORT)) {
    if (m[1].startsWith('.')) scan(path.resolve(path.dirname(abs), m[1]));
  }
})(ENTRY);

const rel = p => path.relative(PUBLIC, p).replace(/\\/g, '/');
// main.js est le point d'entrée (<script type="module">) : il n'a pas à
// figurer dans sa propre liste de préchargement.
const attendus = new Set([...eager].map(rel).filter(p => p !== 'src/ui/main.js'));

const html = readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
const declares = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map(m => m[1]);

const enTrop = declares.filter(p => !attendus.has(p));
const manquants = [...attendus].filter(p => !declares.includes(p)).sort();

console.log(`modulepreload déclarés : ${declares.length} — graphe statique : ${attendus.size}`);

if (enTrop.length) {
  console.error(`\n✗ ${enTrop.length} module(s) préchargé(s) mais ABSENT(S) du graphe statique.`);
  console.error('  Soit ils sont chargés à la demande (retirer le modulepreload), soit ils');
  console.error('  ne sont plus importés du tout (retirer aussi le fichier) :');
  enTrop.forEach(p => console.error(`    ${p}`));
}
if (manquants.length) {
  console.error(`\n✗ ${manquants.length} module(s) du graphe statique sans modulepreload :`);
  manquants.forEach(p => console.error(`    ${p}`));
}

if (enTrop.length || manquants.length) {
  console.error('\nCorriger la liste dans public/index.html.');
  process.exit(1);
}
console.log('✓ la liste modulepreload est le miroir exact du graphe statique.');
