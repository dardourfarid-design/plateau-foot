// ===================== SERVICE PUBLICITÉ (ORCHESTRATION) =====================
// Épic monétisation publicitaire, PR B (issue #27).
//
// Point d'entrée UNIQUE de la pub pour le reste de l'app (PR C bannières,
// PR D interstitiels, PR E rewarded). C'est ici — et nulle part ailleurs —
// que se prend la décision « a-t-on le droit d'afficher une pub maintenant ? ».
// Les providers (mock, plus tard AdSense/Ad Manager) ne font qu'exécuter ;
// ils ne décident jamais.
//
// Trois verrous cumulatifs, tous requis pour qu'une pub s'affiche :
//   1. kill switch      : config.ads.enabled === true
//   2. consentement     : hasAdvertisingConsent() (RGPD, PR A / #26)
//   3. non payant       : !isAdFree() (pass actif = zéro pub, PR F / #31)
//
// Aucun SDK pub n'est chargé tant que ces trois conditions ne sont pas réunies.

import * as provider from './adProvider.js';
import { hasAdvertisingConsent, onAdvertisingConsentChange } from '../advertisingConsentService.js';
import { getMyActivePass } from '../passService.js';

let _initialized = false;
let _adFree = false;

function adsConfig() {
  if (typeof window === 'undefined') return {};
  return window.__PLATEAU_FOOT_CONFIG__?.ads || {};
}

/**
 * true si l'utilisateur ne doit voir AUCUNE pub car il a un droit payant
 * actif (pass). Lecture synchrone d'un état mis en cache par
 * refreshAdFreeStatus() ; par défaut false (aucun droit connu).
 * Consommé aussi tel quel par PR F (#31).
 */
export function isAdFree() {
  return _adFree;
}

/**
 * Rafraîchit le statut « sans pub » depuis le backend (pass actif). À appeler
 * après connexion/déconnexion ou après un achat de pass. Best-effort : en cas
 * d'erreur on retombe sur false (on préfère montrer la pub que priver le
 * modèle éco d'un revenu par erreur — le vrai payant sera re-résolu au refresh
 * suivant).
 */
export async function refreshAdFreeStatus() {
  try {
    _adFree = !!(await getMyActivePass());
  } catch {
    _adFree = false;
  }
  return _adFree;
}

/**
 * Le prédicat central : la pub est-elle autorisée à l'instant T ?
 * Synchrone, sûr, sans effet de bord — appelable avant chaque affichage.
 */
export function areAdsAllowed() {
  return adsConfig().enabled === true && hasAdvertisingConsent() && !_adFree;
}

/**
 * La pub est-elle autorisée ET le format demandé activé ?
 * Un format est actif par défaut quand la pub est activée ; il faut le mettre
 * explicitement à false dans la config pour le couper (rollout progressif, A/B).
 * @param {'banner'|'interstitial'|'rewarded'} format
 */
export function isFormatAllowed(format) {
  return areAdsAllowed() && adsConfig()[format] !== false;
}

/**
 * Initialise la couche pub si (et seulement si) elle est autorisée. Idempotent.
 * Ne charge le SDK du provider qu'une fois les trois verrous levés.
 * @returns {Promise<boolean>} true si la pub est prête à être affichée.
 */
export async function initAds() {
  if (adsConfig().enabled !== true) return false;   // kill switch global
  await refreshAdFreeStatus();
  if (_adFree) return false;                          // payant : on n'initialise rien
  if (!hasAdvertisingConsent()) return false;         // pas de consentement : aucun SDK
  if (_initialized) return true;
  await provider.init({ consent: true });
  _initialized = true;
  return true;
}

async function ensureReady() {
  if (!areAdsAllowed()) return false;
  if (_initialized) return true;
  return initAds();
}

/**
 * Affiche une bannière dans l'emplacement `slot` (écran hors-jeu uniquement).
 * @returns {Promise<boolean>}
 */
export async function showBanner(slot) {
  if (!isFormatAllowed('banner')) return false;
  if (!(await ensureReady())) return false;
  return provider.showBanner(slot);
}

/** Retire la bannière d'un emplacement. Sûr même si rien n'est affiché. */
export function hideBanner(slot) {
  return provider.hideBanner(slot);
}

/**
 * Affiche un interstitiel (entre deux parties). Ne bloque jamais le jeu :
 * renvoie { shown:false } si la pub n'est pas autorisée ou indisponible.
 * @returns {Promise<{ shown: boolean }>}
 */
export async function showInterstitial() {
  if (!isFormatAllowed('interstitial')) return { shown: false };
  if (!(await ensureReady())) return { shown: false };
  return provider.showInterstitial();
}

/**
 * Affiche une vidéo récompensée (opt-in). La récompense n'est accordable que
 * si { completed:true }. NB : l'octroi effectif (coins) sera validé côté
 * serveur en PR E (#30) — ce service ne fait que piloter l'affichage.
 * @returns {Promise<{ completed: boolean, reason?: string }>}
 */
export async function showRewarded() {
  if (!isFormatAllowed('rewarded')) return { completed: false, reason: 'ads-not-allowed' };
  if (!(await ensureReady())) return { completed: false, reason: 'init-failed' };
  return provider.showRewarded();
}

/**
 * Réinitialise complètement la couche pub : détruit les ressources du provider
 * et remet l'état à zéro. À appeler à la déconnexion ou si le consentement pub
 * est retiré en cours de session (le SDK ne doit alors plus rien afficher).
 */
export function resetAds() {
  try { provider.destroy(); } catch { /* provider sans destroy : ignoré */ }
  _initialized = false;
  _adFree = false;
}

// Révocation du consentement en cours de session → on coupe immédiatement.
// (L'octroi, lui, est piloté explicitement par l'app via initAds/showX.)
onAdvertisingConsentChange((value) => {
  if (value !== 'granted') resetAds();
});
