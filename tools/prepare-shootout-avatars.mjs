// ============ PRÉPARATION DES AVATARS DE LA SÉANCE DE TIRS (#329) ============
// Les illustrations arrivent en JPEG avec un damier gris/blanc « de
// transparence » CUIT DANS L'IMAGE : le JPEG n'a pas de canal alpha, ce que
// l'aperçu laisse croire transparent est en réalité des pixels. Copiées telles
// quelles dans public/, les figures s'afficheraient sur un fond à carreaux.
//
// Ce script fait le trajet complet master → asset servi, et il est versionné
// pour que la prochaine livraison d'illustrations soit reproductible plutôt que
// refaite à la main (c'est la deuxième fois, voir #243).
//
//   npm i --no-save sharp
//   node tools/prepare-shootout-avatars.mjs <gardien.jpeg> <tireur.jpeg>
//
// `sharp` est installé À LA DEMANDE et volontairement ABSENT de package.json :
// c'est un binaire natif d'une trentaine de mégaoctets, et huit jobs CI font un
// `npm ci` à chaque PR. Le faire télécharger à tout le monde en permanence pour
// un outil qui sert à chaque livraison d'illustrations — deux fois en un an —
// serait un mauvais échange.
//
// POURQUOI UN REMPLISSAGE PAR DIFFUSION ET PAS UN SIMPLE SEUIL DE COULEUR
// Un seuil « tout ce qui est blanc/gris clair devient transparent » percerait
// le sujet : le tireur a des chaussures blanches, le gardien des crampons
// clairs et des reflets. On part donc des BORDS et on ne progresse que de
// proche en proche à travers des pixels de damier. Le sujet, entouré de son
// trait noir, est inatteignable — ses blancs intérieurs sont préservés.

import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Les deux teintes du damier. Tolérance large (46) pour absorber le bruit de
// compression JPEG et le halo de « ringing » autour du trait : ce sont des
// pixels de fond, les laisser opaques ferait une auréole grise autour de la
// figure sur le fond sombre de la séance.
const DAMIER = [[255, 255, 255], [229, 229, 229], [242, 242, 242]];
const TOLERANCE = 46;

function estDamier(r, g, b) {
  // Le damier est neutre : un pixel coloré (jaune du maillot, bleu du kit)
  // n'en fait jamais partie, même clair. Ce garde-fou évite de mordre sur les
  // aplats très clairs du sujet.
  if (Math.max(r, g, b) - Math.min(r, g, b) > 18) return false;
  return DAMIER.some(([dr, dg, db]) =>
    Math.abs(r - dr) <= TOLERANCE && Math.abs(g - dg) <= TOLERANCE && Math.abs(b - db) <= TOLERANCE);
}

/** Rend transparent le damier atteignable depuis les bords, puis recadre. */
async function detourer(entree) {
  const { data, info } = await sharp(entree).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  // Diffusion 4-connexe depuis tout le pourtour. Pile explicite plutôt que
  // récursion : 4 millions de pixels feraient sauter la pile d'appels.
  const vu = new Uint8Array(W * H);
  const pile = [];
  for (let x = 0; x < W; x++) { pile.push(x, x + (H - 1) * W); }
  for (let y = 0; y < H; y++) { pile.push(y * W, W - 1 + y * W); }

  while (pile.length) {
    const p = pile.pop();
    if (vu[p]) continue;
    const o = p * C;
    if (!estDamier(data[o], data[o + 1], data[o + 2])) continue;
    vu[p] = 1;
    data[o + 3] = 0;
    const x = p % W, y = (p - x) / W;
    if (x > 0) pile.push(p - 1);
    if (x < W - 1) pile.push(p + 1);
    if (y > 0) pile.push(p - W);
    if (y < H - 1) pile.push(p + W);
  }

  // --- Damier ENFERMÉ, inatteignable depuis les bords -----------------------
  // Le tireur a les mains sur les hanches : bras + torse + hanche forment un
  // triangle fermé, et le damier qu'il contient survit à la diffusion. Il faut
  // donc traiter aussi les composantes isolées — sans percer les chaussures
  // BLANCHES du tireur, qui sont elles aussi des zones neutres fermées.
  //
  // DEUX critères sont nécessaires, et ils ont chacun leur contre-exemple :
  //
  // 1. NETTETÉ — le damier n'a que deux tons francs (255 et 229) séparés
  //    d'arêtes vives, donc très peu de valeurs intermédiaires ; un crampon est
  //    un aplat blanc modelé par des dégradés, donc riche en intermédiaires.
  //    Mesuré ici : 6 % et 18 % pour les triangles sous les bras du tireur,
  //    contre 30 % à 56 % pour les composantes de ses chaussures.
  //
  // 2. BICHROMIE — le damier alterne ses deux tons en proportions voisines. Ce
  //    critère seul ne suffit pas, mais il est indispensable : le « TM » blanc
  //    sur la poitrine du gardien est un aplat fermé SANS dégradé, donc il
  //    passait le critère 1 et se faisait effacer. Il est quasi uniformément
  //    clair : sa part de gris est proche de zéro, très loin de l'équilibre
  //    d'un damier.
  const PART_INTERMEDIAIRE_MAX = 25;
  const PART_TON_MIN = 20;
  const TAILLE_MIN = 400;

  for (let depart = 0; depart < W * H; depart++) {
    if (vu[depart]) continue;
    const o0 = depart * C;
    if (!estDamier(data[o0], data[o0 + 1], data[o0 + 2])) continue;

    const composante = [];
    const q = [depart];
    vu[depart] = 1;
    while (q.length) {
      const p = q.pop();
      composante.push(p);
      const x = p % W, y = (p - x) / W;
      for (const n of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (n < 0 || vu[n]) continue;
        const o = n * C;
        if (estDamier(data[o], data[o + 1], data[o + 2])) { vu[n] = 1; q.push(n); }
      }
    }
    if (composante.length < TAILLE_MIN) continue;

    let intermediaires = 0, clairs = 0, gris = 0;
    for (const p of composante) {
      const v = data[p * C];
      if (v > 235 && v < 250) intermediaires++;
      else if (v >= 250) clairs++;
      else gris++;
    }
    const pct = n => (n / composante.length) * 100;
    if (pct(intermediaires) > PART_INTERMEDIAIRE_MAX) continue;      // dégradé = sujet (chaussures)
    if (pct(clairs) < PART_TON_MIN || pct(gris) < PART_TON_MIN) continue; // monochrome = sujet (logo « TM »)

    for (const p of composante) data[p * C + 3] = 0;
  }

  // Boîte englobante du contenu resté opaque.
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * C + 3] !== 0) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error(`${entree} : aucun pixel opaque après détourage`);

  // Compté sur l'alpha réel, pas sur `vu` : ce dernier marque aussi les
  // composantes examinées puis CONSERVÉES (les chaussures).
  let transparents = 0;
  for (let p = 0; p < W * H; p++) if (data[p * C + 3] === 0) transparents++;
  return {
    image: sharp(data, { raw: { width: W, height: H, channels: C } })
      .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }),
    source: `${W}×${H}`,
    recadre: `${x1 - x0 + 1}×${y1 - y0 + 1}`,
    partFond: Math.round((transparents / (W * H)) * 100)
  };
}

/**
 * @param {string} entree   JPEG fourni
 * @param {string} master   PNG pleine résolution (art-sources/)
 * @param {string} servi    PNG réduit (public/)
 * @param {[number, number]} boite  gabarit max de l'asset servi (2× le CSS)
 */
async function traiter(nom, entree, master, servi, boite) {
  const { image, source, recadre, partFond } = await detourer(entree);
  const png = await image.png({ compressionLevel: 9 }).toBuffer();
  await sharp(png).toFile(path.join(ROOT, master));

  const info = await sharp(png)
    .resize({ width: boite[0], height: boite[1], fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toFile(path.join(ROOT, servi));

  console.log(`${nom}`);
  console.log(`  source ${source} → détouré/recadré ${recadre} (${partFond} % de damier retiré)`);
  console.log(`  ${master} — master pleine résolution`);
  console.log(`  ${servi} — ${info.width}×${info.height}, ${(info.size / 1024).toFixed(1)} Ko`);
}

const [gardien, tireur] = process.argv.slice(2);
if (!gardien || !tireur) {
  console.error('usage : node tools/prepare-shootout-avatars.mjs <gardien.jpeg> <tireur.jpeg>');
  process.exit(1);
}

// Gabarits = 2× les maxima CSS (.pk-keeper 132×196, .pk-shooter 124×188), pour
// rester net en écran haute densité sans changer la mise en page : le CSS fait
// object-fit: contain, il s'adapte au ratio réel de la nouvelle illustration.
await traiter('GARDIEN', gardien, 'art-sources/shootout/gardien.png', 'public/img/shootout/keeper.png', [264, 392]);
await traiter('TIREUR', tireur, 'art-sources/shootout/tireur.png', 'public/img/shootout/shooter.png', [248, 376]);
