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

const ads = await import('../public/src/services/ads/adService.js');
const { setAdvertisingConsent } = await import('../public/src/services/advertisingConsentService.js');

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

  // Durcissement : un consentement INDÉCIS ne suffit plus. Avant, seul un refus
  // explicite bloquait, si bien que la régie se chargeait avant toute réponse au
  // bandeau — en contradiction avec la règle d'or de advertisingConsentService.
  test('consentement indécis : aucune pub (accord positif exigé)', async () => {
    enableAds();
    ads.resetAds();
    // Refus puis « pas encore accordé » : dans les deux cas, rien ne se charge.
    await setAdvertisingConsent(false);
    expect(ads.areAdsAllowed()).toBeFalsy();
    expect(ads.isFormatAllowed('interstitial')).toBeFalsy();

    await setAdvertisingConsent(true);   // l'utilisateur accepte
    expect(ads.areAdsAllowed()).toBeTruthy();
  });

  test('le perk payant l\'emporte même sans refus de consentement', () => {
    // Un détenteur de pass (adFree=true) ne voit JAMAIS de pub, quel que soit
    // son consentement.
    expect(ads.evaluateAdsAllowed(true, false, true)).toBeFalsy();
  });
});

describe('adService — rollout progressif', () => {
  test('rolloutPercent 0 exclut tout le monde, 100 (ou absent) inclut tout le monde', async () => {
    await setAdvertisingConsent(true);
    globalThis.window.__PLATEAU_FOOT_CONFIG__ = { ads: { enabled: true, rolloutPercent: 0 } };
    ads.resetAds();
    expect(ads.isInRollout()).toBeFalsy();
    expect(ads.areAdsAllowed()).toBeFalsy(); // rollout coupe même consentement OK

    globalThis.window.__PLATEAU_FOOT_CONFIG__ = { ads: { enabled: true, rolloutPercent: 100 } };
    expect(ads.isInRollout()).toBeTruthy();
    expect(ads.areAdsAllowed()).toBeTruthy();

    globalThis.window.__PLATEAU_FOOT_CONFIG__ = { ads: { enabled: true } }; // absent = 100 %
    expect(ads.isInRollout()).toBeTruthy();
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

  test('accord positif : pub autorisée', async () => {
    // Accord positif requis (#367) ; ici on repasse à « accordé » pour lever le
    // refus posé par le test précédent.
    enableAds();
    await setAdvertisingConsent(true);
    ads.resetAds();
    expect(ads.areAdsAllowed()).toBeTruthy();
  });

  test('activé + consentement + non payant : la pub est autorisée', async () => {
    // Teste l'ORCHESTRATION (les 3 verrous + les formats), pas le succès du
    // provider concret : le provider actif (AdSense) ne peut pas s'initialiser
    // hors navigateur, ce qui est un comportement de provider légitime, pas un
    // échec de gating.
    enableAds();
    await setAdvertisingConsent(true);
    ads.resetAds();
    expect(ads.areAdsAllowed()).toBeTruthy();
    expect(ads.isFormatAllowed('banner')).toBeTruthy();
    expect(ads.isFormatAllowed('interstitial')).toBeTruthy();
    expect(ads.isFormatAllowed('rewarded')).toBeTruthy();
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
    expect(ads.areAdsAllowed()).toBeTruthy(); // autorisé au départ

    await setAdvertisingConsent(false); // -> 'denied' : déclenche le listener resetAds()
    expect(ads.areAdsAllowed()).toBeFalsy();
    expect((await ads.showRewarded()).completed).toBeFalsy();
  });
});

// #367 — Garantie « zéro pub pour les abonnés ». Un pass actif doit bloquer
// TOUS les formats, même quand tout le reste (kill switch, consentement, format)
// est au vert. On injecte un résolveur de pass pour simuler un abonné sans
// backend, et on couvre en particulier la re-vérification À FROID des formats
// intrusifs (le cache _adFree pourrait être périmé au moment de l'affichage).
describe('adService — zéro pub pour les abonnés (#367)', () => {
  const asSubscriber = () => ads.setActivePassResolver(async () => ({ pass_type: 'monthly' }));
  const asAnonymous = () => ads.setActivePassResolver(null); // rétablit le défaut

  test('refreshAdFreeStatus reflète le pass actif', async () => {
    asSubscriber();
    try {
      await ads.refreshAdFreeStatus();
      expect(ads.isAdFree()).toBeTruthy();
    } finally { asAnonymous(); }
  });

  test('un abonné ne reçoit NI bannière NI interstitiel NI rewarded (tout au vert)', async () => {
    enableAds();
    await setAdvertisingConsent(true);
    ads.resetAds();
    asSubscriber(); // cache _adFree encore false : chaque format se rattrape à froid
    try {
      // La garantie qui compte : aucun format ne s'affiche.
      expect(await ads.showBanner('slot')).toBeFalsy();
      expect((await ads.showInterstitial()).shown).toBeFalsy();
      expect((await ads.showRewarded()).completed).toBeFalsy();
    } finally { asAnonymous(); }
  });

  // Fenêtre dangereuse : cache _adFree = false (dernier refresh fait en anonyme),
  // puis l'abonnement s'active « entre-temps ». La re-vérification à froid doit
  // rattraper AVANT tout affichage — sinon un abonné verrait une pub plein écran.
  test('cache périmé + abonnement actif : l\'interstitiel est rattrapé à froid', async () => {
    enableAds();
    await setAdvertisingConsent(true);
    ads.resetAds();
    asAnonymous();
    await ads.refreshAdFreeStatus();       // cache : pas d'abonnement
    expect(ads.isAdFree()).toBeFalsy();
    asSubscriber();                         // l'abonnement s'active
    try {
      expect((await ads.showInterstitial()).shown).toBeFalsy(); // rattrapé à froid
      expect(ads.isAdFree()).toBeTruthy();  // cache mis à jour au passage
    } finally { asAnonymous(); }
  });

  test('cache périmé + abonnement actif : le rewarded est rattrapé à froid (reason ad-free)', async () => {
    enableAds();
    await setAdvertisingConsent(true);
    ads.resetAds();
    asAnonymous();
    await ads.refreshAdFreeStatus();
    expect(ads.isAdFree()).toBeFalsy();
    asSubscriber();
    try {
      const r = await ads.showRewarded();
      expect(r.completed).toBeFalsy();
      expect(r.reason).toBe('ad-free');     // bloqué par la re-vérification à froid
    } finally { asAnonymous(); }
  });

  test('cache périmé + abonnement actif : la bannière est rattrapée à froid', async () => {
    enableAds();
    await setAdvertisingConsent(true);
    ads.resetAds();
    asAnonymous();
    await ads.refreshAdFreeStatus();
    expect(ads.isAdFree()).toBeFalsy();
    asSubscriber();
    try {
      expect(await ads.showBanner('slot')).toBeFalsy(); // rattrapé à froid
      expect(ads.isAdFree()).toBeTruthy();
    } finally { asAnonymous(); }
  });

  test('setActivePassResolver(null) rétablit le résolveur backend (isolation)', async () => {
    asAnonymous();
    await ads.refreshAdFreeStatus(); // backend indisponible en test → aucun pass
    expect(ads.isAdFree()).toBeFalsy();
  });
});
