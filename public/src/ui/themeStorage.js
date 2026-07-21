// ============ MÉMORISATION DU THÈME ACTIF (localStorage) ============
// Extrait de main.js (#324, lot 2) : bloc entièrement autonome, sans lien avec
// l'orchestration de la partie. Il ne connaît que localStorage et l'identifiant
// du thème par défaut.
//
// Tous les accès sont sous try/catch : le stockage local peut être indisponible
// (navigation privée stricte, quota plein, contexte embarqué). Dans ce cas
// l'application reste parfaitement jouable, simplement sans mémoriser le thème
// d'une visite à l'autre — ce n'est pas une erreur à remonter au joueur.
// Bénéfice secondaire : sous Node (suite de tests), `window` n'existe pas et le
// ReferenceError est capturé comme le reste.

import { DEFAULT_THEME_ID } from './themeManager.js';

const ACTIVE_THEME_STORAGE_KEY = 'plateau-foot:active-theme';
const ACTIVE_THEME_CONFIG_STORAGE_KEY = 'plateau-foot:active-theme-config';

// Thèmes retirés du catalogue (désactivés en base ou supprimés du catalogue
// de secours hors-ligne) mais qui peuvent rester mémorisés dans le
// localStorage d'un joueur qui les avait sélectionnés avant leur retrait.
// Sans ce garde-fou, ce joueur continuerait à voir l'ancien thème appliqué
// indéfiniment au chargement, même si la boutique ne le propose plus —
// c'est exactement ce qui s'est produit avec "neige" (vert-terrain
// quasi-blanc, confondu avec un plateau vide/bug d'affichage).
const RETIRED_THEME_IDS = ['neige'];

export function loadSavedThemeId() {
  try {
    const savedId = window.localStorage.getItem(ACTIVE_THEME_STORAGE_KEY);
    if (!savedId || RETIRED_THEME_IDS.includes(savedId)) return DEFAULT_THEME_ID;
    return savedId;
  } catch (err) {
    return DEFAULT_THEME_ID;
  }
}

export function loadSavedThemeConfig() {
  try {
    const savedId = window.localStorage.getItem(ACTIVE_THEME_STORAGE_KEY);
    if (savedId && RETIRED_THEME_IDS.includes(savedId)) return null; // retombe sur le défaut CSS
    const raw = window.localStorage.getItem(ACTIVE_THEME_CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

export function saveActiveTheme(themeId, config) {
  try {
    window.localStorage.setItem(ACTIVE_THEME_STORAGE_KEY, themeId);
    window.localStorage.setItem(ACTIVE_THEME_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    // Pas grave si on ne peut pas persister : l'app reste fonctionnelle,
    // juste sans mémorisation du thème entre deux visites.
  }
}
