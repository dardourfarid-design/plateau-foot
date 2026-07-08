// Tests du signal de consentement publicitaire (épic pub, PR A / issue #26).
// Vérifie l'invariant central : aucun consentement pub tant qu'il n'a pas été
// explicitement accordé, et retrait aussi simple que l'octroi.
//
// Deux particularités d'environnement gérées ici :
//   - supabaseClient.js lit `window` au chargement → on shime un window vide
//     AVANT d'importer la chaîne de modules (import dynamique).
//   - pas de localStorage sous Node → le service bascule sur son repli mémoire,
//     ce qui suffit à valider la logique de gating.

import { describe, test, expect } from './test-utils.js';

// Shim minimal : sans config, supabaseClient renvoie null proprement (warn),
// sans lever d'exception à l'import.
if (typeof globalThis.window === 'undefined') globalThis.window = {};

const { CONSENT_PURPOSES } = await import('../src/services/consentService.js');
const {
  getAdvertisingConsent,
  hasAdvertisingConsent,
  isAdvertisingConsentUndecided,
  setAdvertisingConsent,
  onAdvertisingConsentChange,
  AD_CONSENT
} = await import('../src/services/advertisingConsentService.js');

describe('advertisingConsentService', () => {
  test('la finalité ADVERTISING existe côté consentService', () => {
    expect(CONSENT_PURPOSES.ADVERTISING).toBe('advertising');
  });

  test('état initial : indécis, donc aucune pub autorisée', () => {
    expect(getAdvertisingConsent()).toBeNull();
    expect(hasAdvertisingConsent()).toBeFalsy();
    expect(isAdvertisingConsentUndecided()).toBeTruthy();
  });

  test('accorder le consentement autorise la pub', async () => {
    await setAdvertisingConsent(true);
    expect(getAdvertisingConsent()).toBe(AD_CONSENT.GRANTED);
    expect(hasAdvertisingConsent()).toBeTruthy();
    expect(isAdvertisingConsentUndecided()).toBeFalsy();
  });

  test('retirer le consentement coupe la pub (retrait aussi simple que l\'octroi)', async () => {
    await setAdvertisingConsent(true);
    await setAdvertisingConsent(false);
    expect(getAdvertisingConsent()).toBe(AD_CONSENT.DENIED);
    expect(hasAdvertisingConsent()).toBeFalsy();
  });

  test('les abonnés sont notifiés lors d\'un changement, mais pas sur un choix identique', async () => {
    await setAdvertisingConsent(false); // état de départ connu : DENIED
    let notifications = 0;
    let last = null;
    const unsub = onAdvertisingConsentChange(value => { notifications++; last = value; });

    await setAdvertisingConsent(true);  // DENIED -> GRANTED : notifie
    await setAdvertisingConsent(true);  // idempotent : ne notifie pas

    expect(last).toBe(AD_CONSENT.GRANTED);
    expect(notifications).toBe(1);

    unsub();
    await setAdvertisingConsent(false); // après désabonnement : plus rien
    expect(notifications).toBe(1);
  });
});
