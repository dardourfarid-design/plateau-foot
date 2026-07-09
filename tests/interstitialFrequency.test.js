// Tests du plafond de fréquence des interstitiels (épic pub, PR D / issue #29).
// Vérifie les deux conditions cumulatives : N matchs écoulés ET cooldown
// respecté. Le temps est injecté (paramètre `now`) pour tester le cooldown
// sans horloge réelle. Pas de localStorage sous Node → repli mémoire.

import { describe, test, expect } from './test-utils.js';

if (typeof globalThis.window === 'undefined') globalThis.window = {};

const {
  recordMatchEnd,
  shouldShowInterstitial,
  markInterstitialShown,
  resetInterstitialFrequency
} = await import('../src/services/ads/interstitialFrequency.js');

// Politique déterministe : 1 interstitiel tous les 3 matchs, cooldown 10 s.
// Fixée À CHAQUE TEST (pas au chargement) car window.__PLATEAU_FOOT_CONFIG__
// est un état partagé que d'autres fichiers de test mutent aussi.
function setPolicy() {
  globalThis.window.__PLATEAU_FOOT_CONFIG__ = {
    ads: { interstitialEveryNGames: 3, interstitialCooldownMs: 10000 }
  };
}

describe('interstitialFrequency', () => {
  test('pas d\'interstitiel avant d\'avoir atteint le seuil de N matchs', () => {
    setPolicy();
    resetInterstitialFrequency();
    recordMatchEnd();
    recordMatchEnd();
    expect(shouldShowInterstitial()).toBeFalsy(); // 2 < 3
  });

  test('éligible une fois N matchs atteints', () => {
    setPolicy();
    resetInterstitialFrequency();
    recordMatchEnd(); recordMatchEnd(); recordMatchEnd();
    expect(shouldShowInterstitial()).toBeTruthy(); // 3 >= 3
  });

  test('après affichage, le compteur est réarmé (plus éligible immédiatement)', () => {
    setPolicy();
    resetInterstitialFrequency();
    recordMatchEnd(); recordMatchEnd(); recordMatchEnd();
    markInterstitialShown(1000);
    expect(shouldShowInterstitial(1500)).toBeFalsy(); // compteur remis à 0
  });

  test('le cooldown bloque même si N matchs rejoués trop vite', () => {
    setPolicy();
    resetInterstitialFrequency();
    recordMatchEnd(); recordMatchEnd(); recordMatchEnd();
    markInterstitialShown(1000);              // dernier affiché à t=1000
    recordMatchEnd(); recordMatchEnd(); recordMatchEnd(); // 3 nouveaux matchs
    expect(shouldShowInterstitial(5000)).toBeFalsy();  // 4 s < cooldown 10 s
    expect(shouldShowInterstitial(12000)).toBeTruthy(); // 11 s > cooldown
  });
});
