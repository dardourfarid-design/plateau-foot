// ===================== ASSEMBLAGE DE L'AD PROVIDER =====================
// Seul fichier de l'app qui décide quelle implémentation de régie pub est
// active. Aujourd'hui : le mock (aucun compte réseau réel avant PR 0 / #25).
//
// Pour basculer vers Google plus tard : importer googleAdSenseProvider.js
// (PR C / #28) ou googleAdManagerProvider.js (PR E / #30) et changer
// `activeProvider` ici — rien d'autre dans le code n'a à bouger, car tout
// passe par adService.js.

import * as mockAdProvider from './mockAdProvider.js';
import * as googleAdSenseProvider from './googleAdSenseProvider.js';

// Provider actif. AdSense (réel) pour le Display/bannières ; le mock reste
// disponible pour le développement hors-ligne. Le rewarded réel passera par un
// provider Ad Manager dédié quand l'unité SSV sera créée (#30).
const activeProvider = googleAdSenseProvider;
void mockAdProvider; // conservé comme référence de repli

export const isMockAdActive = activeProvider.isMock;
export const init = activeProvider.init;
export const showBanner = activeProvider.showBanner;
export const hideBanner = activeProvider.hideBanner;
export const showInterstitial = activeProvider.showInterstitial;
export const showRewarded = activeProvider.showRewarded;
export const destroy = activeProvider.destroy;
