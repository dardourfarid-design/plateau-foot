// ===================== POLICES CHARGÉES À LA DEMANDE (#309) =====================
// Le site chargeait 6 familles Google Fonts dans le <head> de l'accueil, donc
// sur le chemin critique de CHAQUE visiteur. Le recensement (#309) a montré que
// 4 d'entre elles ne servent nulle part dans l'application principale :
//
//   Anton / Archivo / Space Mono → uniquement les thèmes de l'écran de tirs au
//                                  but (--pk-display / --pk-font)
//   Fredoka                      → thèmes de tirs au but + habillage payant
//                                  « arcade-turf » (skins.css)
//
// Elles sont donc chargées ici à la demande, au moment où un écran qui en a
// besoin s'ouvre. L'accueil ne charge plus que Barlow Condensed et Space
// Grotesk.
//
// Ce module NE SUPPRIME AUCUNE police : l'identité visuelle des 4 thèmes de
// tirs au but et de l'habillage arcade est conservée à l'identique. Seul le
// MOMENT du chargement change.
//
// Effet de bord bienvenu : public/en/index.html ne chargeait déjà que 2
// familles, si bien que les thèmes de tirs au but étaient silencieusement
// dégradés en anglais. Passer par ce module rend les deux langues identiques.

// display=swap : le texte s'affiche immédiatement dans la police de repli puis
// bascule. Sur un écran de jeu déjà visible, un texte invisible le temps du
// téléchargement serait pire que la bascule.
const THEME_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Anton' +
  '&family=Archivo:wght@400;600;700;800;900' +
  '&family=Fredoka:wght@500;600;700' +
  '&family=Space+Mono:wght@700' +
  '&display=swap';

const LINK_ID = 'lazy-theme-fonts';

/**
 * Charge les polices d'habillage si elles ne le sont pas déjà. Idempotent :
 * appelable à chaque ouverture d'écran sans condition d'appel.
 * @param {Document} [doc]  injectable pour les tests.
 * @returns {boolean} true si le chargement vient d'être déclenché.
 */
export function ensureThemeFonts(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return false;
  if (doc.getElementById(LINK_ID)) return false;

  const link = doc.createElement('link');
  link.id = LINK_ID;
  link.rel = 'stylesheet';
  link.href = THEME_FONTS_HREF;
  (doc.head || doc.documentElement).appendChild(link);
  return true;
}

/** Exposé pour les tests et le garde-fou de cohérence avec index.html. */
export const THEME_FONTS_URL = THEME_FONTS_HREF;
