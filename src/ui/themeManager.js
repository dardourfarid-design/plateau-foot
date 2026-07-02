// ===================== THEME MANAGER =====================
// Applique un thème (couleurs, etc.) aux variables CSS du document.
// Reste volontairement séparé de la logique d'achat : ce module ne sait pas
// si un thème est payant ou débloqué, il sait seulement "afficher tel thème".
// C'est l'UI (themeStore.js / l'écran de sélection) qui décide si un thème
// est sélectionnable selon les achats du joueur.

const CSS_VARS_MAP = {
  vertTerrain: '--vert-terrain',
  vertTerrainClair: '--vert-terrain-clair',
  bleuEquipe: '--bleu-equipe',
  rougeEquipe: '--rouge-equipe',
  accent: '--terre'
};

export const DEFAULT_THEME_ID = 'classique';

/**
 * Applique la config d'un thème (objet plat clé/valeur hex) aux variables CSS
 * du document. Les clés absentes de la config gardent leur valeur CSS actuelle.
 *
 * En plus des couleurs, un thème peut porter une clé `skin` (ex: "stadium-night")
 * qui déclenche un habillage complet du plateau défini dans public/skins.css.
 * Les thèmes purement couleur n'ont pas cette clé : applySkin() retire alors
 * tout habillage précédent, on retombe sur le rendu par défaut.
 */
export function applyTheme(themeConfig) {
  const config = themeConfig || {};
  const root = document.documentElement;
  Object.entries(CSS_VARS_MAP).forEach(([configKey, cssVar]) => {
    if (config[configKey]) {
      root.style.setProperty(cssVar, config[configKey]);
    }
  });
  applySkin(config.skin);
}

/**
 * Active un habillage de plateau en posant la classe `skin-<id>` sur <body>,
 * après avoir retiré tout habillage précédent. Sans argument (thème couleur),
 * ne laisse aucune classe skin-* : le plateau reprend son rendu par défaut.
 * Les styles correspondants vivent dans public/skins.css.
 */
export function applySkin(skinId) {
  const body = document.body;
  if (!body) return;
  Array.from(body.classList).forEach((cls) => {
    if (cls.indexOf('skin-') === 0) body.classList.remove(cls);
  });
  if (skinId) body.classList.add('skin-' + skinId);
}

/**
 * Détermine si un thème donné est accessible à un joueur : gratuit,
 * ou présent dans la liste de ses achats complétés.
 */
export function isThemeUnlocked(theme, purchasedThemeIds) {
  if (theme.price_cents === 0) return true;
  return purchasedThemeIds.includes(theme.id);
}

/**
 * Formatte un prix en centimes vers un affichage lisible (ex: 199 -> "1,99 €").
 */
export function formatPrice(amountCents, currency = 'eur') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(amountCents / 100);
}
