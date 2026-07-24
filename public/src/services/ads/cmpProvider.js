// ===================== ASSEMBLAGE DU CMP =====================
// Seul endroit qui décide QUEL CMP recueille le consentement. Même philosophie
// que adProvider.js pour les régies : l'appelant (main.js) ne connaît qu'un
// point d'entrée, loadCmp(), et ignore le vendeur.
//
// RÈGLE ABSOLUE : UN SEUL CMP ACTIF. Deux CMP simultanés = deux bandeaux et des
// chaînes TCF concurrentes, donc un consentement invalide et une diffusion
// bloquée. Ce routage garantit l'exclusivité.
//
// 'inmobi' → CMP certifié Google, indépendant d'AdSense. Couvre GameMonetize
//            MAINTENANT et AdSense plus tard : à la validation d'AdSense on ne
//            rallume PAS Funding Choices, on reste ici.
// 'google' → Funding Choices (historique). Ne fonctionne qu'avec un compte
//            AdSense validé — d'où l'impasse qui a motivé le changement.

import { loadInMobiCmp } from './inmobiCmp.js';
import { loadConsentMessaging } from './googleCmp.js';

/**
 * Charge le CMP configuré. No-op sûr si le CMP est désactivé ou mal configuré.
 * @param {{ enabled?: boolean, provider?: string, publisherId?: string, inmobi?: object }} cmp
 * @returns {boolean} true si un CMP a effectivement été chargé.
 */
export function loadCmp(cmp) {
  if (!cmp || cmp.enabled !== true) return false;
  const provider = cmp.provider || 'google';
  if (provider === 'inmobi') return loadInMobiCmp(cmp.inmobi);
  if (provider === 'google') return loadConsentMessaging(cmp.publisherId);
  return false;
}
