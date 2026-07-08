// ===================== PLAFOND DE FRÉQUENCE INTERSTITIEL =====================
// Épic monétisation publicitaire, PR D (issue #29).
//
// Un interstitiel mal dosé est le format le plus destructeur pour la
// rétention. Ce module encapsule LA politique de fréquence, séparée de
// l'affichage (adService) : un interstitiel n'est éligible que si
//   (a) au moins N matchs se sont écoulés depuis le dernier affiché, ET
//   (b) un délai de garde (cooldown) s'est écoulé depuis le dernier affiché.
//
// L'état (compteur de matchs, horodatage du dernier affichage) est persisté
// côté client (localStorage), donc le plafond survit à un rechargement de page.
// Les seuils sont lus dans la config (rollout / A-B), avec des valeurs par
// défaut prudentes.

import { pick } from './abTest.js';

const COUNTER_KEY = 'tm_ads_intl_count_v1';
const LAST_SHOWN_KEY = 'tm_ads_intl_last_v1';

// Valeurs par défaut si la config ne précise rien : 1 interstitiel tous les
// 3 matchs, jamais deux à moins de 3 minutes d'intervalle.
const DEFAULT_EVERY_N = 3;
const DEFAULT_COOLDOWN_MS = 3 * 60 * 1000;

// Même abstraction de stockage que advertisingConsentService : localStorage
// en navigateur, repli mémoire sous Node/SSR/navigation privée → testable.
function makeStore() {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__tm_probe_intl__';
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

function readInt(key) {
  const n = parseInt(store.getItem(key), 10);
  return Number.isFinite(n) ? n : 0;
}

function policy() {
  const ads = (typeof window !== 'undefined' && window.__PLATEAU_FOOT_CONFIG__?.ads) || {};

  // A/B : si une expérience liste plusieurs valeurs de fréquence, on en choisit
  // une de façon stable par client (PR H). Sinon, valeur de config, sinon défaut.
  let everyN = DEFAULT_EVERY_N;
  const variants = ads.experiments?.interstitialEveryN;
  if (Array.isArray(variants) && variants.length > 0) {
    const chosen = pick('interstitial_everyN', variants);
    if (Number.isFinite(chosen) && chosen > 0) everyN = chosen;
  } else if (Number.isFinite(ads.interstitialEveryNGames) && ads.interstitialEveryNGames > 0) {
    everyN = ads.interstitialEveryNGames;
  }

  const cooldownMs = Number.isFinite(ads.interstitialCooldownMs) && ads.interstitialCooldownMs >= 0
    ? ads.interstitialCooldownMs : DEFAULT_COOLDOWN_MS;
  return { everyN, cooldownMs };
}

/** À appeler quand un match se termine réellement (une seule fois par match). */
export function recordMatchEnd() {
  store.setItem(COUNTER_KEY, String(readInt(COUNTER_KEY) + 1));
}

/**
 * L'interstitiel est-il éligible maintenant ? Décision de POLITIQUE uniquement
 * (fréquence + cooldown) ; le gating pub (consentement, payant, kill switch)
 * reste à la charge d'adService, appelé séparément.
 * @param {number} [now] horodatage injectable pour les tests
 */
export function shouldShowInterstitial(now = Date.now()) {
  const { everyN, cooldownMs } = policy();
  if (readInt(COUNTER_KEY) < everyN) return false;
  const last = readInt(LAST_SHOWN_KEY);
  if (last && now - last < cooldownMs) return false;
  return true;
}

/** À appeler après un interstitiel effectivement affiché : réarme le plafond. */
export function markInterstitialShown(now = Date.now()) {
  store.setItem(COUNTER_KEY, '0');
  store.setItem(LAST_SHOWN_KEY, String(now));
}

/** Remise à zéro complète (déconnexion, tests). */
export function resetInterstitialFrequency() {
  store.removeItem(COUNTER_KEY);
  store.removeItem(LAST_SHOWN_KEY);
}
