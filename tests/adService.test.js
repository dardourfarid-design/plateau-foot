// Tests de la couche d'orchestration pub (épic pub, PR B / issue #27).
// Vérifie l'invariant central : une pub ne s'affiche QUE si les trois verrous
// sont levés (kill switch + consentement + non-payant), et qu'une révocation
// de consentement coupe tout immédiatement.
//
// Environnement : window shimé (supabaseClient lit window à l'import ; sans
// config Supabase, passService renvoie null → isAdFree() = false). Pas de DOM :
// le mock provider reste en no-op sûr pour les bannières.

import { describe, test, expect } from './test-utils.js';

if (typeof globalThis.window === 'undefined') globalThis.window = {};

const ads = await import('../src/services/ads/adService.js');
const { setAdvertisingConsent } = await import('../src/services/advertisingConsentService.js');

function enableAds() { globalThis.window.__PLATEAU_FOOT_CONFIG__ = { ads: { enabled: true } }; }
function killSwitchOff() { globalThis.window.__PLATEAU_FOOT_CONFIG__ = { ads: { enabled: false } }; }

describe('adService — décision pure evaluateAdsAllowed', () => {
  test('autorisé seulement si activé, non refusé, et non payant', () => {
    // (enabled, consentDenied, adFree)
    expect(ads.evaluateAdsAllowed(true, false, false)).toBeTruthy();  // cas nominal
    expect(ads.evaluateAdsAllowed(false, false, false)).toBeFalsy();  // kill switch
    expect(ads.evaluateAdsAllowed(true, true, false)).toBeFalsy();    // opt-out dur
    expect(ads.evaluateAdsAllowed(true, false, true)).toBeFalsy();    // payant (pass)
  });

  test('le perk payant l\'emporte même sans refus de consentement', () => {
    // Un détenteur de pass (adFree=true) ne voit JAMAIS de pub, quel que soit
    // son consentement.
    expect(ads.evaluateAdsAllowed(true, false, true)).toBeFalsy();
  });
});

describe('adService — verrous de diffusion', () => {
  test('kill switch off : aucune pub même avec consentement', async () => {
    killSwitchOff();
    await setAdvertisingConsent(true);
    ads.resetAds();
    expect(ads.areAdsAllowed()).toBeFalsy();
    expect(await ads.showBanner('slot')).toBeFalsy();
    expect((await ads.showInterstitial()).shown).toBeFalsy();
    const r = await ads.showRewarded();
    expect(r.completed).toBeFalsy();
    expect(r.reason).toBe('ads-not-allowed');
  });

  test('refus explicite (opt-out dur) : aucune pub même si activé', async () => {
    enableAds();
    await setAdvertisingConsent(false); // 'denied' = refus explicite chez nous
    ads.resetAds();
    expect(ads.areAdsAllowed()).toBeFalsy();
    expect((await ads.showRewarded()).completed).toBeFalsy();
  });

  test('indécis (CMP fait autorité) : pub autorisée après un accord', async () => {
    // Le modèle autorise le chargement sauf refus explicite ; ici on repasse à
    // « accordé » pour lever le refus posé par le test précédent.
    enableAds();
    await setAdvertisingConsent(true);
    ads.resetAds();
    expect(ads.areAdsAllowed()).toBeTruthy();
  });

  test('activé + consentement + non payant : la pub est autorisée', async () => {
    enableAds();
    await setAdvertisingConsent(true);
    ads.resetAds();
    expect(ads.areAdsAllowed()).toBeTruthy();
    expect(await ads.initAds()).toBeTruthy();
    expect((await ads.showInterstitial()).shown).toBeTruthy();
    expect((await ads.showRewarded()).completed).toBeTruthy();
  });

  test('isAdFree par défaut false (aucun pass résolu hors backend)', () => {
    expect(ads.isAdFree()).toBeFalsy();
  });

  test('un format désactivé explicitement est bloqué même si la pub est active', async () => {
    globalThis.window.__PLATEAU_FOOT_CONFIG__ = { ads: { enabled: true, rewarded: false } };
    await setAdvertisingConsent(true);
    ads.resetAds();
    expect(ads.areAdsAllowed()).toBeTruthy();          // pub globalement OK
    expect(ads.isFormatAllowed('rewarded')).toBeFalsy(); // mais rewarded coupé
    expect((await ads.showRewarded()).completed).toBeFalsy();
    expect(ads.isFormatAllowed('interstitial')).toBeTruthy(); // les autres restent OK
  });

  test('révoquer le consentement en session coupe la pub immédiatement', async () => {
    enableAds();
    await setAdvertisingConsent(true);
    ads.resetAds();
    expect(await ads.initAds()).toBeTruthy();

    await setAdvertisingConsent(false); // déclenche le listener -> resetAds()
    expect(ads.areAdsAllowed()).toBeFalsy();
    expect((await ads.showRewarded()).completed).toBeFalsy();
  });
});
