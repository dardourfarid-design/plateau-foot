// ===================== SIGNAL DE CONSENTEMENT ANALYTICS =====================
// Épic monétisation publicitaire, PR G (issue #32).
//
// Même principe que advertisingConsentService : un signal LOCAL (localStorage),
// synchrone, interrogeable même pour un visiteur anonyme, qui décide si l'on a
// le droit d'émettre nos événements de mesure (dont les événements pub).
//
// Plausible (cookieless) est chargé sans bannière côté projet, mais nos
// ÉVÉNEMENTS PERSONNALISÉS de mesure respectent, eux, ce consentement : on
// n'émet rien si l'utilisateur a explicitement refusé l'analytics.

import { recordConsent, CONSENT_PURPOSES } from './consentService.js';

export const ANALYTICS_CONSENT_KEY = 'tm_analytics_consent_v1';

export const ANALYTICS_CONSENT = Object.freeze({
  GRANTED: 'granted',
  DENIED: 'denied',
  UNKNOWN: null
});

function makeStore() {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__tm_probe_an__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch { /* indisponible → mémoire */ }
  const mem = new Map();
  return {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: k => mem.delete(k)
  };
}

const store = makeStore();

export function getAnalyticsConsent() {
  const raw = store.getItem(ANALYTICS_CONSENT_KEY);
  if (raw === ANALYTICS_CONSENT.GRANTED || raw === ANALYTICS_CONSENT.DENIED) return raw;
  return ANALYTICS_CONSENT.UNKNOWN;
}

/**
 * Peut-on émettre des événements de mesure ? Autorisé sauf refus explicite
 * (cohérent avec le reste : `null` indécis = autorisé, l'outil étant cookieless).
 */
export function isAnalyticsAllowed() {
  return getAnalyticsConsent() !== ANALYTICS_CONSENT.DENIED;
}

/**
 * Enregistre le choix analytics : signal local d'abord (gating), puis reflet
 * serveur best-effort si connecté.
 */
export async function setAnalyticsConsent(granted) {
  store.setItem(ANALYTICS_CONSENT_KEY, granted ? ANALYTICS_CONSENT.GRANTED : ANALYTICS_CONSENT.DENIED);
  try {
    await recordConsent(CONSENT_PURPOSES.ANALYTICS, granted);
  } catch (err) {
    console.debug('Consentement analytics non synchronisé côté serveur :', err?.message || err);
  }
}
