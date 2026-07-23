// ===================== PONT TCF → SIGNAL DE CONSENTEMENT INTERNE =====================
// Traduit le verdict d'un CMP certifié IAB TCF (v2.2/v2.3) vers le signal
// first-party de advertisingConsentService, seule source de vérité consultée
// par adService. Le reste du code n'a ainsi JAMAIS à connaître TCF : il
// interroge hasAdvertisingConsent(), point.
//
// POURQUOI CE MODULE EXISTE. Diagnostic en production : sans chaîne de
// consentement TCF, `__tcfapi('getTCData')` renvoyait success:false et la pile
// publicitaire Google (GPT/IMA, utilisée par GameMonetize) se chargeait en
// `gdpr=1` sans signal — donc AUCUNE pub servie, et un conteneur noir plein
// écran laissé à l'abandon. Depuis janvier 2024, Google exige un CMP CERTIFIÉ
// pour diffuser en EEE/UK/Suisse : ce pont est la condition d'existence des
// revenus publicitaires, pas un confort.
//
// Volontairement séparé du chargeur de CMP (inmobiCmp.js) : la logique de
// mapping est pure et testable sans DOM ni réseau, alors que le chargeur, lui,
// dépend d'un vendeur et d'un identifiant de compte.

import { setAdvertisingConsent } from '../advertisingConsentService.js';

// Google Advertising Products : vendor 755 au registre GVL de l'IAB. C'est le
// vendeur qui compte ici, toute la demande passant par la pile Google.
export const GOOGLE_VENDOR_ID = 755;

/**
 * Le consentement est-il accordé, d'après un objet TCData ?
 * Retourne true / false, ou null si l'on ne peut pas encore conclure.
 *
 * Règles :
 *  - gdprApplies === false  → hors périmètre RGPD, rien à recueillir → accordé.
 *  - finalité 1 (stocker/accéder à des informations sur l'appareil) refusée
 *    → refusé : sans elle aucune régie ne peut fonctionner.
 *  - vendeur Google (755) refusé → refusé : notre demande passe par sa pile.
 *
 * @param {object|null} tcData
 * @returns {boolean|null}
 */
export function grantedFromTcData(tcData) {
  if (!tcData) return null;
  if (tcData.gdprApplies === false) return true;

  const purposes = tcData.purpose && tcData.purpose.consents;
  if (!purposes) return null;                 // structure incomplète : indécis
  if (!purposes[1]) return false;             // socle refusé → aucune pub

  // Le refus explicite de Google est décisif ; son absence d'information ne
  // l'est pas (certains CMP ne détaillent pas les vendeurs avant l'action).
  const vendors = tcData.vendor && tcData.vendor.consents;
  if (vendors && vendors[GOOGLE_VENDOR_ID] === false) return false;

  return true;
}

/**
 * Un statut d'événement TCF permet-il de conclure ? On ignore les états
 * intermédiaires (`cmpuishown`) pour ne pas figer un refus alors que
 * l'utilisateur n'a pas encore répondu.
 */
export function isConclusiveStatus(eventStatus) {
  return eventStatus === 'tcloaded' || eventStatus === 'useractioncomplete';
}

/**
 * Branche l'écoute du CMP et reflète chaque verdict dans le signal interne.
 * Idempotent et sûr hors navigateur (aucun __tcfapi → no-op).
 *
 * @param {(granted: boolean) => void} [apply] injection pour les tests
 * @returns {boolean} true si l'écoute a pu être posée.
 */
export function bridgeTcfConsent(apply = setAdvertisingConsent) {
  if (typeof window === 'undefined' || typeof window.__tcfapi !== 'function') return false;
  try {
    window.__tcfapi('addEventListener', 2, (tcData, success) => {
      if (!success || !tcData) return;
      if (!isConclusiveStatus(tcData.eventStatus)) return;
      const granted = grantedFromTcData(tcData);
      if (granted === null) return;
      // setAdvertisingConsent est idempotent : il ne notifie qu'au changement.
      Promise.resolve(apply(granted)).catch(() => { /* jamais bloquant */ });
    });
    return true;
  } catch {
    return false;
  }
}
