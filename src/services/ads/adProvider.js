// ===================== ASSEMBLAGE DE L'AD PROVIDER =====================
// Seul fichier de l'app qui décide quelle implémentation de régie pub est
// active. Aujourd'hui : le mock (aucun compte réseau réel avant PR 0 / #25).
//
// Pour basculer vers Google plus tard : importer googleAdSenseProvider.js
// (PR C / #28) ou googleAdManagerProvider.js (PR E / #30) et changer
// `activeProvider` ici — rien d'autre dans le code n'a à bouger, car tout
// passe par adService.js.

import * as mockAdProvider from './mockAdProvider.js';

const activeProvider = mockAdProvider;

export const isMockAdActive = activeProvider.isMock;
export const init = activeProvider.init;
export const showBanner = activeProvider.showBanner;
export const hideBanner = activeProvider.hideBanner;
export const showInterstitial = activeProvider.showInterstitial;
export const showRewarded = activeProvider.showRewarded;
export const destroy = activeProvider.destroy;
