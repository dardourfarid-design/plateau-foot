// ===================== SERVICE PUBLICITÉ (ORCHESTRATION) =====================
// Épic monétisation publicitaire, PR B (issue #27).
//
// Point d'entrée UNIQUE de la pub pour le reste de l'app (PR C bannières,
// PR D interstitiels, PR E rewarded). C'est ici — et nulle part ailleurs —
// que se prend la décision « a-t-on le droit d'afficher une pub maintenant ? ».
// Les providers (mock, plus tard AdSense/Ad Manager) ne font qu'exécuter ;
// ils ne décident jamais.
//
// Verrous cumulatifs, tous requis pour qu'une pub s'affiche :
//   1. kill switch      : config.ads.enabled === true
//   2. consentement     : pas de refus explicite (CMP Google autoritaire, #26)
//   3. non payant       : !isAdFree() (pass actif = zéro pub, PR F / #31)
//   4. rollout           : client dans le pourcentage déployé (PR I / #34)
//
// Aucun SDK pub n'est chargé tant que ces conditions ne sont pas réunies.

import * as provider from './adProvider.js';
import { getAdvertisingConsent, hasAdvertisingConsent, AD_CONSENT, onAdvertisingConsentChange } from '../advertisingConsentService.js';
import { getMyActivePass } from '../passService.js';
import { trackAdImpression, track } from './adAnalytics.js';
import { bucket } from './abTest.js';

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
 * Rafraîchit le statut « sans pub » depuis le backend. Règle du perk (PR F,
 * #31) : TOUT pass actif rend l'expérience sans publicité. À appeler après
 * connexion/déconnexion ou après un achat de pass (l'activation passe par le
 * webhook Stripe, avec un léger délai — d'où des rappels répétés côté UI).
 * Best-effort : en cas d'erreur on retombe sur false (on préfère montrer la
 * pub que priver le modèle éco d'un revenu par erreur — le vrai payant sera
 * re-résolu au refresh suivant).
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
 * Décision pure « la pub est-elle autorisée ? » à partir des trois entrées
 * booléennes. Extraite pour être testable sans backend ni DOM.
 * @param {boolean} enabled        kill switch global (config.ads.enabled)
 * @param {boolean} consentBlocked le consentement fait-il obstacle ?
 * @param {boolean} adFree         droit payant actif (pass) => aucune pub
 */
export function evaluateAdsAllowed(enabled, consentBlocked, adFree) {
  return enabled === true && !consentBlocked && !adFree;
}

/**
 * Le prédicat central : la pub est-elle autorisée à l'instant T ?
 * Synchrone, sûr, sans effet de bord — appelable avant chaque affichage.
 *
 * CONSENTEMENT REQUIS (durci). Auparavant on n'excluait que le refus EXPLICITE,
 * en déléguant au CMP Google le soin de brider — un modèle hérité de Funding
 * Choices. Il contredisait la règle d'or de advertisingConsentService (« ne
 * JAMAIS charger un SDK pub tant que hasAdvertisingConsent() n'est pas true ») :
 * un état indécis suffisait à charger la régie AVANT toute réponse au bandeau.
 *
 * Depuis le passage à un CMP certifié dont le verdict TCF est reflété dans le
 * signal interne (tcfConsent.js), on exige un accord POSITIF. Conséquences :
 * aucun SDK publicitaire n'est chargé avant consentement (conformité), et
 * quand il l'est, le consentement est déjà disponible pour la requête d'annonce.
 */
export function areAdsAllowed() {
  return evaluateAdsAllowed(
    adsConfig().enabled === true,
    !hasAdvertisingConsent(),
    _adFree
  ) && isInRollout();
}

/**
 * Rollout progressif (PR I, #34) : n'expose la pub qu'à un pourcentage stable
 * de clients. `config.ads.rolloutPercent` va de 0 (personne) à 100 (tout le
 * monde, défaut). Permet un déploiement 5 % → 100 % en changeant un seul
 * nombre, réversible instantanément (repasser à 0 coupe sans redéploiement de
 * code). Le bucket est stable par client (voir abTest).
 */
export function isInRollout() {
  const pct = adsConfig().rolloutPercent;
  if (pct === undefined || pct === null) return true; // défaut : 100 %
  if (pct <= 0) return false;
  if (pct >= 100) return true;
  return bucket('ads_rollout') < pct;
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
  // Accord POSITIF exigé : ni refus, ni indécis. Au premier chargement le
  // bandeau n'a pas encore été traité → on n'initialise rien, et c'est
  // l'abonnement au consentement (bas de fichier) qui relancera après accord.
  if (!hasAdvertisingConsent()) return false;
  if (_initialized) return true;
  // Dégradation gracieuse : si le SDK ne charge pas (bloqueur de pub, réseau,
  // no-fill), on ne se marque PAS initialisé — un prochain appel pourra
  // retenter — et on trace l'indisponibilité sans jamais casser le jeu.
  const ok = await provider.init({ consent: true });
  if (!ok) { track('ads_unavailable'); return false; }
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
  const ok = await provider.showBanner(slot);
  if (ok) trackAdImpression('banner', slot); // gated par le consentement analytics
  return ok;
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
  const res = await provider.showInterstitial();
  if (res?.shown) trackAdImpression('interstitial', null);
  return res;
}

/**
 * Affiche une vidéo récompensée (opt-in). La récompense n'est accordable que
 * si { completed:true }. NB : l'octroi effectif (coins) sera validé côté
 * serveur en PR E (#30) — ce service ne fait que piloter l'affichage.
 * @returns {Promise<{ completed: boolean, reason?: string }>}
 */
export async function showRewarded(context = {}) {
  if (!isFormatAllowed('rewarded')) return { completed: false, reason: 'ads-not-allowed' };
  if (!(await ensureReady())) return { completed: false, reason: 'init-failed' };
  // context.userId sera transmis au réseau comme `custom_data` : c'est ce que
  // le SSV renverra pour identifier le joueur à créditer côté serveur.
  return provider.showRewarded(context);
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

// Réaction au consentement en cours de session.
//  - refus  → on coupe immédiatement (opt-out dur).
//  - accord → on initialise MAINTENANT. Indispensable depuis que l'accord
//    positif est requis : au chargement de la page le bandeau n'a pas encore
//    été traité, donc initAds() a renoncé. Sans ce rappel, plus aucune pub ne
//    se chargerait de la session, même après acceptation.
onAdvertisingConsentChange((value) => {
  if (value === AD_CONSENT.DENIED) { resetAds(); return; }
  if (value === AD_CONSENT.GRANTED) initAds().catch(() => { /* jamais bloquant */ });
});
