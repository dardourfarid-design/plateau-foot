// ===================== CONSTRUCTION DE styles.css (#312) =====================
// Concatène public/css/*.css dans public/styles.css.
//
//   node tools/build-css.mjs
//
// POURQUOI CONCATÉNER PLUTÔT QUE SERVIR 13 FICHIERS
// Treize <link> seraient treize requêtes bloquantes sur le chemin critique —
// on aurait échangé un problème de maintenabilité contre un problème de
// performance. Le découpage sert à la lecture et à l'édition ; ce que le
// navigateur reçoit reste un seul fichier, minifié ensuite par tools/build.mjs.
//
// L'ORDRE EST SIGNIFIANT : le préfixe numérique des fichiers EST l'ordre de
// cascade. Renommer ou intercaler un fichier change le rendu — c'est voulu et
// vérifié par tests/cssBuild.test.js, qui échoue si styles.css ne correspond
// plus à la concaténation de ses sources.
//
// styles.css reste COMMITÉ : il est servi tel quel en développement
// (`npm run serve` sert public/) et il n'y a pas d'étape de build en dev.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'public', 'css');
const OUT = path.join(ROOT, 'public', 'styles.css');

const BANNER = `/* =====================================================================
   FICHIER GÉNÉRÉ — NE PAS ÉDITER À LA MAIN
   ---------------------------------------------------------------------
   Concaténation de public/css/*.css par tools/build-css.mjs (#312).
   Toute modification faite ici sera écrasée à la prochaine génération.
   Édite le fichier de public/css/ correspondant, puis relance :

       node tools/build-css.mjs

   ===================================================================== */

`;

/** Liste ordonnée des sources (l'ordre alphabétique = l'ordre de cascade). */
export async function listCssSources() {
  const files = (await readdir(SRC_DIR)).filter(f => f.endsWith('.css')).sort();
  return files.map(f => path.join(SRC_DIR, f));
}

/** Construit le contenu attendu de styles.css. Exporté pour le test. */
export async function buildCss() {
  const files = await listCssSources();
  const parts = [];
  for (const file of files) {
    parts.push(await readFile(file, 'utf8'));
  }
  return BANNER + parts.join('\n');
}

// Exécution directe uniquement (l'import depuis le test ne doit rien écrire).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const css = await buildCss();
  await writeFile(OUT, css, 'utf8');
  const files = await listCssSources();
  console.log(`✓ styles.css — ${files.length} fichiers, ${css.split('\n').length} lignes`);
}
