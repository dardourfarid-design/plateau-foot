// ===================== ANALYTICS PUBLICITAIRE =====================
// Épic monétisation publicitaire, PR G (issue #32).
//
// Émet les événements de mesure liés à la pub via Plausible (déjà chargé,
// cookieless). TOUJOURS gated par le consentement analytics : rien n'est émis
// si l'utilisateur a explicitement refusé (isAnalyticsAllowed()).
//
// Ces événements alimentent les KPIs de l'épic : impressions, clics, opt-in et
// complétion des vidéos récompensées, choix de consentement pub. Le reporting
// REVENUS (eCPM, fill rate, RPM) se lit lui côté AdSense/Ad Manager — voir
// docs/monetization-ads.md ; il n'a pas de pendant client.

import { isAnalyticsAllowed } from '../analyticsConsentService.js';

// Transport injectable (tests). Par défaut : Plausible s'il est présent.
let _transport = (name, props) => {
  if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
    window.plausible(name, props ? { props } : undefined);
  }
};

/** Pour les tests : remplace le transport et renvoie une fonction de restauration. */
export function _setTransport(fn) {
  const prev = _transport;
  _transport = fn;
  return () => { _transport = prev; };
}

/** Émet un événement de mesure, uniquement si l'analytics est autorisé. */
export function track(name, props) {
  if (!isAnalyticsAllowed()) return false;
  try {
    _transport(name, props);
    return true;
  } catch {
    return false;
  }
}

// --- Helpers nommés (une seule source de vérité pour les noms d'événements) ---
export const trackAdImpression = (format, slot) => track('ad_impression', { format, slot });
export const trackAdClick = (format, slot) => track('ad_click', { format, slot });
export const trackRewardedOptIn = () => track('rewarded_opt_in');
export const trackRewardedCompleted = (completed) =>
  track('rewarded_result', { completed: completed ? 'yes' : 'no' });
export const trackConsentChoice = (purpose, granted) =>
  track('consent_choice', { purpose, granted: granted ? 'granted' : 'denied' });
