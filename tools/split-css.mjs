// ===================== DÉCOUPAGE DE styles.css (#312) =====================
// Outil À USAGE UNIQUE : découpe public/styles.css en fichiers thématiques
// sous public/css/, aux frontières des sections déjà présentes dans le fichier.
//
// Il ne sert qu'à effectuer la bascule sans réécrire 3 300 lignes à la main
// (et sans risquer d'en perdre au passage). Une fois la bascule faite et
// commitée, la source devient public/css/*.css et cet outil n'a plus d'objet —
// il est conservé pour tracer comment le découpage a été obtenu.
//
// Ensuite, c'est tools/build-css.mjs qui reconstruit public/styles.css.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Frontières : première ligne (1-indexée) de chaque tranche, dans l'ordre du
// fichier. Choisies sur les entêtes de section existants, pour qu'aucune règle
// ne change de voisinage — l'ordre de cascade est préservé à l'identique.
const CUTS = [
  { at: 1, file: '01-base.css', title: 'Variables, remises à zéro, éléments de base' },
  { at: 103, file: '02-topbar.css', title: 'Topbar et bascule de langue' },
  { at: 263, file: '03-plateau.css', title: 'Plateau de jeu et pions' },
  { at: 590, file: '04-jeu.css', title: 'Contrôles de partie et overlays but/fin' },
  { at: 658, file: '05-accueil.css', title: 'Accueil, hero et écran de configuration' },
  { at: 962, file: '06-profil.css', title: 'Profil, joueurs personnalisés, amis et mercato' },
  { at: 1288, file: '07-boutique.css', title: 'Boutique (première version)' },
  { at: 1451, file: '08-online-tutoriel.css', title: 'Multijoueur, tutoriel et compte' },
  { at: 1742, file: '09-refonte-accueil.css', title: 'Refonte accueil et plateau (sprints D2/D3)' },
  { at: 2222, file: '10-cartes-joueurs.css', title: 'Cartes joueurs TCG, onglets et skeletons' },
  { at: 2513, file: '11-boutique-pieces.css', title: 'Boutique et pièces (sprints E1/E2)' },
  { at: 2922, file: '12-tirs-au-but.css', title: 'Séance de tirs au but (4 thèmes)' },
  { at: 3229, file: '13-editorial.css', title: 'Contenu éditorial indexable et overlay Règles & FAQ' }
];

const src = await readFile(path.join(ROOT, 'public', 'styles.css'), 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';
const lines = src.split(nl);
await mkdir(path.join(ROOT, 'public', 'css'), { recursive: true });

let total = 0;
for (let i = 0; i < CUTS.length; i++) {
  const from = CUTS[i].at - 1;
  const to = i + 1 < CUTS.length ? CUTS[i + 1].at - 1 : lines.length;
  const body = lines.slice(from, to).join(nl).replace(/\s+$/, '');
  const header = `/* =====================================================================
   ${CUTS[i].title.toUpperCase()}
   ---------------------------------------------------------------------
   Découpé de styles.css (#312). public/styles.css est GÉNÉRÉ par
   tools/build-css.mjs à partir de ce dossier — ne pas l'éditer à la main.
   L'ordre des fichiers (préfixe numérique) EST l'ordre de cascade :
   le renommer ou l'intercaler change le rendu.
   ===================================================================== */

`;
  await writeFile(path.join(ROOT, 'public', 'css', CUTS[i].file), header + body + nl, 'utf8');
  const n = body.split(nl).length;
  total += n;
  console.log(`✓ css/${CUTS[i].file}`.padEnd(38), String(n).padStart(5), 'lignes');
}
console.log(`\n${total} lignes réparties (source : ${lines.length})`);
