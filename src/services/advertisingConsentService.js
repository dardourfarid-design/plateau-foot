// ===================== SIGNAL DE CONSENTEMENT PUBLICITAIRE =====================
// Épic monétisation publicitaire, PR A (issue #26).
//
// Ce module est la SOURCE DE VÉRITÉ qui autorise (ou non) le chargement des
// SDK publicitaires côté client. Il est volontairement séparé de
// consentService.js pour une raison structurante :
//
//   - consentService.js parle à Supabase (RPC) → ne fonctionne que pour un
//     utilisateur CONNECTÉ, et de façon asynchrone.
//   - La pub, elle, peut s'afficher à des visiteurs ANONYMES, et la décision
//     de charger un SDK doit être prise SYNCHRONEMENT, avant tout appel réseau.
//
// D'où un signal local (localStorage) interrogeable instantanément, valable
// connecté comme anonyme. Quand l'utilisateur est connecté, on reflète aussi
// le choix côté serveur via consentService (trace/preuve RGPD), mais le
// serveur n'est jamais sur le chemin critique du gating.
//
// Règle d'or consommée par PR B/C/D/E : ne JAMAIS charger un SDK pub tant que
// hasAdvertisingConsent() n'est pas true.

import { recordConsent, CONSENT_PURPOSES } from './consentService.js';

export const ADVERTISING_CONSENT_KEY = 'tm_ads_consent_v1';

// États possibles du signal. `null` = pas encore demandé → aucune pub.
export const AD_CONSENT = Object.freeze({
  GRANTED: 'granted',
  DENIED: 'denied',
  UNKNOWN: null
});

// Abstraction de stockage : localStorage dans le navigateur, repli en mémoire
// sous Node/SSR (et en navigation privée where localStorage throws). Garantit
// que le module est importable et testable hors DOM.
function makeStore() {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__tm_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch { /* localStorage indisponible (privé, quota, SSR) → repli mémoire */ }
  const mem = new Map();
  return {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: k => mem.delete(k)
  };
}

const store = makeStore();
const listeners = new Set();

/**
 * Renvoie l'état brut du consentement pub : 'granted' | 'denied' | null.
 * `null` signifie "jamais recueilli" → aucune pub ne doit charger.
 */
export function getAdvertisingConsent() {
  const raw = store.getItem(ADVERTISING_CONSENT_KEY);
  if (raw === AD_CONSENT.GRANTED || raw === AD_CONSENT.DENIED) return raw;
  return AD_CONSENT.UNKNOWN;
}

/**
 * Le seul prédicat que la couche pub doit interroger avant de charger un SDK.
 * Synchrone, sûr, jamais bloquant.
 */
export function hasAdvertisingConsent() {
  return getAdvertisingConsent() === AD_CONSENT.GRANTED;
}

/**
 * Vrai tant que l'utilisateur n'a pas fait de choix : sert à décider s'il faut
 * (re)présenter le bandeau de consentement pub.
 */
export function isAdvertisingConsentUndecided() {
  return getAdvertisingConsent() === AD_CONSENT.UNKNOWN;
}

/**
 * Enregistre le choix (accepté/refusé) et le reflète côté serveur si l'on est
 * connecté. Le stockage local est TOUJOURS écrit en premier (gating anonyme),
 * la synchro serveur est best-effort et ne doit jamais faire échouer le choix.
 *
 * @param {boolean} granted
 * @returns {Promise<void>}
 */
export async function setAdvertisingConsent(granted) {
  const value = granted ? AD_CONSENT.GRANTED : AD_CONSENT.DENIED;
  const changed = store.getItem(ADVERTISING_CONSENT_KEY) !== value;
  store.setItem(ADVERTISING_CONSENT_KEY, value);
  if (changed) notify(value);

  // Reflet serveur pour la preuve RGPD. Best-effort : une erreur (hors ligne,
  // non connecté) n'invalide pas le consentement local déjà appliqué.
  try {
    await recordConsent(CONSENT_PURPOSES.ADVERTISING, granted);
  } catch (err) {
    // Non connecté ou réseau indisponible : normal pour un visiteur anonyme.
    console.debug('Consentement pub non synchronisé côté serveur :', err?.message || err);
  }
}

/**
 * S'abonne aux changements du signal. Retourne une fonction de désabonnement.
 * Utile pour que la couche pub réagisse à une révocation en cours de session.
 */
export function onAdvertisingConsentChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify(value) {
  for (const cb of listeners) {
    try { cb(value); } catch (err) { console.error('Listener consentement pub :', err); }
  }
}

// ---------------------------------------------------------------------------
// Point d'intégration du CMP certifié Google (IAB TCF v2.2).
//
// La diffusion de pub Google en EEE exige un CMP certifié. Son activation
// dépend d'un publisher ID (compte AdSense/Ad Manager) qui sera fourni en
// PR 0 (issue #25) via window.__PLATEAU_FOOT_CONFIG__.ads.cmp. Tant que la
// config n'est pas renseignée, on reste sur le recueil first-party existant
// (cases à cocher RGPD) et cette fonction est un no-op sûr.
//
// Quand le CMP Google sera branché, c'est LUI qui appellera
// setAdvertisingConsent() en fonction du TC string, afin que le reste du code
// n'ait jamais à connaître les détails de TCF : il n'interroge que
// hasAdvertisingConsent().
// ---------------------------------------------------------------------------
export function initAdvertisingCmp(config) {
  const cmp = config?.ads?.cmp;
  if (!cmp?.enabled || !cmp?.publisherId) {
    // Pas de CMP configuré : gating assuré par le signal first-party.
    return false;
  }
  // Le chargement effectif du script CMP Google (Funding Choices) sera
  // implémenté ici lorsque le publisherId sera disponible (PR 0). Il devra,
  // à réception du consentement, appeler setAdvertisingConsent(...).
  return true;
}
