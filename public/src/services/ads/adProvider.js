// ===================== ASSEMBLAGE DE L'AD PROVIDER =====================
// Seul fichier de l'app qui décide quelle implémentation de régie sert quel
// format. Tout le reste passe par adService.js ; changer de régie ne touche
// donc ni l'UI ni le moteur.
//
// ROUTAGE PAR FORMAT (composite). Chaque format — banner / interstitial /
// rewarded — peut être servi par une régie différente, choisie dans
// config.ads.providers. Cela permet de garder AdSense sur les bannières tout en
// confiant l'interstitiel et le rewarded à GameMonetize « en attendant AdSense »
// (eCPM jeu supérieur, aucun seuil de trafic). Défaut rétro-compatible : si
// config.ads.providers est absent, tout va à AdSense (comportement historique).
//
// Registre des régies disponibles :
//   'adsense'      → Display DOM (bannières). Interstitiel/rewarded indisponibles.
//   'gamemonetize' → Interstitiel + rewarded sur jeu navigateur. Pas de bannière.
//   'mock'         → Développement hors-ligne (aucune vraie pub, aucun revenu).

import * as mockAdProvider from './mockAdProvider.js';
import * as googleAdSenseProvider from './googleAdSenseProvider.js';
import * as gameMonetizeProvider from './gameMonetizeProvider.js';

const REGISTRY = {
  adsense: googleAdSenseProvider,
  gamemonetize: gameMonetizeProvider,
  mock: mockAdProvider
};

// Régie par défaut quand aucun routage n'est précisé (rétro-compatibilité).
const DEFAULT_PROVIDER = googleAdSenseProvider;

function routing() {
  if (typeof window === 'undefined') return {};
  return window.__PLATEAU_FOOT_CONFIG__?.ads?.providers || {};
}

// Régie servant un format donné. Nom inconnu ou absent → régie par défaut.
function providerFor(format) {
  const name = routing()[format];
  return (name && REGISTRY[name]) || DEFAULT_PROVIDER;
}

// L'ensemble des régies effectivement mobilisées (routage + défaut), dédupliqué :
// init() et destroy() doivent toucher chaque régie active une seule fois.
function activeProviders() {
  const set = new Set([
    providerFor('banner'),
    providerFor('interstitial'),
    providerFor('rewarded')
  ]);
  return [...set];
}

// isMock : vrai seulement si TOUTES les régies actives sont factices (sert de
// garde-fou aux tests/diagnostics : « aucune vraie pub en jeu »).
export const isMockAdActive = activeProviders().every(p => p.isMock === true);

// init : prépare toutes les régies actives. true si AU MOINS une est prête
// (les autres formats dégraderont proprement en « indisponible »).
export async function init(context) {
  const results = await Promise.all(
    activeProviders().map(p => Promise.resolve().then(() => p.init(context)).catch(() => false))
  );
  return results.some(Boolean);
}

export function showBanner(slot) { return providerFor('banner').showBanner(slot); }
export function hideBanner(slot) { return providerFor('banner').hideBanner(slot); }
export function showInterstitial() { return providerFor('interstitial').showInterstitial(); }
export function showRewarded(context) { return providerFor('rewarded').showRewarded(context); }

export function destroy() {
  for (const p of activeProviders()) {
    try { p.destroy(); } catch { /* régie sans destroy : ignorée */ }
  }
}
